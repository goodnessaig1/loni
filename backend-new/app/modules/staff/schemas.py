from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.modules.staff.models import StaffStatusEnum


# ── sign-in ──────────────────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class ChallengeOut(BaseModel):
    challenge_token: str
    method: str                  # 'email' | 'totp'
    methods: List[str]           # what the person may switch to
    email_hint: str              # "se•••@lonimum.com"
    expires_in: int


class VerifyRequest(BaseModel):
    challenge_token: str = Field(..., min_length=10, max_length=200)
    code: str = Field(..., min_length=6, max_length=8)


class ChallengeRequest(BaseModel):
    challenge_token: str = Field(..., min_length=10, max_length=200)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=10, max_length=200)


class TokensOut(BaseModel):
    access_token: str
    access_expires_in: int
    refresh_token: Optional[str] = None  # null = keep the one you have (a parallel refresh already rotated it)
    session_expires_at: datetime
    token_type: str = "bearer"


# ── accounts ─────────────────────────────────────────────────────────────────────────────────

class RoleBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class StaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    name: str
    status: StaffStatusEnum
    is_super_admin: bool
    role: Optional[RoleBrief] = None
    totp_enabled: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    phone: Optional[str] = None
    timezone: Optional[str] = None
    avatar_url: Optional[str] = None


class ProfileIn(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    phone: Optional[str] = Field(None, max_length=30)
    timezone: Optional[str] = Field(None, max_length=60)


class MeOut(StaffOut):
    permissions: List[str]


class InviteStaffRequest(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=120)
    role_id: int

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str) -> str:
        return " ".join(v.split())


class UpdateStaffRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    role_id: Optional[int] = None
    status: Optional[StaffStatusEnum] = None


class TokenRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=200)


class SetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=200)
    password: str = Field(..., min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., max_length=128)
    new_password: str = Field(..., max_length=128)


class TotpSetupOut(BaseModel):
    secret: str
    otpauth_uri: str


class CodeRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=8)


class DisableTotpRequest(BaseModel):
    password: str = Field(..., max_length=128)
    code: str = Field(..., min_length=6, max_length=8)


# ── roles ────────────────────────────────────────────────────────────────────────────────────

class PermissionOut(BaseModel):
    key: str
    group: str
    label: str
    description: str


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: Optional[str] = None
    permissions: List[str]
    staff_count: int = 0
    created_at: datetime
    updated_at: datetime


class RoleIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    description: Optional[str] = Field(None, max_length=255)
    permissions: List[str] = Field(default_factory=list, max_length=100)


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=80)
    description: Optional[str] = Field(None, max_length=255)
    permissions: Optional[List[str]] = Field(None, max_length=100)


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    staff_id: Optional[str] = None
    staff_name: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: datetime
