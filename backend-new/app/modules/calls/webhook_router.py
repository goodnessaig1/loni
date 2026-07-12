import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from livekit.api import WebhookReceiver

from app.core.config import settings
from app.core.database import get_db
from app.core.ws_manager import manager as ws_manager
from app.modules.calls.models import Call, CallEvent, CallParticipant, CallStatusEnum
from sqlalchemy.future import select

logger = logging.getLogger("calls.webhook")
router = APIRouter()


def get_webhook_receiver():
    # NOTE: previously this read os.getenv(...) directly, which only ever
    # worked because livekit_service.py happened to call dotenv's
    # load_dotenv() at import time as a side effect and populate
    # os.environ. That's a fragile, order-dependent way to configure
    # something the app depends on. Now reads from the single Settings
    # source of truth (app/core/config.py), which pydantic-settings loads
    # from .env explicitly regardless of import order.
    if not settings.LIVEKIT_API_KEY or not settings.LIVEKIT_API_SECRET:
        raise HTTPException(status_code=500, detail="LiveKit credentials missing")
    return WebhookReceiver(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)


TERMINAL = (
    CallStatusEnum.ENDED, CallStatusEnum.REJECTED, CallStatusEnum.CANCELLED,
    CallStatusEnum.FAILED, CallStatusEnum.TIMEOUT, CallStatusEnum.MISSED,
)


@router.post("/webhook")
async def livekit_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Drives the call state machine off LiveKit's own ground truth
    (Issue 3, Issue 12, Issue 14). Previously this endpoint only wrote a log
    row and never touched Call.status / started_at / answered_at, so the
    call timer had nothing authoritative to key off - each client just
    started its own local timer as soon as ITS OWN LiveKit connection
    resolved, which is not the same moment as "both participants joined".

    IMPORTANT: for this endpoint to ever receive traffic, `webhook:` must be
    enabled in livekit/livekit.yaml (it was commented out entirely - see
    that file, now fixed) and its `urls:` must point at this exact path,
    mounted at /api/v1/livekit/webhook. The old commented-out config
    pointed at /api/v1/calls/webhook, which doesn't exist and would have
    404'd even if someone had uncommented it verbatim.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing auth header")

    body = await request.body()
    body_str = body.decode("utf-8")

    try:
        receiver = get_webhook_receiver()
        event = receiver.receive(body_str, auth_header)

        event_name = event.event
        room_name = event.room.name if event.room else None

        if not room_name:
            return {"status": "ignored", "reason": "No room on event"}

        stmt = select(Call).where(Call.room_name == room_name).with_for_update()
        result = await db.execute(stmt)
        call = result.scalar_one_or_none()

        if not call:
            return {"status": "ignored", "reason": "Room not linked to a Call"}

        participant_identity = event.participant.identity if event.participant else None

        db.add(CallEvent(
            call_id=call.id,
            event_type=event_name,
            payload={"participant": participant_identity}
        ))

        if event_name == "participant_joined" and participant_identity:
            p_stmt = select(CallParticipant).where(
                CallParticipant.call_id == call.id,
                CallParticipant.user_id == participant_identity,
            )
            p_result = await db.execute(p_stmt)
            participant_row = p_result.scalar_one_or_none()
            now = datetime.now(timezone.utc)
            if participant_row and not participant_row.joined_at:
                participant_row.joined_at = now

            joined_stmt = select(CallParticipant).where(
                CallParticipant.call_id == call.id,
                CallParticipant.joined_at.is_not(None),
            )
            joined_result = await db.execute(joined_stmt)
            joined_count = len(joined_result.scalars().all())

            if joined_count >= 2 and call.status != CallStatusEnum.CONNECTED:
                call.status = CallStatusEnum.CONNECTED
                call.started_at = now  # <-- the call timer's t=0 (Issue 3)
                db.add(CallEvent(call_id=call.id, event_type="CallConnected"))

                connected_payload = {
                    "call_id": str(call.id),
                    "status": CallStatusEnum.CONNECTED.value,
                    "started_at": now.isoformat(),
                }
                for uid in (call.caller_id, call.receiver_id):
                    if uid:
                        await ws_manager.send_to_user(uid, "call_state", connected_payload)

        elif event_name == "participant_left" and participant_identity:
            p_stmt = select(CallParticipant).where(
                CallParticipant.call_id == call.id,
                CallParticipant.user_id == participant_identity,
            )
            p_result = await db.execute(p_stmt)
            participant_row = p_result.scalar_one_or_none()
            if participant_row and not participant_row.left_at:
                participant_row.left_at = datetime.now(timezone.utc)

            # Optimistically mark RECONNECTING rather than immediately
            # ENDED - if this was a transient network drop, LiveKit will
            # fire participant_joined again shortly (Issue 8: RECONNECTING
            # needed to exist and be reachable, previously it wasn't even
            # in the enum).
            if call.status == CallStatusEnum.CONNECTED:
                call.status = CallStatusEnum.RECONNECTING
                other_id = call.receiver_id if participant_identity == call.caller_id else call.caller_id
                if other_id:
                    await ws_manager.send_to_user(other_id, "call_state", {
                        "call_id": str(call.id),
                        "status": CallStatusEnum.RECONNECTING.value,
                    })

        elif event_name == "room_finished":
            # Safety net for Issue 14: if a client crashed / lost network
            # and never called POST /calls/{id}/end, LiveKit's own
            # empty_timeout will eventually close the room and fire this
            # event, letting us reconcile the DB instead of leaving the
            # call stuck open forever.
            if call.status not in TERMINAL:
                now = datetime.now(timezone.utc)
                call.status = CallStatusEnum.ENDED
                call.ended_at = now
                basis = call.started_at or call.answered_at
                if basis:
                    call.duration_seconds = max(0, int((now - basis).total_seconds()))

                p_stmt = select(CallParticipant).where(
                    CallParticipant.call_id == call.id, CallParticipant.left_at.is_(None)
                )
                p_result = await db.execute(p_stmt)
                for p in p_result.scalars().all():
                    p.left_at = now

                for uid in (call.caller_id, call.receiver_id):
                    if uid:
                        await ws_manager.send_to_user(uid, "call_state", {
                            "call_id": str(call.id),
                            "status": CallStatusEnum.ENDED.value,
                            "duration_seconds": call.duration_seconds,
                        })

        await db.commit()
        return {"status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Webhook error: %s", e)
        raise HTTPException(status_code=400, detail="Invalid webhook")
