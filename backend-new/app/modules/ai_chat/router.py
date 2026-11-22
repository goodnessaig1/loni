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
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

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

@router.post("/sessions/{session_id}/messages/{message_id}/feedback", response_model=schemas.StandardChatResponse)
async def message_feedback(
    session_id: str,
    message_id: str,
    data: schemas.MessageFeedback,
    current_user: User = Depends(get_current_user)
):
    """'Was this helpful?' on one of Loni's answers. Stores the rating and a fixed reason code, never text."""
    if data.reason is not None and data.reason not in schemas.FEEDBACK_REASONS:
        raise HTTPException(status_code=422, detail="Unknown reason")
    sessions = await service.get_user_sessions(current_user.id)
    if not any(s["id"] == session_id for s in sessions):
        raise HTTPException(status_code=403, detail="Not authorized to access this session")
    if not await service.record_feedback(current_user.id, session_id, message_id, data.helpful, data.reason):
        raise HTTPException(status_code=404, detail="Message not found")
    return {"success": True, "message": "Thanks for the feedback"}


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


# ── Nurse handoff: she chooses to share a short summary with the nurse she calls ────────────────────

class HandoffIn(BaseModel):
    session_id: Optional[str] = None
    include_messages: bool = False
    consent: bool = False


async def _own_session(user_id: str, session_id: Optional[str]):
    if session_id and not any(s["id"] == session_id for s in await service.get_user_sessions(user_id)):
        raise HTTPException(status_code=403, detail="Not authorized to access this session")


@router.post("/handoffs/preview")
async def preview_handoff(data: HandoffIn, current_user: User = Depends(get_current_user)):
    """Exactly what the nurse would see. Nothing is stored or shared."""
    await _own_session(current_user.id, data.session_id)
    return {"success": True, "data": await service.preview_handoff(current_user, data.session_id, data.include_messages)}


@router.post("/handoffs", dependencies=[Depends(limit("ai.handoff", 10, 3600))])
async def share_handoff(data: HandoffIn, current_user: User = Depends(get_current_user)):
    if not data.consent:
        raise HTTPException(status_code=400, detail="Sharing needs your consent")
    await _own_session(current_user.id, data.session_id)
    return {"success": True, "message": "Shared. A nurse will see it when they take your call.",
            "data": await service.share_handoff(current_user, data.session_id, data.include_messages)}


@router.get("/handoffs/mine")
async def my_handoffs(current_user: User = Depends(get_current_user)):
    return {"success": True, "data": {"handoffs": await service.my_handoffs(current_user.id)}}


@router.delete("/handoffs/{handoff_id}")
async def withdraw_handoff(handoff_id: str, current_user: User = Depends(get_current_user)):
    if not await service.withdraw_handoff(current_user.id, handoff_id):
        raise HTTPException(status_code=404, detail="Not found")
    return {"success": True, "message": "Withdrawn"}


@router.get("/handoffs/patient/{mother_id}")
async def nurse_reads_handoff(mother_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """For a nurse who was on a call with her (either direction) in the last 24h only. Opening it marks it viewed."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select
    from app.modules.calls.models import Call
    from app.modules.users.models import UserTypeEnum
    if current_user.user_type != UserTypeEnum.nurse:
        raise HTTPException(status_code=403, detail="Nurses only")
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    from sqlalchemy import and_, or_
    on_call = or_(and_(Call.caller_id == mother_id, Call.receiver_id == current_user.id),
                  and_(Call.caller_id == current_user.id, Call.receiver_id == mother_id))   # she called, or the nurse called back
    call = (await db.execute(select(Call.id).where(on_call, Call.created_at >= since).limit(1))).first()
    if call is None:
        raise HTTPException(status_code=403, detail="Only the nurse on her call can read this")
    return {"success": True, "data": {"handoffs": await service.handoffs_for_nurse(current_user.id, mother_id)}}
