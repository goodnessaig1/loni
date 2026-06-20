from fastapi import APIRouter, Depends, UploadFile, File
import cloudinary
import cloudinary.uploader
import asyncio
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.modules.users.models import User, EmergencyContact
from app.modules.auth.schemas import (
    StandardResponse, UpdateProfileRequest, AddPhoneRequest, 
    VerifyPhoneRequest, EmergencyContactsRequest
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

@router.post("/emergency-contacts", response_model=StandardResponse)
async def emergency_contacts(
    data: EmergencyContactsRequest, 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    for contact in data.contacts:
        new_contact = EmergencyContact(
            user_id=current_user.id,
            name=contact.name,
            phone=contact.phone,
            relationship=contact.relationship
        )
        db.add(new_contact)
    await db.commit()
    return {"success": True, "message": "Emergency contacts saved"}

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
