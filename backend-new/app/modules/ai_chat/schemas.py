from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ChatSessionCreate(BaseModel):
    title: Optional[str] = "New Chat"

class ChatSessionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime

class ChatMessageRequest(BaseModel):
    content: str = Field(..., min_length=1)

class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    created_at: datetime

class StandardChatResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    data: Optional[dict] = None


FEEDBACK_REASONS = ("helpful", "not_helpful", "misunderstood", "too_long", "too_short", "unclear", "felt_supported", "not_supported")


class MessageFeedback(BaseModel):
    """Her rating of one Loni answer. A fixed reason code, never free text, so no health detail lands in analytics."""
    helpful: bool
    reason: Optional[str] = Field(None, description="One of: " + ", ".join(FEEDBACK_REASONS))
