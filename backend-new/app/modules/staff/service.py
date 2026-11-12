"""Admin-portal account logic: sign-in with a second factor, sessions, invites, password resets and the audit trail."""
import asyncio
import html
from datetime import datetime, timedelta
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.modules.staff import security as sec
from app.modules.staff.deps import ClientInfo
from app.modules.staff.models import (
    Staff, StaffActionToken, StaffAuditLog, StaffLoginChallenge, StaffSession, StaffStatusEnum,
)

INVALID_LOGIN = "Invalid email or password."
INVALID_CODE = "That code is not right. Check it and try again."
CHALLENGE_GONE = "This sign-in has expired. Please sign in again."
RESEND_COOLDOWN_SECONDS = 30
REFRESH_GRACE_SECONDS = 20


def bad_request(detail: str, code: int = status.HTTP_400_BAD_REQUEST) -> HTTPException:
    return HTTPException(status_code=code, detail=detail)


def email_hint(email: str) -> str:
    local, _, domain = email.partition("@")
    return f"{local[:2]}{'•' * max(3, len(local) - 2)}@{domain}"


async def audit(db: AsyncSession, action: str, staff_id: Optional[str], client: Optional[ClientInfo] = None,
                target_type: Optional[str] = None, target_id: Optional[str] = None, details: Optional[dict] = None) -> None:
    db.add(StaffAuditLog(
        staff_id=staff_id, action=action, target_type=target_type, target_id=target_id, details=details,
        ip_address=client.ip if client else None, user_agent=client.user_agent if client else None,
    ))


# ── email ────────────────────────────────────────────────────────────────────────────────────

def _email_html(heading: str, body: str, button: Optional[Tuple[str, str]] = None, code: Optional[str] = None) -> str:
    cta = (f'<p style="margin:28px 0"><a href="{html.escape(button[1])}" style="background:#D62D88;color:#fff;'
           f'padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">{html.escape(button[0])}</a></p>'
           if button else "")
    code_block = (f'<div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#D62D88;margin:24px 0">{code}</div>'
                  if code else "")
    return f"""<!DOCTYPE html><html><body style="margin:0;background:#f6f6f8;font-family:Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;color:#1a1a1a">
<img src="https://ik.imagekit.io/eqh0cjetc/amazon-image/Group%2013%201.png" alt="LONI" style="height:40px"/>
<h2 style="margin:24px 0 8px">{html.escape(heading)}</h2>{body}{code_block}{cta}
<p style="color:#777;font-size:13px">If you didn't expect this email, you can ignore it. LONI staff will never ask you for this code.</p>
</div></body></html>"""


def _send(to: str, subject: str, content: str, dev_note: str) -> None:
    from app.modules.auth.email_service import send_plain_email
    if not settings.BREVO_API_KEY:
        # Local development only: no email provider, so the code/link is printed for the developer.
        print(f"[admin-portal] {subject} -> {to}: {dev_note}")
        return

    async def _go():
        try:
            await send_plain_email(to, subject, content)
        except Exception as e:  # delivery problems must not break sign-in; the person can resend
            print(f"[admin-portal] failed to email {to}: {e}")
    asyncio.create_task(_go())


def send_login_code(staff: Staff, code: str) -> None:
    body = f"<p>Hi {html.escape(staff.name.split()[0])}, use this code to finish signing in to the LONI admin portal. It expires in {settings.ADMIN_MFA_CODE_MINUTES} minutes.</p>"
    _send(staff.email, "Your LONI admin sign-in code", _email_html("Sign-in code", body, code=code), code)


def send_invite(staff: Staff, inviter: Staff, token: str) -> None:
    link = f"{settings.ADMIN_PORTAL_URL.rstrip('/')}/accept-invite?token={token}"
    body = (f"<p>{html.escape(inviter.name)} invited you to the LONI admin portal"
            f"{' as ' + html.escape(staff.role.name) if staff.role else ''}. Set your password to get started. "
            f"This link works once and expires in {settings.ADMIN_INVITE_HOURS} hours.</p>")
    _send(staff.email, "You're invited to the LONI admin portal",
          _email_html("Join the LONI team", body, button=("Set up my account", link)), link)


def send_reset(staff: Staff, token: str) -> None:
    link = f"{settings.ADMIN_PORTAL_URL.rstrip('/')}/reset-password?token={token}"
    body = f"<p>Someone asked to reset the password for this LONI admin account. The link works once and expires in {settings.ADMIN_RESET_MINUTES} minutes.</p>"
    _send(staff.email, "Reset your LONI admin password", _email_html("Reset your password", body, button=("Choose a new password", link)), link)


