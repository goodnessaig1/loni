from pydantic import BaseModel, EmailStr
from typing import Literal, Optional
from datetime import datetime

class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    status: Optional[str] = None
    account_status: str
    phone: Optional[str] = None
    gender: str
    user_type: str
    is_email_verified: bool
    is_phone_verified: bool
    profile_picture: Optional[str] = None
    referral_code: Optional[str] = None
    is_online: bool = False
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

class NurseProfileRequest(BaseModel):
    years_of_experience: Optional[int] = None
    hospital_affiliation: Optional[str] = None
    gender: Optional[str] = None
    verification_documents: Optional[dict] = None

class DriverProfileRequest(BaseModel):
    vehicle_type: Optional[str] = None
    has_ac: Optional[bool] = None
    vehicle_brand: Optional[str] = None
    vehicle_year: Optional[str] = None
    vehicle_model: Optional[str] = None
    plate_number: Optional[str] = None
    vehicle_color: Optional[str] = None
    verification_documents: Optional[dict] = None

class ToggleOnlineRequest(BaseModel):
    is_online: bool


# --- Incremental driver onboarding steps (JSON, files uploaded separately) ---
class DriverPersonalInfoRequest(BaseModel):
    full_name: str
    date_of_birth: str
    profile_photo: Optional[str] = None  # falls back to the user's profile picture


class DriverVehicleInfoRequest(BaseModel):
    vehicle_type: str
    has_ac: bool
    vehicle_brand: str
    vehicle_year: str
    vehicle_model: str
    plate_number: str
    vehicle_color: str
    front_view: str
    back_view: str
    vin: str
    interior: str


class DriverDocumentsRequest(BaseModel):
    driver_license: str
    government_id: str
    vehicle_papers: str

class UpdateUserProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None

class UpdateStageRequest(BaseModel):
    """Any combination: switch `status`, or pick a `trimester` (pregnant) / `recovery_stage` (postpartum)."""
    status: Optional[Literal['pregnant', 'newMom', 'ttc', 'general']] = None
    trimester: Optional[Literal[1, 2, 3]] = None
    recovery_stage: Optional[Literal['early', 'active', 'extended']] = None


class UpdateNurseProfileRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    hospital_affiliation: Optional[str] = None
    years_of_experience: Optional[int] = None
    license_number: Optional[str] = None
