"""
/admin/auth: how staff sign in to the admin portal.

  POST login         email + password  -> a short-lived challenge (code emailed, or authenticator app)
  POST mfa/verify    challenge + code  -> access token (15 min) + refresh token (rotating, server-side session)
  POST mfa/resend    a fresh emailed code (also the fallback for authenticator-app users)
  POST refresh       new token pair; a reused refresh token ends that session
  POST logout
  GET  me            who is signed in and what they may do
  invite / password reset / authenticator-app setup / change password
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import ratelimit
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password
from app.modules.staff import security as sec
from app.modules.staff import service
from app.modules.staff.deps import ClientInfo, StaffContext, client_info, get_current_staff
from app.modules.staff.models import StaffStatusEnum
from app.modules.staff.schemas import (
    ChallengeOut, ChallengeRequest, ChangePasswordRequest, CodeRequest, DisableTotpRequest, ForgotPasswordRequest,
    LoginRequest, MeOut, ProfileIn, RefreshRequest, SetPasswordRequest, TokenRequest, TokensOut, TotpSetupOut, VerifyRequest,
)

router = APIRouter()


async def _throttle(name: str, key: str, limit: int, window: int) -> None:
    if settings.RATE_LIMITS_ENABLED and not await ratelimit.hit(f"admin.{name}:{key}", limit, window):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Too many attempts. Please wait a few minutes and try again.")


def me_out(ctx: StaffContext) -> dict:
    data = MeOut.model_validate({**{c: getattr(ctx.staff, c) for c in (
        "id", "email", "name", "status", "is_super_admin", "role", "totp_enabled", "last_login_at", "created_at",
        "phone", "timezone", "avatar_url")},
        "permissions": sorted(ctx.permissions)})
    return data.model_dump(mode="json")


@router.post("/login", response_model=ChallengeOut)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    await _throttle("login.ip", client.ip or "?", 20, 15 * 60)
    await _throttle("login.email", data.email.lower(), 10, 15 * 60)
    staff = await service.check_password(db, data.email, data.password, client)
    return await service.start_challenge(db, staff, client)


@router.post("/mfa/verify", response_model=TokensOut)
async def verify_mfa(data: VerifyRequest, db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    await _throttle("mfa.ip", client.ip or "?", 30, 15 * 60)
    return await service.verify_challenge(db, data.challenge_token, data.code, client)


@router.post("/mfa/resend", response_model=ChallengeOut)
async def resend_mfa(data: ChallengeRequest, db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    await _throttle("mfa.resend", client.ip or "?", 6, 15 * 60)
    return await service.resend_email_code(db, data.challenge_token, client)


@router.post("/refresh", response_model=TokensOut)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    return await service.refresh(db, data.refresh_token, client)


@router.post("/logout")
async def logout(ctx: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db),
                 client: ClientInfo = Depends(client_info)):
    session = await db.merge(ctx.session)
    await service.revoke_session(db, session, "logout")
    await service.audit(db, "logout", ctx.id, client, "session", session.id)
    await db.commit()
    return {"success": True, "message": "Signed out"}


@router.get("/me", response_model=MeOut)
async def me(ctx: StaffContext = Depends(get_current_staff)):
    return me_out(ctx)


# ── invites and password reset (no session) ─────────────────────────────────────────────────

@router.post("/invite/inspect")
async def inspect_invite(data: TokenRequest, db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    await _throttle("invite.ip", client.ip or "?", 30, 15 * 60)
    _, staff = await service.load_action_token(db, data.token, "invite")
    return {"success": True, "data": {"name": staff.name, "email": staff.email,
                                      "role": staff.role.name if staff.role else None}}


@router.post("/invite/accept")
async def accept_invite(data: SetPasswordRequest, db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    await _throttle("invite.ip", client.ip or "?", 30, 15 * 60)
    row, staff = await service.load_action_token(db, data.token, "invite")
    service.set_password(staff, data.password)
    staff.status = StaffStatusEnum.active
    row.used_at = sec.now()
    await service.audit(db, "staff.invite_accepted", staff.id, client, "staff", staff.id)
    await db.commit()
    return {"success": True, "message": "Your account is ready. Sign in to continue."}


@router.post("/password/forgot")
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    await _throttle("forgot.ip", client.ip or "?", 10, 60 * 60)
    await _throttle("forgot.email", data.email.lower(), 3, 60 * 60)
    staff = await service.find_by_email(db, data.email)
    if staff is not None and staff.status == StaffStatusEnum.active:
        token = await service.issue_action_token(db, staff, "reset")
        await service.audit(db, "password.reset_requested", staff.id, client, "staff", staff.id)
        await db.commit()
        service.send_reset(staff, token)
    # Same answer whether or not the email belongs to staff.
    return {"success": True, "message": "If that email belongs to a staff account, a reset link is on its way."}


@router.post("/password/reset")
async def reset_password(data: SetPasswordRequest, db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    await _throttle("reset.ip", client.ip or "?", 20, 60 * 60)
    row, staff = await service.load_action_token(db, data.token, "reset")
    service.set_password(staff, data.password)
    row.used_at = sec.now()
    await service.revoke_all_sessions(db, staff.id, "password_reset")
    await service.audit(db, "password.reset", staff.id, client, "staff", staff.id)
    await db.commit()
    return {"success": True, "message": "Password updated. Sign in with your new password."}


# ── signed-in account security ──────────────────────────────────────────────────────────────

@router.post("/password/change")
async def change_password(data: ChangePasswordRequest, ctx: StaffContext = Depends(get_current_staff),
                          db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    staff = await db.merge(ctx.staff)
    if not verify_password(data.current_password, staff.password_hash or ""):
        raise HTTPException(status_code=400, detail="Your current password is not right.")
    service.set_password(staff, data.new_password)
    await service.revoke_all_sessions(db, staff.id, "password_changed", keep=ctx.session.id)
    await service.audit(db, "password.changed", staff.id, client, "staff", staff.id)
    await db.commit()
    return {"success": True, "message": "Password changed. Other devices were signed out."}


@router.post("/totp/setup", response_model=TotpSetupOut)
async def totp_setup(ctx: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    staff = await db.merge(ctx.staff)
    if staff.totp_enabled:
        raise HTTPException(status_code=400, detail="An authenticator app is already set up.")
    secret = sec.new_totp_secret()
    staff.totp_pending_secret_enc = sec.encrypt(secret)
    await db.commit()
    return {"secret": secret, "otpauth_uri": sec.totp_uri(secret, staff.email)}


@router.post("/totp/enable")
async def totp_enable(data: CodeRequest, ctx: StaffContext = Depends(get_current_staff),
                      db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    staff = await db.merge(ctx.staff)
    secret = sec.decrypt(staff.totp_pending_secret_enc)
    counter = sec.verify_totp(secret, data.code) if secret else None
    if counter is None:
        raise HTTPException(status_code=400, detail="That code is not right. Check your authenticator app's time and try again.")
    staff.totp_secret_enc = staff.totp_pending_secret_enc
    staff.totp_pending_secret_enc = None
    staff.totp_enabled = True
    staff.totp_last_counter = counter
    await service.audit(db, "mfa.totp_enabled", staff.id, client, "staff", staff.id)
    await db.commit()
    return {"success": True, "message": "Authenticator app turned on."}


@router.post("/totp/disable")
async def totp_disable(data: DisableTotpRequest, ctx: StaffContext = Depends(get_current_staff),
                       db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    staff = await db.merge(ctx.staff)
    secret = sec.decrypt(staff.totp_secret_enc)
    if (not staff.totp_enabled or not verify_password(data.password, staff.password_hash or "")
            or not secret or sec.verify_totp(secret, data.code, staff.totp_last_counter) is None):
        raise HTTPException(status_code=400, detail="Your password or code is not right.")
    staff.totp_enabled = False
    staff.totp_secret_enc = None
    staff.totp_last_counter = None
    await service.audit(db, "mfa.totp_disabled", staff.id, client, "staff", staff.id)
    await db.commit()
    return {"success": True, "message": "Authenticator app turned off. Sign-in codes will be emailed."}


# ── own profile ─────────────────────────────────────────────────────────────────────────────

AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}
AVATAR_MAX_BYTES = 2 * 1024 * 1024


@router.patch("/me", response_model=MeOut)
async def update_me(data: ProfileIn, ctx: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db),
                    client: ClientInfo = Depends(client_info)):
    staff = await db.merge(ctx.staff)
    changes = {}
    if data.name is not None:
        staff.name = " ".join(data.name.split())
        changes["name"] = staff.name
    if data.phone is not None:
        phone = data.phone.strip()
        if phone and not all(c.isdigit() or c in "+ -()" for c in phone):
            raise HTTPException(status_code=400, detail="Enter a valid phone number.")
        staff.phone = phone or None
        changes["phone"] = bool(staff.phone)
    if data.timezone is not None:
        from zoneinfo import available_timezones
        if data.timezone not in available_timezones():
            raise HTTPException(status_code=400, detail="Choose a valid timezone.")
        staff.timezone = data.timezone
        changes["timezone"] = data.timezone
    if changes:
        await service.audit(db, "staff.profile_updated", staff.id, client, "staff", staff.id, changes)
    await db.commit()
    return me_out(StaffContext(staff=staff, session=ctx.session, permissions=ctx.permissions))


@router.post("/me/avatar", response_model=MeOut)
async def upload_avatar(file: UploadFile = File(...), ctx: StaffContext = Depends(get_current_staff),
                        db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    if file.content_type not in AVATAR_TYPES:
        raise HTTPException(status_code=400, detail="Use a JPG, PNG or WebP image.")
    content = await file.read(AVATAR_MAX_BYTES + 1)
    if len(content) > AVATAR_MAX_BYTES:
        raise HTTPException(status_code=400, detail="The photo must be 2 MB or smaller.")
    if not settings.CLOUDINARY_CLOUD_NAME:
        raise HTTPException(status_code=503, detail="Photo uploads aren't set up on this server.")
    import asyncio
    import cloudinary.uploader
    try:
        result = await asyncio.to_thread(cloudinary.uploader.upload, content, folder="loni/staff",
                                         public_id=f"staff_{ctx.staff.id}", overwrite=True, resource_type="image",
                                         transformation=[{"width": 256, "height": 256, "crop": "fill", "gravity": "face"}])
    except Exception:
        raise HTTPException(status_code=502, detail="We couldn't upload that photo. Please try another.")
    staff = await db.merge(ctx.staff)
    staff.avatar_url = result.get("secure_url")
    await service.audit(db, "staff.avatar_updated", staff.id, client, "staff", staff.id)
    await db.commit()
    return me_out(StaffContext(staff=staff, session=ctx.session, permissions=ctx.permissions))
