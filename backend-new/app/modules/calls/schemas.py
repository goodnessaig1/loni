from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.modules.calls.models import CallStatusEnum, ParticipantRoleEnum


class CallRequest(BaseModel):
    # If nurse_id is provided, calls specific nurse. Else calls all available.
    nurse_id: Optional[str] = None


class CallParticipantSchema(BaseModel):
    user_id: str
    role: ParticipantRoleEnum
    joined_at: Optional[datetime] = None
    left_at: Optional[datetime] = None


class ParticipantInfo(BaseModel):
    """
    Everything the *other* side of a call needs to render participant info
    (Issue 6, Issue 7). Built from `user_enrichment.enrich_user_data`, which
    already computes trimester / pregnancy week - it just wasn't being
    reused by the calls module before.
    """
    id: str
    name: str
    user_type: Optional[str] = None
    profile_picture: Optional[str] = None
    # Mother-specific
    trimester: Optional[str] = None
    pregnancy_week: Optional[str] = None
    # Nurse-specific
    hospital_affiliation: Optional[str] = None
    years_of_experience: Optional[int] = None


class CallResponse(BaseModel):
    id: int
    caller_id: str
    receiver_id: Optional[str] = None
    status: CallStatusEnum
    room_name: str
    started_at: Optional[datetime] = None
    answered_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: int
    created_at: datetime

    class Config:
        from_attributes = True


class CallActionResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    livekit_url: Optional[str] = None
    call: Optional[CallResponse] = None
    # The *other* participant's info (Issue 6, Issue 7) - who to display
    # depends on who's asking, so this is resolved server-side per request
    # rather than trying to eagerly nest both sides on every Call row.
    participant: Optional[ParticipantInfo] = None


class CallHistoryFilter(BaseModel):
    limit: int = 20
    offset: int = 0
