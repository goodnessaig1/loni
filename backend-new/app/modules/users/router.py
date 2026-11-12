from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, Form, HTTPException, Query
from typing import Optional
from datetime import datetime, timezone
import cloudinary
import cloudinary.uploader
import asyncio
from app.core.config import settings
from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.security import verify_password, get_password_hash
from app.modules.users.schemas import (
    UpdateContactPermissions, ChangePasswordRequest,
    ToggleOnlineRequest, UpdateNurseProfileRequest, UpdateUserProfileRequest,
    DriverPersonalInfoRequest, DriverVehicleInfoRequest, DriverDocumentsRequest, UpdateStageRequest
)
from app.modules.users.stage import apply_stage
from app.modules.driver_training.onboarding import build_status, require_step
from app.core.database import get_db
from app.api.deps import get_current_user
from app.modules.users.models import User, EmergencyContact, EmergencyContactStatus, NurseProfile, DriverProfile, UserTypeEnum
from app.modules.auth.schemas import (
    StandardResponse, UpdateProfileRequest,
    EmergencyContactsRequest, InvitePartnerRequest
)
from app.modules.auth.email_service import (
    send_partner_invite_email,
    send_partner_removal_user_email,
    send_partner_removal_partner_email
)
from app.modules.rides.models import Ride, TERMINAL_STATUSES
from app.modules.notifications.models import NotificationLog
from app.modules.notifications.service import NotificationService
from app.core.ws_manager import manager as ws_manager
from app.utils.user_enrichment import enrich_user_data, calculate_pregnancy_start_date
from app.utils.partner_content import get_latest_updates, get_timeline
from app.modules.users import partner_sync
from app.core.ratelimit import limit, hit as rate_hit

router = APIRouter()

