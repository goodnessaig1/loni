from fastapi import APIRouter, Depends, UploadFile, File, BackgroundTasks, Form, HTTPException
from typing import Optional
from datetime import datetime, timezone
import cloudinary
import cloudinary.uploader
import asyncio
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.core.security import verify_password, get_password_hash
from app.modules.users.schemas import (
    UpdateContactPermissions, ChangePasswordRequest,
    ToggleOnlineRequest, UpdateNurseProfileRequest, UpdateUserProfileRequest,
    DriverPersonalInfoRequest, DriverVehicleInfoRequest, DriverDocumentsRequest
)
from app.modules.driver_training.onboarding import build_status, require_step
from app.core.database import get_db
from app.api.deps import get_current_user
from app.modules.users.models import User, EmergencyContact, NurseProfile, DriverProfile, UserTypeEnum
from app.modules.auth.schemas import (
    StandardResponse, UpdateProfileRequest,
    EmergencyContactsRequest, InvitePartnerRequest
)
from app.modules.auth.email_service import (
    send_partner_invite_email,
    send_partner_removal_user_email,
    send_partner_removal_partner_email
)
from app.utils.user_enrichment import enrich_user_data, calculate_pregnancy_start_date

router = APIRouter()

@router.get("/me", response_model=StandardResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_data = enrich_user_data(current_user)
    if current_user.user_type == UserTypeEnum.driver:
        # Lets the app resume the signup flow at the right step on every launch.
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
    
    # 2. Delete EmergencyContact
    await db.delete(contact)
    
    # 3. Delete partner User account
    if partner_user and partner_user.user_type.value == "partner":
        await db.delete(partner_user)
        
    await db.commit()

    # 4. Dispatch emails
    inviter_name = current_user.name if current_user.name else "A Loni User"
    if current_user.email:
        background_tasks.add_task(send_partner_removal_user_email, current_user.email, partner_name)
    if partner_email:
        background_tasks.add_task(send_partner_removal_partner_email, partner_email, inviter_name)

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
    await db.commit()
    return {"success": True, "message": "Nurse profile updated"}

@router.post("/profile/driver", response_model=StandardResponse)
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


@router.patch("/profile/driver/personal", response_model=StandardResponse)
async def update_driver_personal_info(
    data: DriverPersonalInfoRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 3 - personal info. Requires training + aptitude to be done."""
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


@router.patch("/profile/driver/vehicle", response_model=StandardResponse)
async def update_driver_vehicle_info(
    data: DriverVehicleInfoRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 4 - vehicle info. Requires the personal step to be done."""
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


@router.patch("/profile/driver/documents", response_model=StandardResponse)
async def update_driver_documents(
    data: DriverDocumentsRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Step 5 - documents. Requires the vehicle step to be done."""
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


@router.post("/profile/driver/submit", response_model=StandardResponse)
async def submit_driver_application(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Finalize the driver application. Every prior step must be complete."""
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
        db.add(nurse_profile)
    
    await db.commit()
    return {"success": True, "message": "Nurse profile updated successfully"}

