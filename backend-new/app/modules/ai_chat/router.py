from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
from app.modules.users.models import User
from typing import Optional
from app.api.deps import get_current_user
from app.modules.staff.deps import StaffContext, require_permission
from pydantic import BaseModel, Field
from app.modules.ai_chat import schemas, service
from app.core.ratelimit import limit

router = APIRouter()

@router.post("/sessions", response_model=schemas.StandardChatResponse)
async def create_session(
    data: schemas.ChatSessionCreate,
    current_user: User = Depends(get_current_user)
):
    session = await service.create_chat_session(current_user.id, data.title)
    return {"success": True, "message": "Session created", "data": {"session": session}}

@router.get("/sessions", response_model=schemas.StandardChatResponse)
async def list_sessions(
    current_user: User = Depends(get_current_user)
):
    sessions = await service.get_user_sessions(current_user.id)
    return {"success": True, "data": {"sessions": sessions}}

@router.get("/sessions/{session_id}/messages", response_model=schemas.StandardChatResponse)
async def get_messages(
    session_id: str,
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(get_current_user)
):
    # Optional: Validate session belongs to user
    sessions = await service.get_user_sessions(current_user.id)
    if not any(s["id"] == session_id for s in sessions):
        raise HTTPException(status_code=403, detail="Not authorized to access this session")
        
    messages = await service.get_session_messages(session_id, limit=limit, skip=skip)
    return {"success": True, "data": {"messages": messages}}

@router.delete("/sessions/{session_id}", response_model=schemas.StandardChatResponse)
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user)
):
    deleted = await service.delete_chat_session(session_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True, "message": "Session deleted"}

@router.delete("/sessions", response_model=schemas.StandardChatResponse)
async def clear_all_sessions(
    current_user: User = Depends(get_current_user)
):
    await service.clear_user_sessions(current_user.id)
    return {"success": True, "message": "All sessions cleared"}

@router.put("/sessions/{session_id}", response_model=schemas.StandardChatResponse)
async def update_session_title(
    session_id: str,
    data: schemas.ChatSessionCreate,
    current_user: User = Depends(get_current_user)
):
    updated = await service.update_chat_session_title(session_id, current_user.id, data.title)
    if not updated:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True, "message": "Session updated"}

@router.post("/sessions/{session_id}/messages", dependencies=[Depends(limit("ai.message", 30, 60, "You're sending messages very quickly. Please wait a moment."))])
async def send_message(
    session_id: str,
    data: schemas.ChatMessageRequest,
    current_user: User = Depends(get_current_user)
):
    # Optional: Validate session belongs to user
    sessions = await service.get_user_sessions(current_user.id)
    if not any(s["id"] == session_id for s in sessions):
        raise HTTPException(status_code=403, detail="Not authorized to access this session")
        
    return StreamingResponse(
        service.stream_chat_message(session_id, current_user.id, data.content, current_user),
        media_type="text/event-stream"
    )


# ── Human review of high-risk conversations (admins only) ────────────────────────────────────────────
# The audit trail stores what was decided and why, never the mother's words. A reviewer who needs the
# conversation opens it deliberately from here, which is limited to admins.

class ReviewIn(BaseModel):
    note: Optional[str] = Field(None, max_length=1000)


@router.get("/admin/safety-events")
async def list_safety_events(needs_review: bool = True, limit: int = 50, skip: int = 0, admin: StaffContext = Depends(require_permission("ai_safety.review"))):
    events = await service.list_safety_events(needs_review, min(max(limit, 1), 200), max(skip, 0))
    return {"success": True, "data": {"events": events}}


@router.get("/admin/safety-events/{event_id}/conversation")
async def safety_event_conversation(event_id: str, admin: StaffContext = Depends(require_permission("ai_safety.review"))):
    event = await service.get_safety_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    messages = await service.get_session_messages(event["session_id"])
    return {"success": True, "data": {"event": event, "messages": messages}}


@router.post("/admin/safety-events/{event_id}/review")
async def review_safety_event(event_id: str, data: ReviewIn, admin: StaffContext = Depends(require_permission("ai_safety.review"))):
    if not await service.mark_safety_event_reviewed(event_id, admin.id, data.note):
        raise HTTPException(status_code=404, detail="Event not found")
    return {"success": True, "message": "Marked as reviewed"}
