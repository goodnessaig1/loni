from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.modules.users.models import User
from app.modules.calls.schemas import CallRequest, CallResponse, CallActionResponse, CallHistoryFilter
from app.modules.calls.services.call_service import CallService
from app.modules.calls.services.livekit_service import LiveKitService

router = APIRouter()

@router.post("/request", response_model=CallResponse)
async def request_call(
    request: CallRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mother requests a call.
    """
    call = await CallService.request_call(db, str(current_user.id), request)
    return call

@router.post("/{call_id}/accept", response_model=CallActionResponse)
async def accept_call(
    call_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Nurse accepts a call. Handles race conditions internally.
    """
    # Accept the call (throws 400 if already accepted)
    call = await CallService.accept_call(db, call_id, str(current_user.id))
    
    # Generate token for Nurse to join
    token = LiveKitService.create_token(
        room_name=call.room_name,
        participant_identity=str(current_user.id),
        participant_name=current_user.name or "Nurse"
    )
    
    return CallActionResponse(success=True, message="Call accepted", token=token, call=call)

@router.post("/{call_id}/join", response_model=CallActionResponse)
async def join_call(
    call_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Called by Mother to get her token after Nurse accepts, or vice-versa.
    """
    from sqlalchemy.future import select
    from app.modules.calls.models import Call
    
    stmt = select(Call).where(Call.id == call_id)
    result = await db.execute(stmt)
    call = result.scalar_one_or_none()
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
        
    token = LiveKitService.create_token(
        room_name=call.room_name,
        participant_identity=str(current_user.id),
        participant_name=current_user.name or "Participant"
    )
    
    return CallActionResponse(success=True, message="Token generated", token=token, call=call)

@router.post("/{call_id}/reject", response_model=CallActionResponse)
async def reject_call(
    call_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    call = await CallService.reject_call(db, call_id, str(current_user.id))
    return CallActionResponse(success=True, message="Call rejected", call=call)

@router.post("/{call_id}/end", response_model=CallActionResponse)
async def end_call(
    call_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    call = await CallService.end_call(db, call_id, str(current_user.id))
    return CallActionResponse(success=True, message="Call ended", call=call)
