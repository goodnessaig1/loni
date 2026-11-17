import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from livekit.api import WebhookReceiver, TokenVerifier

from app.core.config import settings
from app.core.database import get_db
from app.core.ws_manager import manager as ws_manager
from app.modules.calls.models import Call, CallEvent, CallParticipant, CallStatusEnum, LiveKitWebhookEvent
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from app.modules.calls.services.call_service import CallService, spawn

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
    #
    # Real bug caught in production logs: `WebhookReceiver(api_key,
    # api_secret)` throws `TypeError: WebhookReceiver.__init__() takes 2
    # positional arguments but 3 were given`. Unlike the LiveKit Node SDK
    # (`new WebhookReceiver(apiKey, apiSecret)`), the Python SDK's
    # WebhookReceiver takes a single `TokenVerifier` instance, not raw
    # key/secret strings directly - the credentials get wrapped in that
    # object first. This was silently breaking every webhook delivery with
    # a 400, which meant `Call.status` never reached CONNECTED via the
    # webhook path and `started_at` never got set server-side (the call
    # timer was surviving only on the client-side
    # RoomEvent.ParticipantConnected fallback in CallModals.tsx).
    if not settings.LIVEKIT_API_KEY or not settings.LIVEKIT_API_SECRET:
        raise HTTPException(status_code=500, detail="LiveKit credentials missing")
    verifier = TokenVerifier(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
    return WebhookReceiver(verifier)


TERMINAL = (
    CallStatusEnum.ENDED, CallStatusEnum.REJECTED, CallStatusEnum.CANCELLED,
    CallStatusEnum.FAILED, CallStatusEnum.TIMEOUT, CallStatusEnum.MISSED,
)


def _utc(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.post("/webhook")
async def livekit_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Drives the call state machine off LiveKit's own ground truth (participant_joined /
    participant_left / room_finished). Mounted at /api/v1/livekit/webhook - `webhook.urls` in
    livekit.yaml must point here.

    - Authenticity: LiveKit signs every delivery (a JWT in Authorization whose sha256 claim covers
      the body). Anything that fails that check is 401 and changes nothing.
    - Exactly once: each event id is recorded in `livekit_webhook_events`; a retried or replayed
      delivery is acknowledged and skipped.
    - Order: LiveKit does not promise delivery order, so joins/leaves are applied by the event's
      own timestamp - an older event never undoes a newer one.
    - Failures inside are 500 (LiveKit retries); state is committed BEFORE anyone is told.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing auth header")

    body_str = (await request.body()).decode("utf-8")
    receiver = get_webhook_receiver()
    try:
        event = receiver.receive(body_str, auth_header)
    except Exception as e:
        logger.warning("Rejected LiveKit webhook (bad signature or body): %s", e)
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        return await _apply(db, event)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Webhook processing failed (event=%s): %s", getattr(event, "event", "?"), e)
        raise HTTPException(status_code=500, detail="Webhook processing failed")


async def _apply(db: AsyncSession, event) -> dict:
    event_name = event.event
    room_name = event.room.name if event.room and event.room.name else None
    if not room_name:
        return {"status": "ignored", "reason": "No room on event"}

    # Exactly-once: a retried delivery carries the same id.
    if event.id:
        if await db.get(LiveKitWebhookEvent, event.id) is not None:
            return {"status": "duplicate"}
        db.add(LiveKitWebhookEvent(id=event.id, event_type=event_name, room_name=room_name))
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            return {"status": "duplicate"}

    call = (await db.execute(
        select(Call).where(Call.room_name == room_name).with_for_update()
    )).scalar_one_or_none()
    if not call:
        await db.commit()  # keep the ledger row
        return {"status": "ignored", "reason": "Room not linked to a Call"}

    now = datetime.now(timezone.utc)
    at = datetime.fromtimestamp(event.created_at, timezone.utc) if event.created_at else now
    participant_identity = event.participant.identity if event.participant and event.participant.identity else None
    # Each connection to the room is its own LiveKit session (sid). A reconnect is a NEW session for
    # the same person, and LiveKit may report the old session's departure after the new one's
    # arrival - so joins and leaves are matched by session, not just by person.
    sid = (event.participant.sid if event.participant else "") or None

    # Earlier sessions of this person in this call, from the events recorded so far.
    seen = []
    if participant_identity and event_name in ("participant_joined", "participant_left"):
        seen = [(e.event_type, (e.payload or {}).get("sid")) for e in (await db.execute(
            select(CallEvent).where(CallEvent.call_id == call.id,
                                    CallEvent.event_type.in_(("participant_joined", "participant_left")))
            .order_by(CallEvent.id)
        )).scalars().all() if (e.payload or {}).get("participant") == participant_identity]

    db.add(CallEvent(call_id=call.id, event_type=event_name,
                     payload={"participant": participant_identity, "sid": sid, "event_id": event.id or None}))

    after_commit: list = []  # (user_id, event_type, payload) to send once the state is durable
    watchdog = False

    async def _row():
        if not participant_identity:
            return None
        return (await db.execute(select(CallParticipant).where(
            CallParticipant.call_id == call.id, CallParticipant.user_id == participant_identity,
        ))).scalar_one_or_none()

    if event_name == "participant_joined" and participant_identity:
        row = await _row()
        if row:
            if sid and ("participant_left", sid) in seen:
                pass  # this session's leave already arrived (delivered out of order): not here
            elif not sid and _utc(row.left_at) and _utc(row.left_at) > at:
                pass  # no session id: fall back to timestamps - a join older than the last leave
            else:
                row.joined_at = row.joined_at or at
                row.left_at = None  # present (again)
        await db.flush()
        present = len((await db.execute(select(CallParticipant).where(
            CallParticipant.call_id == call.id,
            CallParticipant.joined_at.is_not(None),
            CallParticipant.left_at.is_(None),
        ))).scalars().all())

        if present >= 2 and call.status not in TERMINAL and call.status != CallStatusEnum.CONNECTED:
            call.status = CallStatusEnum.CONNECTED
            # t=0 of the call timer. Set once: a participant rejoining after a drop must not restart talk time.
            if call.started_at is None:
                call.started_at = now
            db.add(CallEvent(call_id=call.id, event_type="CallConnected"))
            payload = {"call_id": str(call.id), "status": CallStatusEnum.CONNECTED.value,
                       "started_at": call.started_at.isoformat()}
            after_commit += [(uid, "call_state", payload) for uid in (call.caller_id, call.receiver_id) if uid]

    elif event_name == "participant_left" and participant_identity:
        row = await _row()
        # The person is still in the room on a newer session (a reconnect whose join was delivered
        # first): this is the old session going away, not them leaving.
        joined_sids = [s for t, s in seen if t == "participant_joined" and s]
        left_sids = {s for t, s in seen if t == "participant_left" and s}
        newer_session = bool(sid) and any(s != sid and s not in left_sids for s in joined_sids)
        if row and row.left_at is None and not newer_session:
            row.left_at = at
            # Someone dropped out of a live call: give them RECONNECT_GRACE_SECONDS to come back
            # (LiveKit fires participant_joined again on rejoin) before ending it for both.
            if call.status == CallStatusEnum.CONNECTED:
                call.status = CallStatusEnum.RECONNECTING
                other_id = call.receiver_id if participant_identity == call.caller_id else call.caller_id
                if other_id:
                    after_commit.append((other_id, "call_state",
                                         {"call_id": str(call.id), "status": CallStatusEnum.RECONNECTING.value}))
                watchdog = True

    elif event_name == "room_finished":
        # Safety net: a client crashed / lost network and never called POST /end.
        if call.status not in TERMINAL:
            await CallService._finish(db, call, CallStatusEnum.ENDED, by=None)
            payload = {"call_id": str(call.id), "status": CallStatusEnum.ENDED.value,
                       "duration_seconds": call.duration_seconds}
            after_commit += [(uid, "call_state", payload) for uid in (call.caller_id, call.receiver_id) if uid]

    await db.commit()
    for uid, kind, payload in after_commit:
        await ws_manager.send_to_user(uid, kind, payload)
    if watchdog:
        spawn(CallService._reconnect_watchdog(call.id))
    return {"status": "ok"}