@router.get("/me", response_model=StandardResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    The authenticated user. For drivers, `data.user.driver_onboarding` carries
    the signup state machine (same shape as `GET /driver-training/onboarding`)
    so the app can resume the flow at the right step on launch.
    """
    user_data = enrich_user_data(current_user)
    if current_user.user_type == UserTypeEnum.driver:
        user_data["driver_onboarding"] = await build_status(db, current_user)
    return {"success": True, "data": {"user": user_data}}

@router.patch("/update-profile", response_model=StandardResponse)
async def update_profile(
    data: UpdateProfileRequest, 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)
        
    status_val = current_user.status.value if current_user.status else None
    start_date = calculate_pregnancy_start_date(
        status=status_val,
        pregnancy_week=current_user.pregnancy_week,
        baby_age=current_user.baby_age
    )
    if start_date:
        current_user.pregnancy_start_date = start_date
        
    db.add(current_user)
    await db.commit()
    return {"success": True, "message": "Profile updated successfully"}

@router.patch("/stage", response_model=StandardResponse)
async def update_stage(
    data: UpdateStageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change trimester / recovery stage, or switch between pregnancy and postpartum. Returns the fresh user."""
    if current_user.user_type not in (None, UserTypeEnum.user):
        raise HTTPException(status_code=403, detail="Only mothers have a stage")
    if data.status is None and data.trimester is None and data.recovery_stage is None:
        raise HTTPException(status_code=400, detail="Nothing to update")
    old_status = current_user.status.value if current_user.status else None
    apply_stage(current_user, data.status, data.trimester, data.recovery_stage)
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    # Partners she shares updates with see her new stage right away.
    new_status = current_user.status.value if current_user.status else None
    first = (current_user.name or "She").split(" ")[0]
    for c in await partner_sync.partners_of(db, current_user.id):
        if c.updates:
            body = f"{first} updated her journey." if new_status == old_status else {
                "pregnant": f"{first} is now sharing her pregnancy journey.",
                "newMom": f"{first} is now sharing her recovery after birth.",
            }.get(new_status, f"{first} updated her journey.")
            await partner_sync.tell(db, c.contact_user_id, "partner_stage_changed", "Her journey was updated", body,
                                    {"status": new_status})
    await db.commit()
    await partner_sync.send_due_updates(db, current_user)
    return {"success": True, "message": "Stage updated", "data": {"user": enrich_user_data(current_user)}}

@router.put("/me/password", response_model=StandardResponse)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from fastapi import HTTPException
    
    if not verify_password(data.old_password, current_user.password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
        
    current_user.password = get_password_hash(data.new_password)
    db.add(current_user)
    await db.commit()
    
    return {"success": True, "message": "Password changed successfully"}

@router.post("/emergency-contacts", response_model=StandardResponse)
async def emergency_contacts(
    data: EmergencyContactsRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    from fastapi import HTTPException
    import uuid
    from app.modules.users.models import UserTypeEnum, StatusEnum, GenderEnum

    inviter_name = current_user.name if current_user.name else "A Loni User"

    for contact in data.contacts:
        # Check if email exists
        stmt = select(User).where(User.email == contact.email)
        result = await db.execute(stmt)
        partner_user = result.scalars().first()

        if partner_user:
            raise HTTPException(status_code=400, detail=f"The email {contact.email} is already registered to a Loni account.")

        partner_user = User(
            id=str(uuid.uuid4())[:12],
            name=contact.name,
            email=contact.email,
            password="unusable_password_hash",
            status=StatusEnum.newMom,
            phone=contact.phone,
            gender=GenderEnum.Others,
            user_type=UserTypeEnum.partner,
            referral_code=f"REF{uuid.uuid4().hex[:8].upper()}",
            referred_by=current_user.referral_code
        )
        db.add(partner_user)
        await db.flush()

        new_contact = EmergencyContact(
            user_id=current_user.id,
            contact_user_id=partner_user.id,
            relationship=contact.relationship
        )
        db.add(new_contact)

        # Send invitation email
        message = contact.message or "I'm using LONI for pregnancy and recovery support. I'd love for you to join my support circle so we can stay connected during important moments 💜"
        background_tasks.add_task(send_partner_invite_email, contact.email, inviter_name, message)

    await db.commit()
    return {"success": True, "message": "Emergency contacts saved"}

@router.get("/emergency-contacts", response_model=StandardResponse)
async def get_emergency_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(EmergencyContact).where(EmergencyContact.user_id == current_user.id).options(selectinload(EmergencyContact.contact_user))
    result = await db.execute(stmt)
    contacts = result.scalars().all()
    
    contacts_data = []
    for contact in contacts:
        if contact.contact_user:
            contacts_data.append({
                "id": contact.id,
                "name": contact.contact_user.name,
                "phone": contact.contact_user.phone or "",
                "email": contact.contact_user.email,
                "relationship": contact.relationship,
                "status": contact.status.value if contact.status else "pending",
                "profile_picture": contact.contact_user.profile_picture,
                "location": contact.location,
                "updates": contact.updates,
                "emergency": contact.emergency,
                "created_at": contact.created_at
            })
    return {"success": True, "data": {"contacts": contacts_data}}

async def _delete_partner_account(db: AsyncSession, partner: User) -> None:
    """A support partner's account exists only for one connection; remove it and the rows that point at it."""
    from sqlalchemy import delete as sa_delete
    from app.modules.account.models import UserSettings, SupportMessage
    await db.execute(sa_delete(NotificationLog).where(NotificationLog.user_id == partner.id))
    await db.execute(sa_delete(UserSettings).where(UserSettings.user_id == partner.id))
    await db.execute(update(SupportMessage).where(SupportMessage.user_id == partner.id).values(user_id=None))
    await db.delete(partner)


@router.delete("/partner-connection", response_model=StandardResponse)
async def leave_partner_connection(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """A partner stops getting her alerts: the connection and their partner account are removed,
    and she is told (Notification Centre + push + email). She can invite them again later."""
    if current_user.user_type != UserTypeEnum.partner:
        raise HTTPException(status_code=403, detail="Only partners can leave a connection")
    contact = (await db.execute(
        select(EmergencyContact).where(EmergencyContact.contact_user_id == current_user.id)
        .options(selectinload(EmergencyContact.user))
    )).scalars().first()
    if not contact:
        raise HTTPException(status_code=404, detail="No connection found")
    mother = contact.user
    partner_name = current_user.name or "Your support partner"
    from app.modules.rides.services.ride_service import forget_contacts
    forget_contacts(contact.user_id)
    await db.delete(contact)
    await _delete_partner_account(db, current_user)
    if mother:
        await partner_sync.tell(db, mother.id, "partner_left", "Support partner left",
                                f"{partner_name} will no longer receive your updates and alerts.", {})
    await db.commit()
    if mother:
        if mother.email:
            background_tasks.add_task(send_partner_removal_user_email, mother.email, partner_name)
    return {"success": True, "message": "You will no longer receive her alerts"}


@router.get("/partner-updates", response_model=StandardResponse)
async def partner_updates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The full week-by-week timeline for the Pregnancy Updates screen (only if she shares updates)."""
    if current_user.user_type != UserTypeEnum.partner:
        raise HTTPException(status_code=403, detail="Only partners have updates")
    contact = (await db.execute(
        select(EmergencyContact).where(EmergencyContact.contact_user_id == current_user.id)
        .options(selectinload(EmergencyContact.user))
    )).scalars().first()
    if not contact or not contact.user:
        raise HTTPException(status_code=404, detail="No connection found")
    mother = contact.user
    data = enrich_user_data(mother)
    status_val = mother.status.value if mother.status else None
    week = None
    if mother.pregnancy_start_date:
        start = mother.pregnancy_start_date
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        week = max(int((datetime.now(timezone.utc) - start).total_seconds() // (7 * 86400)), 0)
    shared = bool(contact.updates)
    milestones = get_timeline(status_val, week) if (shared and week is not None and status_val in ("pregnant", "newMom")) else []
    return {"success": True, "data": {
        "inviter_name": mother.name,
        "status": status_val,
        "week": week,
        "trimester": data.get("trimester"),
        "shared": shared,
        "milestones": milestones,
    }}


@router.get("/partner-connection", response_model=StandardResponse)
async def get_partner_connection(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    For a signed-in partner: who invited them and what that inviter has
    chosen to share. Read-only from here - the inviter controls these
    toggles via PATCH /emergency-contacts/{id}/permissions.
    """
    if current_user.user_type != UserTypeEnum.partner:
        raise HTTPException(status_code=403, detail="Only partners have a connection to view")

    stmt = select(EmergencyContact).where(
        EmergencyContact.contact_user_id == current_user.id
    ).options(selectinload(EmergencyContact.user))
    result = await db.execute(stmt)
    contact = result.scalars().first()

    if not contact or not contact.user:
        raise HTTPException(status_code=404, detail="No connection found")

    return {
        "success": True,
        "data": {
            "inviter_name": contact.user.name,
            "relationship": contact.relationship,
            "status": contact.status.value if contact.status else "pending",
            "connected_at": contact.connected_at.isoformat() if contact.connected_at else None,
            "location": contact.location,
            "updates": contact.updates,
            "emergency": contact.emergency,
        }
    }

@router.get("/partner-dashboard", response_model=StandardResponse)
async def get_partner_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Everything the partner home screen needs in one call: who they're
    connected to, her current pregnancy/recovery week, her latest
    week-by-week updates (if shared), and any in-flight emergency ride she
    asked her contacts to be notified about (if shared). There is no
    "idle" location - a partner only ever sees where she is while she's
    actually in an emergency ride with a driver, via `active_alert`.
    """
    if current_user.user_type != UserTypeEnum.partner:
        raise HTTPException(status_code=403, detail="Only partners have a dashboard")

    stmt = select(EmergencyContact).where(
        EmergencyContact.contact_user_id == current_user.id
    ).options(selectinload(EmergencyContact.user))
    result = await db.execute(stmt)
    contact = result.scalars().first()
    if not contact or not contact.user:
        raise HTTPException(status_code=404, detail="No connection found")

    inviter = contact.user

    current_week = None
    if inviter.pregnancy_start_date:
        start = inviter.pregnancy_start_date
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        diff_days = (datetime.now(timezone.utc) - start).total_seconds() / 86400
        current_week = max(int(diff_days // 7), 0)

    status_val = inviter.status.value if inviter.status else None

    data: dict = {
        "partner": {"name": current_user.name, "profile_picture": current_user.profile_picture},
        "inviter": {
            "id": inviter.id,
            "name": inviter.name,
            "profile_picture": inviter.profile_picture,
            "status": status_val,
            "week": current_week,
        },
        "sharing": {
            "location": contact.location,
            "updates": contact.updates,
            "emergency": contact.emergency,
        },
        "updates": [],
        "active_alert": None,
    }

    if contact.updates and current_week is not None and status_val:
        updates = get_latest_updates(status_val, current_week)
        data["updates"] = updates
        # Her newest milestone, if this partner hasn't been told yet (also sent by the hourly sweep).
        await partner_sync.send_due_updates(db, inviter, only_partner=current_user.id)

    if contact.emergency:
        ride_stmt = select(Ride).where(
            Ride.rider_id == inviter.id,
            Ride.status.notin_(list(TERMINAL_STATUSES)),
            Ride.notify_contacts.is_(True),
        ).options(
            selectinload(Ride.driver).selectinload(User.driver_profile)
        ).order_by(Ride.requested_at.desc())
        ride_result = await db.execute(ride_stmt)
        ride = ride_result.scalars().first()
        if ride:
            driver_profile = getattr(ride.driver, "driver_profile", None)
            driver_location = None
            # Where she is (pickup, the driver's live position) is only shared if she allows location.
            if contact.location and driver_profile and driver_profile.current_lat is not None and driver_profile.current_lng is not None:
                driver_location = {
                    "lat": driver_profile.current_lat,
                    "lng": driver_profile.current_lng,
                    "updated_at": driver_profile.location_updated_at.isoformat() if driver_profile.location_updated_at else None,
                }
            data["active_alert"] = {
                "ride_id": ride.id,
                "status": ride.status.value,
                "pickup": {"lat": ride.pickup_lat, "lng": ride.pickup_lng} if contact.location else None,
                "pickup_address": ride.pickup_address if contact.location else None,
                "location_shared": contact.location,
                "dropoff_name": ride.dropoff_name,
                "driver_name": ride.driver.name if ride.driver else None,
                "driver_location": driver_location,
                "requested_at": ride.requested_at.isoformat() if ride.requested_at else None,
            }

    return {"success": True, "data": data}

@router.get("/notifications", response_model=StandardResponse)
async def get_notifications(
    limit: int = Query(50, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    The signed-in user's notification history (newest first), plus how many
    are unread - used for the bell badge. Every row here was also pushed via
    FCM/WS at the time it happened; this is the durable, re-visitable copy.
    """
    result = await db.execute(
        select(NotificationLog)
        .where(NotificationLog.user_id == current_user.id)
        .order_by(NotificationLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    unread_result = await db.execute(
        select(func.count()).select_from(NotificationLog)
        .where(NotificationLog.user_id == current_user.id, NotificationLog.read_at.is_(None))
    )
    unread_count = unread_result.scalar_one()

    return {
        "success": True,
        "data": {
            "unread_count": unread_count,
            "notifications": [
                {
                    "id": n.id,
                    "type": n.type,
                    "title": n.title,
                    "body": n.body,
                    "data": n.data,
                    "read": n.read_at is not None,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                }
                for n in logs
            ],
        },
    }

@router.post("/notifications/mark-read", response_model=StandardResponse)
async def mark_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(NotificationLog)
        .where(NotificationLog.user_id == current_user.id, NotificationLog.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return {"success": True, "message": "Notifications marked as read"}

@router.post("/invite-partner", response_model=StandardResponse)
async def invite_partner(
    data: InvitePartnerRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from fastapi import HTTPException
    import uuid
    from app.modules.users.models import UserTypeEnum, StatusEnum, GenderEnum

    # 1. Check if user already exists by email
    stmt = select(User).where(User.email == data.email)
    result = await db.execute(stmt)
    partner_user = result.scalars().first()

    if partner_user:
        raise HTTPException(status_code=400, detail=f"The email {data.email} is already registered to a Loni account.")

    partner_user = User(
        id=str(uuid.uuid4())[:12],
        name=data.fullname,
        email=data.email,
        password="unusable_password_hash",
        status=StatusEnum.newMom,
        gender=GenderEnum.Others,
        user_type=UserTypeEnum.partner,
        referral_code=f"REF{uuid.uuid4().hex[:8].upper()}",
        referred_by=current_user.referral_code
    )
    db.add(partner_user)
    await db.flush()

    # 2. Create EmergencyContact record connecting them
    new_contact = EmergencyContact(
        user_id=current_user.id,
        contact_user_id=partner_user.id,
        relationship="Partner"
    )
    db.add(new_contact)
    await db.commit()

    # 3. Send invitation email
    inviter_name = current_user.name if current_user.name else "A Loni User"
    background_tasks.add_task(send_partner_invite_email, data.email, inviter_name, data.message)
    
    return {"success": True, "message": "Partner invited successfully"}

@router.delete("/emergency-contacts/{contact_id}", response_model=StandardResponse)
async def remove_emergency_contact(
    contact_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from fastapi import HTTPException
    
    # 1. Fetch contact ensuring it belongs to current_user
    stmt = select(EmergencyContact).where(
        EmergencyContact.id == contact_id,
        EmergencyContact.user_id == current_user.id
    ).options(selectinload(EmergencyContact.contact_user))
    result = await db.execute(stmt)
    contact = result.scalars().first()

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found or access denied")

    partner_user = contact.contact_user
    partner_email = partner_user.email if partner_user else None
    partner_name = partner_user.name if partner_user else "Partner"
    # Revoking an invite nobody accepted yet: no "you were removed" email to someone who never joined.
    was_connected = contact.status == EmergencyContactStatus.connected

    # Their app is told first (live + push) so it signs out instead of failing on a deleted account.
    if partner_user and partner_user.user_type.value == "partner":
        await partner_sync.tell(None, partner_user.id, "partner_removed", "Connection ended",
                                f"{current_user.name or 'She'} removed you from her support circle.", {}, log=False)

    from app.modules.rides.services.ride_service import forget_contacts
    forget_contacts(current_user.id)

    # 2. Delete EmergencyContact, then 3. the partner account that only existed for it
    await db.delete(contact)
    if partner_user and partner_user.user_type.value == "partner":
        await _delete_partner_account(db, partner_user)

    await db.commit()

    # 4. Dispatch emails (only for a partner who had actually joined)
    inviter_name = current_user.name if current_user.name else "A Loni User"
    if was_connected:
        if current_user.email:
            background_tasks.add_task(send_partner_removal_user_email, current_user.email, partner_name)
        if partner_email:
            background_tasks.add_task(send_partner_removal_partner_email, partner_email, inviter_name)

    return {"success": True, "message": "Contact removed successfully" if was_connected else "Invite revoked"}


DEFAULT_INVITE_MESSAGE = ("I'm using LONI for pregnancy and recovery support. I'd love for you to join my support "
                          "circle so we can stay connected during important moments 💜")


@router.post("/emergency-contacts/{contact_id}/resend-invite", response_model=StandardResponse,
             dependencies=[Depends(limit("partners.resend", 10, 3600, "You've resent several invites. Please try again later."))])
async def resend_partner_invite(
    contact_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send the invite email again to a support partner who hasn't set up their account yet."""
    contact = (await db.execute(
        select(EmergencyContact).where(EmergencyContact.id == contact_id, EmergencyContact.user_id == current_user.id)
        .options(selectinload(EmergencyContact.contact_user))
    )).scalars().first()
    if not contact or not contact.contact_user:
        raise HTTPException(status_code=404, detail="Contact not found")
    if contact.status == EmergencyContactStatus.connected:
        raise HTTPException(status_code=409, detail="They have already accepted your invite.")
    # At most one resend per minute for the same person, so a double tap doesn't send two emails.
    if not await rate_hit(f"partners.resend.contact:{contact.id}", 1, 60):
        raise HTTPException(status_code=429, detail="Invite just sent. Please wait a minute before sending again.")
    background_tasks.add_task(send_partner_invite_email, contact.contact_user.email,
                              current_user.name or "A Loni User", DEFAULT_INVITE_MESSAGE)
    return {"success": True, "message": f"Invite sent again to {contact.contact_user.email}"}

@router.patch("/emergency-contacts/{contact_id}/permissions", response_model=StandardResponse)
async def update_emergency_contact_permissions(
    contact_id: int,
    permissions: UpdateContactPermissions,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from fastapi import HTTPException
    
    stmt = select(EmergencyContact).where(
        EmergencyContact.id == contact_id,
        EmergencyContact.user_id == current_user.id
    )
    result = await db.execute(stmt)
    contact = result.scalars().first()

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found or access denied")

    from app.modules.rides.services.ride_service import forget_contacts
    forget_contacts(current_user.id)
    before = {"location": contact.location, "updates": contact.updates, "emergency": contact.emergency}
    if permissions.location is not None:
        contact.location = permissions.location
    if permissions.updates is not None:
        contact.updates = permissions.updates
    if permissions.emergency is not None:
        contact.emergency = permissions.emergency

    db.add(contact)
    after = {"location": contact.location, "updates": contact.updates, "emergency": contact.emergency}
    changed = {k: v for k, v in after.items() if before[k] != v}

    # Tell the partner (live, push, Notification Centre) so their screens match what she now shares.
    if changed and contact.status == EmergencyContactStatus.connected:
        labels = {"location": "her location", "updates": "pregnancy updates", "emergency": "emergency alerts"}
        first = (current_user.name or "She").split(" ")[0]
        on = [labels[k] for k, v in changed.items() if v]
        off = [labels[k] for k, v in changed.items() if not v]
        parts = ([f"now shares {', '.join(on)}"] if on else []) + ([f"stopped sharing {', '.join(off)}"] if off else [])
        await partner_sync.tell(db, contact.contact_user_id, "partner_sharing_changed", "Sharing updated",
                                f"{first} {' and '.join(parts)} with you.", {"sharing": after})
    await db.commit()
    if changed.get("updates"):
        await partner_sync.send_due_updates(db, current_user, only_partner=contact.contact_user_id)

    return {"success": True, "message": "Permissions updated successfully"}

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)

@router.post("/profile-picture", response_model=StandardResponse)
async def upload_profile_picture(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Upload to Cloudinary securely
    result = await asyncio.to_thread(
        cloudinary.uploader.upload,
        image.file,
        folder="loni/profiles"
    )
    
    current_user.profile_picture = result.get("secure_url") # type: ignore
    db.add(current_user)
    await db.commit()
    return {"success": True, "message": "Profile picture updated"}

@router.post("/upload-document", response_model=StandardResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Upload to Cloudinary securely
    result = await asyncio.to_thread(
        cloudinary.uploader.upload,
        file.file,
        folder="loni/documents"
    )
    
    url = result.get("secure_url")
    return {"success": True, "message": "Document uploaded successfully", "data": {"url": url}}

@router.post("/profile/nurse", response_model=StandardResponse)
async def update_nurse_profile(
    years_of_experience: str = Form(...),
    hospital_affiliation: Optional[str] = Form(None),
    gender: str = Form(...),
    licenseNumber: str = Form(...),
    photo: UploadFile = File(...),
    license: UploadFile = File(...),
    id: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Upload documents to Cloudinary concurrently
    async def upload_single_doc(doc_file: UploadFile):
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            doc_file.file,
            folder="loni/documents"
        )
        return result.get("secure_url")

    photo_url, license_url, id_url = await asyncio.gather(
        upload_single_doc(photo),
        upload_single_doc(license),
        upload_single_doc(id)
    )

    verification_documents = {
        "photo": photo_url,
        "license": license_url,
        "id": id_url,
        "licenseNumber": licenseNumber,
        "gender": gender
    }

    # Check if profile already exists
    stmt = select(NurseProfile).where(NurseProfile.user_id == current_user.id)
    result = await db.execute(stmt)
    profile = result.scalars().first()

    if profile:
        profile.years_of_experience = int(years_of_experience)
        if hospital_affiliation is not None:
            profile.hospital_affiliation = hospital_affiliation
        profile.verification_documents = verification_documents
    else:
        profile = NurseProfile(
            user_id=current_user.id,
            years_of_experience=int(years_of_experience),
            hospital_affiliation=hospital_affiliation or "",
            verification_documents=verification_documents
        )
        db.add(profile)
    
    current_user.user_type = UserTypeEnum.nurse
    current_user.gender = gender
    db.add(current_user)
    from app.modules.admin.notify import notify_admins
    notify_admins(db, kind="nurse_application", permission="nurses.view", link=f"/nurses?open={current_user.id}",
                  title="Nurse application received",
                  body=f"{current_user.name} submitted credentials for review.")
    await db.commit()
    return {"success": True, "message": "Nurse profile updated"}

@router.post("/profile/driver", response_model=StandardResponse, deprecated=True)
async def update_driver_profile(
    vehicle_type: str = Form(...),
    has_ac: str = Form(...),
    vehicle_brand: str = Form(...),
    vehicle_year: str = Form(...),
    vehicle_model: str = Form(...),
    plate_number: str = Form(...),
    vehicle_color: str = Form(...),
    front_view: UploadFile = File(...),
    back_view: UploadFile = File(...),
    vin: UploadFile = File(...),
    interior: UploadFile = File(...),
    driver_license: UploadFile = File(...),
    government_id: UploadFile = File(...),
    vehicle_papers: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    **Deprecated** - single-shot multipart submit of the whole driver profile.
    Use the incremental steps instead: `PATCH /users/profile/driver/personal`
    -> `/vehicle` -> `/documents` -> `POST /users/profile/driver/submit`.
    Still gated on training + aptitude being complete.
    """
    # Training + aptitude must be complete before a driver profile can be filed.
    status = await build_status(db, current_user)
    require_step(status, "personal")

    # Upload documents to Cloudinary concurrently
    async def upload_single_doc(doc_file: UploadFile):
        result = await asyncio.to_thread(
            cloudinary.uploader.upload,
            doc_file.file,
            folder="loni/documents"
        )
        return result.get("secure_url")

    urls = await asyncio.gather(
        upload_single_doc(front_view),
        upload_single_doc(back_view),
        upload_single_doc(vin),
        upload_single_doc(interior),
        upload_single_doc(driver_license),
        upload_single_doc(government_id),
        upload_single_doc(vehicle_papers)
    )

    verification_documents = {
        "front_view": urls[0],
        "back_view": urls[1],
        "vin": urls[2],
        "interior": urls[3],
        "driver_license": urls[4],
        "government_id": urls[5],
        "vehicle_papers": urls[6]
    }

    has_ac_bool = has_ac.lower() == 'true'

    # Check if profile already exists
    stmt = select(DriverProfile).where(DriverProfile.user_id == current_user.id)
    result = await db.execute(stmt)
    profile = result.scalars().first()

    if profile:
        profile.vehicle_type = vehicle_type
        profile.has_ac = has_ac_bool
        profile.vehicle_brand = vehicle_brand
        profile.vehicle_year = vehicle_year
        profile.vehicle_model = vehicle_model
        profile.plate_number = plate_number
        profile.vehicle_color = vehicle_color
        profile.verification_documents = verification_documents
    else:
        profile = DriverProfile(
            user_id=current_user.id,
            vehicle_type=vehicle_type,
            has_ac=has_ac_bool,
            vehicle_brand=vehicle_brand,
            vehicle_year=vehicle_year,
            vehicle_model=vehicle_model,
            plate_number=plate_number,
            vehicle_color=vehicle_color,
            verification_documents=verification_documents
        )
        db.add(profile)

    current_user.user_type = UserTypeEnum.driver
    if profile.full_name is None:
        profile.full_name = current_user.name
    if profile.profile_photo is None:
        profile.profile_photo = current_user.profile_picture
    profile.submitted_at = datetime.now(timezone.utc)
    db.add(current_user)
    await db.commit()
    return {"success": True, "message": "Driver profile updated"}


async def _get_driver_profile_or_start(db: AsyncSession, user: User) -> DriverProfile:
    result = await db.execute(select(DriverProfile).where(DriverProfile.user_id == user.id))
    profile = result.scalars().first()
    if profile is None:
        profile = DriverProfile(user_id=user.id, verification_documents={})
        db.add(profile)
        await db.flush()
    if user.user_type == UserTypeEnum.user:
        user.user_type = UserTypeEnum.driver
        db.add(user)
    return profile


_ONBOARDING_STEP_RESPONSES = {
    403: {"description": "An earlier onboarding step is not complete yet"},
    400: {"description": "Required data missing from the payload"},
}


@router.patch(
    "/profile/driver/personal",
    response_model=StandardResponse,
    responses=_ONBOARDING_STEP_RESPONSES,
)
async def update_driver_personal_info(
    data: DriverPersonalInfoRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Driver onboarding step 3 - personal info. Upload the photo first via
    `POST /users/profile-picture` (or pass `profile_photo` as a URL). Requires
    training + the aptitude test to be complete. `data` is the refreshed
    onboarding status.
    """
    status = await build_status(db, current_user)
    require_step(status, "personal")

    profile = await _get_driver_profile_or_start(db, current_user)
    photo = data.profile_photo or current_user.profile_picture or profile.profile_photo
    if not photo:
        raise HTTPException(status_code=400, detail="A profile photo is required")

    profile.full_name = data.full_name
    profile.date_of_birth = data.date_of_birth
    profile.profile_photo = photo

    current_user.name = data.full_name
    if data.profile_photo:
        current_user.profile_picture = data.profile_photo
    db.add(profile)
    db.add(current_user)
    await db.commit()
    return {"success": True, "message": "Personal information saved", "data": await build_status(db, current_user)}


@router.patch(
    "/profile/driver/vehicle",
    response_model=StandardResponse,
    responses=_ONBOARDING_STEP_RESPONSES,
)
async def update_driver_vehicle_info(
    data: DriverVehicleInfoRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Driver onboarding step 4 - vehicle details and the 4 vehicle photos
    (upload each via `POST /users/upload-document` and pass back the URLs).
    Requires the personal step. `data` is the refreshed onboarding status.
    """
    status = await build_status(db, current_user)
    require_step(status, "vehicle")

    profile = await _get_driver_profile_or_start(db, current_user)
    profile.vehicle_type = data.vehicle_type
    profile.has_ac = data.has_ac
    profile.vehicle_brand = data.vehicle_brand
    profile.vehicle_year = data.vehicle_year
    profile.vehicle_model = data.vehicle_model
    profile.plate_number = data.plate_number
    profile.vehicle_color = data.vehicle_color

    docs = dict(profile.verification_documents or {})
    docs.update({
        "front_view": data.front_view,
        "back_view": data.back_view,
        "vin": data.vin,
        "interior": data.interior,
    })
    profile.verification_documents = docs
    db.add(profile)
    await db.commit()
    return {"success": True, "message": "Vehicle information saved", "data": await build_status(db, current_user)}


@router.patch(
    "/profile/driver/documents",
    response_model=StandardResponse,
    responses=_ONBOARDING_STEP_RESPONSES,
)
async def update_driver_documents(
    data: DriverDocumentsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Driver onboarding step 5 - licence, government ID and vehicle papers
    (upload each via `POST /users/upload-document`, pass back the URLs). Then
    call `POST /users/profile/driver/submit`. Requires the vehicle step.
    """
    status = await build_status(db, current_user)
    require_step(status, "documents")

    profile = await _get_driver_profile_or_start(db, current_user)
    docs = dict(profile.verification_documents or {})
    docs.update({
        "driver_license": data.driver_license,
        "government_id": data.government_id,
        "vehicle_papers": data.vehicle_papers,
    })
    profile.verification_documents = docs
    db.add(profile)
    await db.commit()
    return {"success": True, "message": "Documents saved", "data": await build_status(db, current_user)}


@router.post(
    "/profile/driver/submit",
    response_model=StandardResponse,
    responses={403: {"description": "One or more onboarding steps are still incomplete"}},
)
async def submit_driver_application(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Finalize the driver application and send it for review (sets
    `submitted_at`, moves `current_step` to `under_review`). Every prior step
    must be complete. Idempotent - a second call just returns the status.
    """
    status = await build_status(db, current_user)
    if status["submitted"]:
        return {"success": True, "message": "Application already submitted", "data": status}
    if not status["can_submit"]:
        incomplete = next((s["label"] for s in status["steps"] if not s["complete"]), "a required step")
        raise HTTPException(status_code=403, detail=f"Cannot submit yet - {incomplete} is not complete")

    result = await db.execute(select(DriverProfile).where(DriverProfile.user_id == current_user.id))
    profile = result.scalars().first()
    profile.submitted_at = datetime.now(timezone.utc)
    current_user.user_type = UserTypeEnum.driver
    db.add(profile)
    db.add(current_user)
    from app.modules.admin.notify import notify_admins
    notify_admins(db, kind="driver_application", permission="drivers.view", link=f"/drivers?open={current_user.id}",
                  title="Driver application received",
                  body=f"{current_user.name} submitted their application for review.")
    await db.commit()
    return {"success": True, "message": "Application submitted for review", "data": await build_status(db, current_user)}


@router.patch("/online-status", response_model=StandardResponse)
async def toggle_online_status(
    data: ToggleOnlineRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Toggle the nurse or driver's online status.
    Pass `is_online: true` to go online, `false` to go offline.
    """
    if current_user.user_type not in [UserTypeEnum.nurse, UserTypeEnum.driver]:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=403, detail="Only nurses and drivers can toggle online status")
    
    current_user.is_online = data.is_online
    db.add(current_user)
    await db.commit()
    return {
        "success": True,
        "message": f"You are now {'online' if data.is_online else 'offline'}",
        "data": {"is_online": data.is_online}
    }

@router.patch("/profile", response_model=StandardResponse)
async def update_my_profile(
    data: UpdateUserProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update the current user's basic profile details (name, phone, gender).
    """
    if data.name is not None:
        current_user.name = data.name
    if data.phone is not None:
        current_user.phone = data.phone
    if data.gender is not None:
        current_user.gender = data.gender
    
    db.add(current_user)
    await db.commit()
    return {"success": True, "message": "Profile updated successfully"}

@router.patch("/nurse-profile", response_model=StandardResponse)
async def update_nurse_profile(
    data: UpdateNurseProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update the current nurse's profile details including name, phone,
    hospital affiliation, and years of experience.
    """
    if current_user.user_type != UserTypeEnum.nurse:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=403, detail="Only nurses can update nurse profile")
    
    # Update base user fields
    if data.name is not None:
        current_user.name = data.name
    if data.phone is not None:
        current_user.phone = data.phone
    db.add(current_user)
    
    # Update nurse-specific fields
    result = await db.execute(
        select(NurseProfile).where(NurseProfile.user_id == current_user.id)
    )
    nurse_profile = result.scalar_one_or_none()
    
    if nurse_profile:
        if data.hospital_affiliation is not None:
            nurse_profile.hospital_affiliation = data.hospital_affiliation
        if data.years_of_experience is not None:
            nurse_profile.years_of_experience = data.years_of_experience
        if data.license_number is not None and data.license_number.strip():
            # Reassign (not mutate) so SQLAlchemy sees the JSON column change.
            docs = dict(nurse_profile.verification_documents or {})
            docs["licenseNumber"] = data.license_number.strip()
            nurse_profile.verification_documents = docs
        db.add(nurse_profile)
    
    await db.commit()
    return {"success": True, "message": "Nurse profile updated successfully"}

