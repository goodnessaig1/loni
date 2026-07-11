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
    call: Optional[CallResponse] = None

class CallHistoryFilter(BaseModel):
    limit: int = 20
    offset: int = 0
