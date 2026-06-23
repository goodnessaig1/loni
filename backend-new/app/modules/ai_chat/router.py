from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
from app.modules.users.models import User
from app.api.deps import get_current_user
from app.modules.ai_chat import schemas, service

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
    current_user: User = Depends(get_current_user)
):
    # Optional: Validate session belongs to user
    sessions = await service.get_user_sessions(current_user.id)
    if not any(s["id"] == session_id for s in sessions):
        raise HTTPException(status_code=403, detail="Not authorized to access this session")
        
    messages = await service.get_session_messages(session_id)
    return {"success": True, "data": {"messages": messages}}

@router.post("/sessions/{session_id}/messages")
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
        service.stream_chat_message(session_id, current_user.id, data.content),
        media_type="text/event-stream"
    )
