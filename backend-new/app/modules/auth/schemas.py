from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from enum import Enum

class StatusEnum(str, Enum):
    pregnant = "pregnant"
    newMom = "newMom"

class GenderEnum(str, Enum):
    Male = "Male"
    Female = "Female"
    Others = "Others"

class UserTypeEnum(str, Enum):
    nurse = "nurse"
    user = "user"
    rider = "rider"
    admin = "admin"

class OtpTypeEnum(str, Enum):
    email_verification = "email_verification"
    phone_verification = "phone_verification"
    reset_password = "reset_password"

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    password: str = Field(..., min_length=8)
    status: StatusEnum
    trimester: Optional[str] = None
    pregnancyWeek: Optional[str] = None
    babyAge: Optional[str] = None
    referredBy: Optional[str] = None
    gender: Optional[GenderEnum] = None
    userType: Optional[UserTypeEnum] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)

class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=4, max_length=6)
    type: OtpTypeEnum

class ResendOtpRequest(BaseModel):
    email: EmailStr
    type: OtpTypeEnum

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=4, max_length=6)
    newPassword: str = Field(..., min_length=8)

class AddPhoneRequest(BaseModel):
    phone: str = Field(..., min_length=10)

class VerifyPhoneRequest(BaseModel):
    otp: str = Field(..., min_length=4, max_length=6)

class EmergencyContactItem(BaseModel):
    name: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=1)
    email: EmailStr
    relationship: str = Field(..., min_length=1)
    message: Optional[str] = None

class EmergencyContactsRequest(BaseModel):
    contacts: List[EmergencyContactItem]

class InvitePartnerRequest(BaseModel):
    fullname: str = Field(..., min_length=1)
    email: EmailStr
    message: str

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    status: Optional[StatusEnum] = None
    trimester: Optional[str] = None
    pregnancyWeek: Optional[str] = None
    babyAge: Optional[str] = None
    gender: Optional[GenderEnum] = None
    userType: Optional[UserTypeEnum] = None

class TokenResponse(BaseModel):
    success: bool = True
    data: dict

class StandardResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: Optional[dict] = None
