from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import inspect

from app.core.database import get_db
from app.api.deps import get_current_user
from app.core.ratelimit import limit
from app.modules.users.models import User
from app.modules.calls.schemas import CallRequest, CallResponse, CallActionResponse, CallRatingRequest, CallHistoryFilter, CallStatsResponse, CallClientReport
from app.modules.calls.services.call_service import CallService, _participant_info
from app.modules.calls.services.livekit_service import LiveKitService
from app.modules.calls.services.call_stats import get_user_call_stats

router = APIRouter()

def map_call_response(call) -> dict:
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
        "kind": call.kind or "nurse",
        "ride_id": call.ride_id,
        "created_at": call.created_at,
    }
    unloaded = inspect(call).unloaded
    if "caller" not in unloaded and getattr(call, "caller", None):
        call_dict["caller"] = _participant_info(call.caller).model_dump()
    if "receiver" not in unloaded and getattr(call, "receiver", None):
        call_dict["receiver"] = _participant_info(call.receiver).model_dump()
    return call_dict

@router.post("/request", response_model=CallResponse,
             dependencies=[Depends(limit("calls.request", 10, 60, "You're starting calls too quickly. Please wait a moment."))])
async def request_call(
    request: CallRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mother requests a call.
    """
    call = await CallService.request_call(db, str(current_user.id), request)
    return map_call_response(call)


@router.post("/ws-ticket", dependencies=[Depends(limit("calls.ws_ticket", 30, 60))])
async def ws_ticket(current_user: User = Depends(get_current_user)):
    """Short-lived credential for opening /calls/ws (pass it as ?ticket=...). Keeps the long-lived
    access token out of the socket URL, which proxies and servers write to their logs."""
    from app.core.security import create_ws_ticket, WS_TICKET_TTL_SECONDS
    return {"ticket": create_ws_ticket(str(current_user.id)), "expires_in": WS_TICKET_TTL_SECONDS}


@router.post("/{call_id}/accept", response_model=CallActionResponse,
             dependencies=[Depends(limit("calls.accept", 20, 60))])
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
        participant_name=current_user.name or "Participant"
    )

    return CallActionResponse(
        success=True,
        message="Call accepted",
        token=token,
        livekit_url=LiveKitService.get_public_url(),
        call=map_call_response(call),
        participant=caller_info,
    )


@router.post("/{call_id}/join", response_model=CallActionResponse,
             dependencies=[Depends(limit("calls.join", 30, 60))])
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
        call=map_call_response(call),
        participant=other_info,
    )


@router.post("/{call_id}/reject", response_model=CallActionResponse,
             dependencies=[Depends(limit("calls.reject", 30, 60))])
async def reject_call(
    call_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    call = await CallService.reject_call(db, call_id, str(current_user.id))
    return CallActionResponse(success=True, message="Call rejected", call=map_call_response(call))


@router.post("/{call_id}/end", response_model=CallActionResponse,
             dependencies=[Depends(limit("calls.end", 30, 60))])
async def end_call(
    call_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    call = await CallService.end_call(db, call_id, str(current_user.id))
    return CallActionResponse(success=True, message="Call ended", call=map_call_response(call))


@router.post("/{call_id}/rate", dependencies=[Depends(limit("calls.rate", 10, 60))])
async def rate_call(
    call_id: int,
    request: CallRatingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    call = await CallService.rate_call(db, call_id, str(current_user.id), request.rating, request.feedback)
    return {"success": True, "message": "Call rated successfully"}


@router.get("/history", response_model=list[CallResponse])
async def get_history(
    filter: CallHistoryFilter = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    calls = await CallService.get_history(db, str(current_user.id), limit=filter.limit, offset=filter.offset)
    
    results = []
    for call in calls:
        results.append(map_call_response(call))
        
    return results


@router.get("/stats", response_model=CallStatsResponse)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stats = await get_user_call_stats(db, str(current_user.id))
    return stats


@router.post("/{call_id}/client-report", status_code=202,
             dependencies=[Depends(limit("calls.client_report", 20, 60))])
async def client_report(
    call_id: int,
    report: CallClientReport,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """The phones' side of a failed call (no crash-reporting SDK yet): stored on the call's event
    trail next to the server's own transitions and LiveKit webhooks, and logged with the call id,
    so a failed call can be reconstructed end to end."""
    await CallService.record_client_report(db, call_id, str(current_user.id), report)
    return {"success": True}


@router.get("/{call_id}/state")
async def get_call_state(
    call_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Server truth for one call, so an app that missed events (background, dropped socket) can resync."""
    return await CallService.get_call_state(db, call_id, str(current_user.id))
