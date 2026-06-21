from fastapi import APIRouter, Depends, UploadFile, File
import cloudinary
import cloudinary.uploader
import asyncio
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.security import verify_password, get_password_hash
from app.modules.users.schemas import UserResponse, UpdateContactPermissions, ChangePasswordRequest
from app.core.database import get_db
from app.api.deps import get_current_user
from app.modules.users.models import User, EmergencyContact
from app.modules.auth.schemas import (
    StandardResponse, UpdateProfileRequest, AddPhoneRequest, 
    VerifyPhoneRequest, EmergencyContactsRequest, InvitePartnerRequest
)
from app.modules.auth.email_service import (
    send_partner_invite_email,
    send_partner_removal_user_email,
    send_partner_removal_partner_email
)
from app.utils.user_enrichment import enrich_user_data, calculate_pregnancy_start_date

router = APIRouter()

@router.get("/me", response_model=StandardResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    user_data = enrich_user_data(current_user)
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
        asyncio.create_task(send_partner_invite_email(contact.email, inviter_name, message))

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

@router.post("/invite-partner", response_model=StandardResponse)
async def invite_partner(
    data: InvitePartnerRequest,
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
    asyncio.create_task(send_partner_invite_email(data.email, inviter_name, data.message))
    
    return {"success": True, "message": "Partner invited successfully"}

@router.delete("/emergency-contacts/{contact_id}", response_model=StandardResponse)
async def remove_emergency_contact(
    contact_id: int,
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
    
    # 2. Delete EmergencyContact
    await db.delete(contact)
    
    # 3. Delete partner User account
    if partner_user and partner_user.user_type.value == "partner":
        await db.delete(partner_user)
        
    await db.commit()

    # 4. Dispatch emails
    inviter_name = current_user.name if current_user.name else "A Loni User"
    if current_user.email:
        asyncio.create_task(send_partner_removal_user_email(current_user.email, partner_name))
    if partner_email:
        asyncio.create_task(send_partner_removal_partner_email(partner_email, inviter_name))

    return {"success": True, "message": "Contact removed successfully"}

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

    if permissions.location is not None:
        contact.location = permissions.location
    if permissions.updates is not None:
        contact.updates = permissions.updates
    if permissions.emergency is not None:
        contact.emergency = permissions.emergency

    db.add(contact)
    await db.commit()

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