# ── step 1: password ─────────────────────────────────────────────────────────────────────────

async def find_by_email(db: AsyncSession, email: str) -> Optional[Staff]:
    return (await db.execute(select(Staff).where(Staff.email == email.strip().lower()))).scalar_one_or_none()


async def check_password(db: AsyncSession, email: str, password: str, client: ClientInfo) -> Staff:
    staff = await find_by_email(db, email)
    if staff is None or not staff.password_hash:
        await asyncio.to_thread(verify_password, password, sec.dummy_password_hash())
        await audit(db, "login.failed", None, client, details={"email": email.lower()[:255], "reason": "unknown"})
        await db.commit()
        raise bad_request(INVALID_LOGIN, status.HTTP_401_UNAUTHORIZED)

    locked = sec.aware(staff.locked_until)
    if locked and locked > sec.now():
        minutes = max(1, int((locked - sec.now()).total_seconds() // 60) + 1)
        raise bad_request(f"Too many failed attempts. Try again in {minutes} minute{'s' if minutes != 1 else ''}.",
                          status.HTTP_429_TOO_MANY_REQUESTS)

    if not await asyncio.to_thread(verify_password, password, staff.password_hash):
        staff.failed_login_count = (staff.failed_login_count or 0) + 1
        details = {"reason": "password", "count": staff.failed_login_count}
        if staff.failed_login_count >= settings.ADMIN_LOGIN_MAX_FAILURES:
            staff.locked_until = sec.now() + timedelta(minutes=settings.ADMIN_LOCKOUT_MINUTES)
            staff.failed_login_count = 0
            details["locked"] = True
        await audit(db, "login.failed", staff.id, client, "staff", staff.id, details)
        await db.commit()
        raise bad_request(INVALID_LOGIN, status.HTTP_401_UNAUTHORIZED)

    # Correct password but the account can't be used: say so only now that they've proven the password.
    if staff.status == StaffStatusEnum.suspended:
        await audit(db, "login.blocked", staff.id, client, "staff", staff.id, {"reason": "suspended"})
        await db.commit()
        raise bad_request("This account is suspended. Contact a LONI super admin.", status.HTTP_403_FORBIDDEN)
    if staff.status != StaffStatusEnum.active:
        raise bad_request(INVALID_LOGIN, status.HTTP_401_UNAUTHORIZED)
    return staff


def _methods(staff: Staff) -> list:
    return ["totp", "email"] if staff.totp_enabled else ["email"]


async def start_challenge(db: AsyncSession, staff: Staff, client: ClientInfo) -> dict:
    # A new sign-in replaces any half-finished one.
    await db.execute(update(StaffLoginChallenge)
                     .where(StaffLoginChallenge.staff_id == staff.id, StaffLoginChallenge.consumed_at.is_(None))
                     .values(consumed_at=sec.now()))
    secret = sec.new_secret()
    challenge = StaffLoginChallenge(
        id=sec.new_id(), staff_id=staff.id, token_hash=sec.hash_secret(secret),
        method="totp" if staff.totp_enabled else "email", ip_address=client.ip,
        expires_at=sec.now() + timedelta(minutes=settings.ADMIN_MFA_CODE_MINUTES),
    )
    db.add(challenge)
    if challenge.method == "email":
        _issue_code(challenge, staff)
    await audit(db, "login.password_ok", staff.id, client, "staff", staff.id, {"method": challenge.method})
    await db.commit()
    return _challenge_out(challenge, staff, f"{challenge.id}.{secret}")


def _issue_code(challenge: StaffLoginChallenge, staff: Staff) -> None:
    code = sec.new_code()
    challenge.code_hash = sec.hash_code(challenge.id, code)
    challenge.code_sent_at = sec.now()
    challenge.attempts = 0
    challenge.expires_at = sec.now() + timedelta(minutes=settings.ADMIN_MFA_CODE_MINUTES)
    send_login_code(staff, code)


def _challenge_out(challenge: StaffLoginChallenge, staff: Staff, token: str) -> dict:
    return {
        "challenge_token": token, "method": challenge.method, "methods": _methods(staff),
        "email_hint": email_hint(staff.email),
        "expires_in": max(0, int((sec.aware(challenge.expires_at) - sec.now()).total_seconds())),
    }


async def _load_challenge(db: AsyncSession, token: str) -> Tuple[StaffLoginChallenge, Staff]:
    row_id, secret = sec.split_token(token)
    challenge = await db.get(StaffLoginChallenge, row_id) if row_id else None
    if (challenge is None or not sec.same(challenge.token_hash, sec.hash_secret(secret))
            or challenge.consumed_at is not None or sec.aware(challenge.expires_at) <= sec.now()):
        raise bad_request(CHALLENGE_GONE, status.HTTP_401_UNAUTHORIZED)
    staff = await db.get(Staff, challenge.staff_id)
    if staff is None or staff.status != StaffStatusEnum.active:
        raise bad_request(CHALLENGE_GONE, status.HTTP_401_UNAUTHORIZED)
    return challenge, staff


# ── step 2: second factor ────────────────────────────────────────────────────────────────────

async def resend_email_code(db: AsyncSession, token: str, client: ClientInfo) -> dict:
    """Send (another) email code; also how someone with an authenticator app falls back to email."""
    challenge, staff = await _load_challenge(db, token)
    sent = sec.aware(challenge.code_sent_at)
    if sent and (sec.now() - sent).total_seconds() < RESEND_COOLDOWN_SECONDS:
        raise bad_request("Please wait a few seconds before asking for another code.", status.HTTP_429_TOO_MANY_REQUESTS)
    challenge.method = "email"
    _issue_code(challenge, staff)
    await audit(db, "login.code_sent", staff.id, client, "staff", staff.id)
    await db.commit()
    return _challenge_out(challenge, staff, token)


async def verify_challenge(db: AsyncSession, token: str, code: str, client: ClientInfo) -> dict:
    challenge, staff = await _load_challenge(db, token)
    code = code.strip().replace(" ", "")
    ok = False
    if challenge.method == "email":
        ok = sec.same(challenge.code_hash, sec.hash_code(challenge.id, code))
    elif challenge.method == "totp":
        secret = sec.decrypt(staff.totp_secret_enc)
        counter = sec.verify_totp(secret, code, staff.totp_last_counter) if secret else None
        if counter is not None:
            staff.totp_last_counter = counter
            ok = True

    if not ok:
        challenge.attempts = (challenge.attempts or 0) + 1
        left = settings.ADMIN_MFA_MAX_ATTEMPTS - challenge.attempts
        if left <= 0:
            challenge.consumed_at = sec.now()
        await audit(db, "login.mfa_failed", staff.id, client, "staff", staff.id, {"method": challenge.method, "attempts": challenge.attempts})
        await db.commit()
        if left <= 0:
            raise bad_request("Too many wrong codes. Please sign in again.", status.HTTP_401_UNAUTHORIZED)
        raise bad_request(INVALID_CODE)

    challenge.consumed_at = sec.now()
    staff.failed_login_count = 0
    staff.locked_until = None
    staff.last_login_at = sec.now()
    tokens = await _open_session(db, staff, client)
    await audit(db, "login.success", staff.id, client, "staff", staff.id, {"method": challenge.method})
    await db.commit()
    return tokens


# ── sessions ─────────────────────────────────────────────────────────────────────────────────

def _session_expiry(created) -> datetime:
    idle = sec.now() + timedelta(minutes=settings.ADMIN_SESSION_IDLE_MINUTES)
    absolute = sec.aware(created) + timedelta(hours=settings.ADMIN_SESSION_MAX_HOURS)
    return min(idle, absolute)


async def _open_session(db: AsyncSession, staff: Staff, client: ClientInfo) -> dict:
    secret = sec.new_secret()
    created = sec.now()
    session = StaffSession(
        id=sec.new_id(), staff_id=staff.id, refresh_token_hash=sec.hash_secret(secret),
        ip_address=client.ip, user_agent=client.user_agent, created_at=created, last_used_at=created,
        expires_at=_session_expiry(created),
    )
    db.add(session)
    return _tokens(staff, session, f"{session.id}.{secret}")


def _tokens(staff: Staff, session: StaffSession, refresh_token: Optional[str]) -> dict:
    access, ttl = sec.create_access_token(staff.id, session.id)
    return {"access_token": access, "access_expires_in": ttl, "refresh_token": refresh_token,
            "session_expires_at": session.expires_at, "token_type": "bearer"}


async def refresh(db: AsyncSession, token: str, client: ClientInfo) -> dict:
    """Swap a refresh token for a new pair. An old (already swapped) token means it was copied: end the session."""
    row_id, secret = sec.split_token(token)
    session = await db.get(StaffSession, row_id) if row_id else None
    if session is None or session.revoked_at is not None or sec.aware(session.expires_at) <= sec.now():
        raise bad_request("Your session has ended. Please sign in again.", status.HTTP_401_UNAUTHORIZED)
    presented = sec.hash_secret(secret)
    rotated = sec.aware(session.rotated_at)
    if (sec.same(session.previous_refresh_hash, presented) and rotated
            and (sec.now() - rotated).total_seconds() <= REFRESH_GRACE_SECONDS):
        # Another request from the same browser rotated this a moment ago: a new access token, same refresh token.
        staff = await db.get(Staff, session.staff_id)
        if staff is None or staff.status != StaffStatusEnum.active:
            raise bad_request("Your session has ended. Please sign in again.", status.HTTP_401_UNAUTHORIZED)
        return _tokens(staff, session, None)
    if not sec.same(session.refresh_token_hash, presented):
        session.revoked_at = sec.now()
        session.revoked_reason = "refresh_reuse"
        await audit(db, "session.reuse_detected", session.staff_id, client, "session", session.id)
        await db.commit()
        raise bad_request("Your session has ended. Please sign in again.", status.HTTP_401_UNAUTHORIZED)
    staff = await db.get(Staff, session.staff_id)
    if staff is None or staff.status != StaffStatusEnum.active:
        raise bad_request("Your session has ended. Please sign in again.", status.HTTP_401_UNAUTHORIZED)

    new_secret = sec.new_secret()
    session.previous_refresh_hash = session.refresh_token_hash
    session.rotated_at = sec.now()
    session.refresh_token_hash = sec.hash_secret(new_secret)
    session.last_used_at = sec.now()
    session.expires_at = _session_expiry(session.created_at)
    if client.ip:
        session.ip_address = client.ip
    await db.commit()
    return _tokens(staff, session, f"{session.id}.{new_secret}")


async def revoke_session(db: AsyncSession, session: StaffSession, reason: str) -> None:
    if session.revoked_at is None:
        session.revoked_at = sec.now()
        session.revoked_reason = reason


async def revoke_all_sessions(db: AsyncSession, staff_id: str, reason: str, keep: Optional[str] = None) -> None:
    q = (update(StaffSession)
         .where(StaffSession.staff_id == staff_id, StaffSession.revoked_at.is_(None))
         .values(revoked_at=sec.now(), revoked_reason=reason))
    if keep:
        q = q.where(StaffSession.id != keep)
    await db.execute(q)


# ── invites and password resets ─────────────────────────────────────────────────────────────

async def issue_action_token(db: AsyncSession, staff: Staff, purpose: str) -> str:
    # Only the newest link of each kind works.
    await db.execute(update(StaffActionToken)
                     .where(StaffActionToken.staff_id == staff.id, StaffActionToken.purpose == purpose,
                            StaffActionToken.used_at.is_(None))
                     .values(used_at=sec.now()))
    token = sec.new_secret()
    lifetime = (timedelta(hours=settings.ADMIN_INVITE_HOURS) if purpose == "invite"
                else timedelta(minutes=settings.ADMIN_RESET_MINUTES))
    db.add(StaffActionToken(staff_id=staff.id, purpose=purpose, token_hash=sec.hash_secret(token),
                            expires_at=sec.now() + lifetime))
    return token


async def load_action_token(db: AsyncSession, token: str, purpose: str) -> Tuple[StaffActionToken, Staff]:
    row = (await db.execute(select(StaffActionToken).where(StaffActionToken.token_hash == sec.hash_secret(token)))).scalar_one_or_none()
    if (row is None or row.purpose != purpose or row.used_at is not None or sec.aware(row.expires_at) <= sec.now()):
        raise bad_request("This link is invalid or has expired. Ask for a new one.")
    staff = await db.get(Staff, row.staff_id)
    if staff is None or staff.status == StaffStatusEnum.suspended:
        raise bad_request("This link is invalid or has expired. Ask for a new one.")
    if purpose == "invite" and staff.status != StaffStatusEnum.invited:
        raise bad_request("This invite has already been used. Sign in instead.")
    if purpose == "reset" and staff.status != StaffStatusEnum.active:
        raise bad_request("This link is invalid or has expired. Ask for a new one.")
    return row, staff


def set_password(staff: Staff, password: str) -> None:
    problem = sec.password_problem(password, staff.email)
    if problem:
        raise bad_request(problem)
    staff.password_hash = get_password_hash(password)
    staff.password_changed_at = sec.now()
    staff.failed_login_count = 0
    staff.locked_until = None
