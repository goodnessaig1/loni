from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    status: str
    phone: Optional[str]
    gender: str
    user_type: str
    is_email_verified: bool
    is_phone_verified: bool
    profile_picture: Optional[str]
    referral_code: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class UpdateContactPermissions(BaseModel):
    location: Optional[bool] = None
    updates: Optional[bool] = None
    emergency: Optional[bool] = None

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
