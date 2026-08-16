from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user
from app.modules.users.models import User
from app.modules.calls.schemas import CallRequest, CallResponse, CallActionResponse, CallRatingRequest, CallHistoryFilter, CallStatsResponse
from app.modules.calls.services.call_service import CallService, _participant_info
from app.modules.calls.services.livekit_service import LiveKitService
from app.modules.calls.services.call_stats import get_user_call_stats

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
    Nurse accepts a call. Handles race conditions internally, creates the
    LiveKit room, and notifies the caller instantly over WebSocket (with
    push as a backgrounded-app fallback).
    """
    call, caller_info = await CallService.accept_call(db, call_id, str(current_user.id))

    token = LiveKitService.create_token(
        room_name=call.room_name,
        participant_identity=str(current_user.id),
        participant_name=current_user.name or "Nurse"
    )

    return CallActionResponse(
        success=True,
        message="Call accepted",
        token=token,
        livekit_url=LiveKitService.get_public_url(),
        call=call,
        participant=caller_info,
    )


@router.post("/{call_id}/join", response_model=CallActionResponse)
async def join_call(
    call_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Called by whichever side (Mother or Nurse) needs a LiveKit token once
    the call has moved past RINGING. Now enforces that the caller of this
    endpoint is actually a participant of the call, and that the call is in
    a joinable state - neither check existed before (Issue 2).
    """
    call, other_info = await CallService.join_call(db, call_id, str(current_user.id))

    token = LiveKitService.create_token(
        room_name=call.room_name,
        participant_identity=str(current_user.id),
        participant_name=current_user.name or "Participant"
    )

    return CallActionResponse(
        success=True,
        message="Token generated",
        token=token,
        livekit_url=LiveKitService.get_public_url(),
        call=call,
        participant=other_info,
    )


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


@router.post("/{call_id}/rate", response_model=CallResponse)
async def rate_call(
    call_id: int,
    request: CallRatingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    call = await CallService.rate_call(db, call_id, str(current_user.id), request.rating, request.feedback)
    return call


@router.get("/history", response_model=list[CallResponse])
async def get_history(
    filter: CallHistoryFilter = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    calls = await CallService.get_history(db, str(current_user.id), limit=filter.limit, offset=filter.offset)
    
    results = []
    for call in calls:
        call_dict = {
            "id": call.id,
            "caller_id": call.caller_id,
            "receiver_id": call.receiver_id,
            "status": call.status,
            "room_name": call.room_name,
            "started_at": call.started_at,
            "answered_at": call.answered_at,
            "ended_at": call.ended_at,
            "duration_seconds": call.duration_seconds,
            "rating": call.rating,
            "feedback": call.feedback,
            "created_at": call.created_at,
        }
        if call.caller:
            call_dict["caller"] = _participant_info(call.caller).model_dump()
        if call.receiver:
            call_dict["receiver"] = _participant_info(call.receiver).model_dump()
        results.append(call_dict)
        
    return results


@router.get("/stats", response_model=CallStatsResponse)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stats = await get_user_call_stats(db, str(current_user.id))
    return stats
