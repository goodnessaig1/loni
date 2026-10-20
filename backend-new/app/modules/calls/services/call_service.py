import uuid
import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, desc
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.modules.calls.models import Call, CallParticipant, CallEvent, CallStatusEnum, ParticipantRoleEnum
from app.modules.calls.schemas import CallRequest, ParticipantInfo
from app.modules.calls.services.livekit_service import LiveKitService
from app.modules.notifications.service import NotificationService
from app.modules.users.models import User, UserTypeEnum, AccountStatusEnum
from app.modules.rides.models import Ride, ACTIVE_STATUSES as RIDE_ACTIVE_STATUSES
from app.utils.user_enrichment import enrich_user_data
from app.core.ws_manager import manager as ws_manager
from app.core.database import AsyncSessionLocal

logger = logging.getLogger("call_service")

# How long a call is allowed to stay in REQUESTED/RINGING before we give up
# and mark it MISSED/TIMEOUT (Issue 8: these enum values existed but nothing
# ever set them, so an unanswered call stayed "REQUESTED" in the DB forever
# and the caller's screen had no server-driven way to know to stop trying).
RING_TIMEOUT_SECONDS = 45

# A participant who drops out of a connected call has this long to come back before the call is ended.
RECONNECT_GRACE_SECONDS = 30

# Someone is "on a call" while a call they are part of is in one of these states.
LIVE_STATUSES = (
    CallStatusEnum.REQUESTED, CallStatusEnum.RINGING, CallStatusEnum.ACCEPTED,
    CallStatusEnum.CONNECTING, CallStatusEnum.CONNECTED, CallStatusEnum.RECONNECTING,
)
IN_CALL_STATUSES = LIVE_STATUSES[2:]  # answered, not just ringing

TERMINAL_STATUSES = {
    CallStatusEnum.ENDED,
    CallStatusEnum.REJECTED,
    CallStatusEnum.CANCELLED,
    CallStatusEnum.FAILED,
    CallStatusEnum.TIMEOUT,
    CallStatusEnum.MISSED,
}


def _participant_info(user: User) -> ParticipantInfo:
    """Builds the real caller/receiver payload (Issue 6, Issue 7) by reusing
    enrich_user_data, which already knows how to compute trimester /
    pregnancy week from pregnancy_start_date. Previously the calls module
    never called this at all - it just hardcoded caller_name="Mother"."""
    data = enrich_user_data(user)
    nurse_profile = data.get("nurse_profile") or {}
    return ParticipantInfo(
        id=data["id"],
        name=data["name"],
        user_type=data.get("user_type"),
        profile_picture=data.get("profile_picture"),
        trimester=data.get("trimester"),
        pregnancy_week=data.get("pregnancyWeek") or data.get("pregnancy_week"),
        hospital_affiliation=nurse_profile.get("hospital_affiliation"),
        years_of_experience=nurse_profile.get("years_of_experience"),
    )


async def _load_user(db: AsyncSession, user_id: str) -> User | None:
    stmt = (
        select(User)
        .options(selectinload(User.nurse_profile), selectinload(User.driver_profile))
        .where(User.id == user_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _emit(user_id: str, event_type: str, title: str, body: str, data: dict):
    """Fan out a call-state change over BOTH transports:

    1. WebSocket - instant (<50ms), delivered only if the user's app is
       foregrounded/has a live socket right now (Issue 1, 8, 10, 11).
    2. Push notification (FCM) - best-effort wake-up for a backgrounded or
       killed app (Issue 4). Always sent too: we can't reliably know from
       the server alone whether the recipient's *visible* screen is showing
       call UI (a live socket can exist while the OS still has the app
       backgrounded on some platforms), so belt-and-suspenders is correct
       here. The client dedupes by (call_id, status).
    """
    delivered_over_ws = await ws_manager.send_to_user(user_id, event_type, data)
    logger.info("emit %s to user=%s (ws_delivered=%s)", event_type, user_id, delivered_over_ws)
    asyncio.create_task(NotificationService.notify_user(user_id, title, body, {"type": event_type, **data}))


class CallService:
    @staticmethod
    async def request_call(db: AsyncSession, caller_id: str, request: CallRequest):
        caller = await _load_user(db, caller_id)
        if not caller:
            raise HTTPException(status_code=404, detail="Caller not found")

        kind, receiver_id = await CallService._resolve_receiver(db, caller_id, request)

        # One call at a time: a new request replaces any call of hers that is still ringing,
        # and is refused while she is already talking to someone.
        mine = (await db.execute(select(Call).where(
            or_(Call.caller_id == caller_id, Call.receiver_id == caller_id),
            Call.status.in_(LIVE_STATUSES),
        ).with_for_update())).scalars().all()
        if any(c.status in IN_CALL_STATUSES for c in mine):
            raise HTTPException(status_code=409, detail="You are already on a call.")
        for old in mine:
            await CallService._stop_ringing(db, old, CallStatusEnum.CANCELLED, by=caller_id)

        # Who will be rung: the named person, or every nurse who can take a call right now.
        if receiver_id:
            rung = [receiver_id]
        else:
            rung = await CallService._available_nurses(db, exclude=caller_id)
            if not rung:
                await db.commit()
                raise HTTPException(status_code=409, detail="No nurse is available right now. Please try again in a few minutes.")

        room_name = f"room-{uuid.uuid4()}"
        call = Call(
            caller_id=caller_id,
            receiver_id=receiver_id,
            status=CallStatusEnum.RINGING,
            room_name=room_name,
            kind=kind,
            ride_id=request.ride_id if kind == "ride" else None,
        )
        db.add(call)
        await db.flush()

        participant = CallParticipant(
            call_id=call.id,
            user_id=caller_id,
            role=ParticipantRoleEnum.CALLER
        )
        db.add(participant)

        # The rung list is how everyone who was rung is later told the call was answered, cancelled or missed.
        event = CallEvent(call_id=call.id, event_type="CallRequested", payload={"rung": rung})
        db.add(event)

        await db.commit()
        await db.refresh(call)

        caller_info = _participant_info(caller)
        payload = {
            "call_id": str(call.id),
            "room_name": call.room_name,
            "caller": caller_info.model_dump(),
            "caller_name": caller_info.name,  # kept for backward-compat clients
            "created_at": call.created_at.isoformat(),
            "kind": call.kind,
            "ride_id": call.ride_id,
        }

        body = f"{caller_info.name} is calling you." if receiver_id else f"{caller_info.name} needs a nurse."
        for uid in rung:
            asyncio.create_task(_emit(uid, "incoming_call", "Incoming Call", body, payload))

        asyncio.create_task(CallService._ring_timeout_watchdog(call.id))

        return call

    @staticmethod
    async def _available_nurses(db: AsyncSession, exclude: str | None = None) -> list[str]:
        """Approved nurses who are online and not already on a call - at most CALL_RING_MAX_NURSES,
        those who answered least recently first, so load spreads and one call never rings thousands."""
        from sqlalchemy import func
        from app.core.config import settings
        busy = select(Call.receiver_id).where(Call.receiver_id.is_not(None), Call.status.in_(IN_CALL_STATUSES))
        last_answer = (select(Call.receiver_id.label("nurse_id"), func.max(Call.answered_at).label("last"))
                       .where(Call.receiver_id.is_not(None)).group_by(Call.receiver_id).subquery())
        stmt = (
            select(User.id)
            .outerjoin(last_answer, last_answer.c.nurse_id == User.id)
            .where(
                User.user_type == UserTypeEnum.nurse,
                User.is_online.is_(True),
                User.account_status == AccountStatusEnum.active,
                User.id.not_in(busy),
            )
            .order_by(last_answer.c.last.is_not(None), last_answer.c.last.asc())
            .limit(settings.CALL_RING_MAX_NURSES + 1)
        )
        ids = (await db.execute(stmt)).scalars().all()
        return [i for i in ids if i != exclude][: settings.CALL_RING_MAX_NURSES]

    @staticmethod
    async def rung_ids(db: AsyncSession, call: Call) -> list[str]:
        """Everyone this call was rung to (recorded when it was requested)."""
        ev = (await db.execute(select(CallEvent).where(
            CallEvent.call_id == call.id, CallEvent.event_type == "CallRequested",
        ))).scalars().first()
        rung = list((ev.payload or {}).get("rung") or []) if ev else []
        if call.receiver_id and call.receiver_id not in rung and not rung:
            rung = [call.receiver_id]
        return rung

    @staticmethod
    async def _stop_ringing(db: AsyncSession, call: Call, status: CallStatusEnum, *, by: str | None = None,
                            notify_caller: bool = False) -> None:
        """End a call that was never answered and stop it ringing everywhere. Caller commits."""
        call.status = status
        call.ended_at = datetime.now(timezone.utc)
        db.add(CallEvent(call_id=call.id, event_type=f"Call{status.value.title()}", payload={"by": by}))
        data = {"call_id": str(call.id), "status": status.value}
        for uid in await CallService.rung_ids(db, call):
            if uid != by:
                asyncio.create_task(_emit(uid, "call_ended" if status == CallStatusEnum.CANCELLED else "call_missed",
                                          "Call ended" if status == CallStatusEnum.CANCELLED else "Missed call",
                                          "The mother ended the request." if status == CallStatusEnum.CANCELLED else "You missed a call.",
                                          data))
        if notify_caller and call.caller_id != by:
            asyncio.create_task(_emit(call.caller_id, "call_timeout", "No answer", "No one answered your call.", data))

    @staticmethod
    async def _resolve_receiver(db: AsyncSession, caller_id: str, request: CallRequest) -> tuple[str, str | None]:
        """Who may be rung. A ride call goes only to the other party of an active ride the caller is on;
        any other call goes to a nurse (a named one, or every online nurse)."""
        if request.ride_id is not None:
            ride = await db.get(Ride, request.ride_id)
            if not ride or caller_id not in (ride.rider_id, ride.driver_id):
                raise HTTPException(status_code=404, detail="Ride not found")
            if ride.status not in RIDE_ACTIVE_STATUSES or not ride.driver_id:
                raise HTTPException(status_code=400, detail="You can only call during an active ride.")
            return "ride", (ride.driver_id if caller_id == ride.rider_id else ride.rider_id)
        if request.nurse_id:
            nurse = await db.get(User, request.nurse_id)
            if not nurse or nurse.user_type != UserTypeEnum.nurse:
                raise HTTPException(status_code=400, detail="That person is not a LONI nurse.")
        return "nurse", request.nurse_id

    @staticmethod
    async def _ring_timeout_watchdog(call_id: int):
        """Issue 8 fix: without this, a call nobody answers stays in
        REQUESTED/RINGING in the DB forever and the caller's UI has no
        server-confirmed signal to stop showing "Calling...". Runs in its
        own DB session because the originating request's session is closed
        by the time this fires."""
        await asyncio.sleep(RING_TIMEOUT_SECONDS)
        async with AsyncSessionLocal() as db:
            stmt = select(Call).where(Call.id == call_id).with_for_update()
            result = await db.execute(stmt)
            call = result.scalar_one_or_none()
            if not call or call.status not in (CallStatusEnum.REQUESTED, CallStatusEnum.RINGING):
                return  # already accepted/rejected/cancelled

            await CallService._stop_ringing(db, call, CallStatusEnum.TIMEOUT, notify_caller=True)
            await db.commit()

    @staticmethod
    async def _reconnect_watchdog(call_id: int):
        """A participant left a connected call (crash, lost signal). If they are not back within the
        grace period, end the call for both sides instead of leaving the other one waiting."""
        await asyncio.sleep(RECONNECT_GRACE_SECONDS)
        async with AsyncSessionLocal() as db:
            call = (await db.execute(select(Call).where(Call.id == call_id).with_for_update())).scalar_one_or_none()
            if not call or call.status != CallStatusEnum.RECONNECTING:
                return
            await CallService._finish(db, call, CallStatusEnum.ENDED, by=None)
            await db.commit()
            data = {"call_id": str(call.id), "status": call.status.value, "duration_seconds": call.duration_seconds}
            for uid in (call.caller_id, call.receiver_id):
                if uid:
                    await _emit(uid, "call_ended", "Call ended", "The call was disconnected.", data)
        await LiveKitService.delete_room(call.room_name)

    @staticmethod
    async def _finish(db: AsyncSession, call: Call, status: CallStatusEnum, by: str | None) -> None:
        """Close an answered call: timestamps, talk time, participants. Caller commits."""
        call.status = status
        call.ended_at = datetime.now(timezone.utc)
        basis = call.started_at or call.answered_at
        if basis:
            if basis.tzinfo is None:
                basis = basis.replace(tzinfo=timezone.utc)
            call.duration_seconds = max(0, int((call.ended_at - basis).total_seconds()))
        db.add(CallEvent(call_id=call.id, event_type="CallEnded", payload={"ended_by": by}))
        for p in (await db.execute(select(CallParticipant).where(
            CallParticipant.call_id == call.id, CallParticipant.left_at.is_(None),
        ))).scalars().all():
            p.left_at = call.ended_at

    @staticmethod
    async def accept_call(db: AsyncSession, call_id: int, nurse_id: str):
        """
        Issue 1/2 fix (latency audit): the caller's "Accepted" notification
        previously waited on a full LiveKit REST API round trip
        (`create_room()`, typically 50-300ms, more under load/cold start)
        before firing at all - the exact "noticeable delay before the
        caller is notified" this issue describes. That ordering existed to
        protect against a real failure mode (both sides told "accepted"
        with no server-side room to join if `create_room()` fails), but it
        traded worst-case correctness for best-case latency on every single
        call.

        Fixed by re-ordering: the DB transition to ACCEPTED and the
        caller's notification now happen FIRST, immediately after the
        (fast, local) database commit. Room creation happens after that,
        overlapping with the caller's own notification-processing +
        `POST /join` round trip instead of blocking ahead of it - by the
        time the caller's client actually requests a token, the room has
        almost always already been created in the background. The failure
        mode is still fully handled: if room creation does fail, BOTH
        sides are explicitly told `call_failed` (not left silently hanging
        on "Connecting..."), which is strictly better than blocking every
        successful call to protect against a comparatively rare failure.
        """
        # Database transaction level lock (Pessimistic Locking)
        # Prevents race conditions when multiple nurses press Accept
        stmt = select(Call).where(Call.id == call_id).with_for_update()
        result = await db.execute(stmt)
        call = result.scalar_one_or_none()

        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        if call.status not in [CallStatusEnum.REQUESTED, CallStatusEnum.RINGING]:
            # If status changed while we were waiting for the lock, reject
            raise HTTPException(status_code=400, detail="This call has already been answered or cancelled.")

        nurse = await _load_user(db, nurse_id)
        if not nurse:
            raise HTTPException(status_code=404, detail="Nurse not found")
        # A call rung to one person can only be answered by that person; an open call only by a nurse.
        if call.receiver_id and call.receiver_id != nurse_id:
            raise HTTPException(status_code=403, detail="This call is not for you.")
        if not call.receiver_id and nurse.user_type != UserTypeEnum.nurse:
            raise HTTPException(status_code=403, detail="Only a LONI nurse can answer this call.")
        if nurse_id == call.caller_id:
            raise HTTPException(status_code=400, detail="You cannot answer your own call.")
        busy = (await db.execute(select(Call.id).where(
            Call.id != call.id, Call.status.in_(IN_CALL_STATUSES),
            or_(Call.caller_id == nurse_id, Call.receiver_id == nurse_id),
        ))).first()
        if busy:
            raise HTTPException(status_code=409, detail="Finish your current call first.")

        caller = await _load_user(db, call.caller_id)

        # --- Step 1: commit ACCEPTED + notify the caller immediately ---
        call.status = CallStatusEnum.ACCEPTED
        call.receiver_id = nurse_id
        # Issue 3: AnsweredAt recorded exactly once, right here - the
        # single moment the Nurse's accept is durably persisted. Both
        # clients receive this same timestamp verbatim in the payload
        # below (kept distinct from `started_at`, which is set later by
        # the LiveKit webhook once media actually begins - see
        # webhook_router.py - since "answered" and "media flowing" are
        # different real-world moments and both are independently useful
        # for call history).
        call.answered_at = datetime.now(timezone.utc)

        participant = CallParticipant(
            call_id=call.id,
            user_id=nurse_id,
            role=ParticipantRoleEnum.RECEIVER
        )
        db.add(participant)
        db.add(CallEvent(call_id=call.id, event_type="CallAccepted", payload={"nurse_id": nurse_id}))

        await db.commit()
        await db.refresh(call)
        logger.info("Call %s ACCEPTED by nurse=%s at %s", call.id, nurse_id, call.answered_at.isoformat())

        nurse_info = _participant_info(nurse)
        livekit_url = LiveKitService.get_public_url()
        accepted_data = {
            "call_id": str(call.id),
            "room_name": call.room_name,
            "status": CallStatusEnum.ACCEPTED.value,
            "receiver": nurse_info.model_dump(),
            "livekit_url": livekit_url,
            "answered_at": call.answered_at.isoformat(),
            "kind": call.kind,
            "ride_id": call.ride_id,
        }
        # This is THE fix for Issue 1 - fires the instant the commit above
        # lands, with zero dependency on LiveKit. The caller's UI can show
        # "accepted" + nurse info right away; the media connection (Issue
        # 2: "do not wait for LiveKit to finish connecting before updating
        # the caller") proceeds independently below and afterward on the
        # client side via its own POST /join call.
        asyncio.create_task(_emit(
            call.caller_id, "call_accepted", "Call Accepted", f"{nurse_info.name} accepted your call.", accepted_data
        ))
        # Everyone else who was rung stops ringing (their apps clear the request on `call_accepted`).
        taken = {"call_id": str(call.id), "status": CallStatusEnum.ACCEPTED.value, "taken": True}
        for uid in await CallService.rung_ids(db, call):
            if uid != nurse_id:
                asyncio.create_task(_emit(uid, "call_accepted", "Call answered", "Another nurse answered this call.", taken))

        # --- Step 2: create the LiveKit room (overlaps with the caller
        # processing the notification above and calling POST /join) ---
        try:
            await LiveKitService.create_room(call.room_name)
        except Exception as e:
            logger.error("Failed to create LiveKit room for call %s: %s", call.id, e)
            fail_stmt = select(Call).where(Call.id == call_id).with_for_update()
            fail_result = await db.execute(fail_stmt)
            call = fail_result.scalar_one_or_none()
            call.status = CallStatusEnum.FAILED
            call.ended_at = datetime.now(timezone.utc)
            db.add(CallEvent(call_id=call.id, event_type="CallFailed", payload={"reason": str(e)}))
            await db.commit()
            data = {"call_id": str(call.id), "status": CallStatusEnum.FAILED.value}
            # Both sides need to hear about this now, since the caller was
            # already told "accepted" a moment ago.
            asyncio.create_task(_emit(call.caller_id, "call_failed", "Call Failed", "Could not start the call.", data))
            asyncio.create_task(_emit(nurse_id, "call_failed", "Call Failed", "Could not start the call.", data))
            raise HTTPException(status_code=502, detail="Could not start the call room. Please try again.")

        # Issue 4 (state machine): persist CONNECTING for accurate call
        # history/admin visibility. Not broadcast as its own WS event -
        # both clients already derive their own local CONNECTING state the
        # moment they successfully obtain a room token (Nurse: from this
        # very HTTP response below; Mother: from her own POST /join
        # response after processing `call_accepted` above), so a dedicated
        # broadcast here would be a redundant round trip with no UI benefit.
        connecting_stmt = select(Call).where(Call.id == call_id).with_for_update()
        connecting_result = await db.execute(connecting_stmt)
        call = connecting_result.scalar_one_or_none()
        call.status = CallStatusEnum.CONNECTING
        db.add(CallEvent(call_id=call.id, event_type="CallConnecting"))
        await db.commit()
        await db.refresh(call)

        caller_info = _participant_info(caller) if caller else None
        return call, caller_info

    @staticmethod
    async def join_call(db: AsyncSession, call_id: int, user_id: str):
        """Used by whichever side needs a LiveKit token after the call has
        been accepted. Previously had NO authorization check at all - any
        authenticated user could mint a token for any call_id regardless of
        whether they were a participant, and it worked even on calls that
        were never accepted, rejected, or already ended (Issue 2 root
        cause: this endpoint doesn't validate state, and incoming-call.tsx
        used it directly instead of /accept, silently skipping the whole
        accept state machine)."""
        stmt = (
            select(Call)
            .options(selectinload(Call.caller).selectinload(User.nurse_profile),
                     selectinload(Call.caller).selectinload(User.driver_profile),
                     selectinload(Call.receiver).selectinload(User.nurse_profile),
                     selectinload(Call.receiver).selectinload(User.driver_profile))
            .where(Call.id == call_id)
        )
        result = await db.execute(stmt)
        call = result.scalar_one_or_none()

        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        if user_id not in (call.caller_id, call.receiver_id):
            raise HTTPException(status_code=403, detail="You are not a participant of this call")

        if call.status in TERMINAL_STATUSES:
            raise HTTPException(status_code=400, detail=f"This call is no longer active ({call.status.value}).")

        other_user = call.receiver if user_id == call.caller_id else call.caller
        other_info = _participant_info(other_user) if other_user else None

        return call, other_info

    @staticmethod
    async def reject_call(db: AsyncSession, call_id: int, user_id: str):
        stmt = select(Call).where(Call.id == call_id).with_for_update()
        result = await db.execute(stmt)
        call = result.scalar_one_or_none()

        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        if call.status not in (CallStatusEnum.REQUESTED, CallStatusEnum.RINGING):
            return call  # already answered, cancelled or timed out

        # An open call to several nurses keeps ringing the others; it only ends once every nurse
        # it was rung to has declined - then she hears straight away instead of waiting out the timeout.
        if not call.receiver_id:
            rung = await CallService.rung_ids(db, call)
            if user_id not in rung:
                raise HTTPException(status_code=403, detail="Unauthorized to reject this call")
            db.add(CallEvent(call_id=call.id, event_type="CallDeclined", payload={"by": user_id}))
            await db.flush()
            declined = {
                (e.payload or {}).get("by") for e in (await db.execute(select(CallEvent).where(
                    CallEvent.call_id == call.id, CallEvent.event_type == "CallDeclined",
                ))).scalars().all()
            }
            if set(rung) <= declined:
                call.status = CallStatusEnum.REJECTED
                call.ended_at = datetime.now(timezone.utc)
                db.add(CallEvent(call_id=call.id, event_type="CallRejected", payload={"rejected_by": "all"}))
                asyncio.create_task(_emit(call.caller_id, "call_rejected", "No nurse available",
                                          "No nurse could take your call right now.",
                                          {"call_id": str(call.id), "status": CallStatusEnum.REJECTED.value}))
            await db.commit()
            return call

        if call.receiver_id == user_id or call.caller_id == user_id:
            call.status = CallStatusEnum.REJECTED
            call.ended_at = datetime.now(timezone.utc)

            db.add(CallEvent(call_id=call.id, event_type="CallRejected", payload={"rejected_by": user_id}))
            await db.commit()

            other_id = call.caller_id if user_id == call.receiver_id else call.receiver_id
            data = {"call_id": str(call.id), "status": CallStatusEnum.REJECTED.value}
            asyncio.create_task(_emit(other_id, "call_rejected", "Call Declined", "The call was declined.", data))
            return call

        raise HTTPException(status_code=403, detail="Unauthorized to reject this call")

    @staticmethod
    async def end_call(db: AsyncSession, call_id: int, user_id: str):
        stmt = select(Call).where(Call.id == call_id).with_for_update()
        result = await db.execute(stmt)
        call = result.scalar_one_or_none()

        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        if call.status in TERMINAL_STATUSES:
            # Already ended by the other party / webhook race - no-op so
            # both "hang up" taps racing each other don't error out.
            return call

        if call.status in (CallStatusEnum.REQUESTED, CallStatusEnum.RINGING):
            if user_id != call.caller_id:
                raise HTTPException(status_code=403, detail="Decline the call instead")
            # She gave up waiting: stop it ringing for everyone it was sent to.
            await CallService._stop_ringing(db, call, CallStatusEnum.CANCELLED, by=user_id)
            await db.commit()
            return call

        await CallService._finish(db, call, CallStatusEnum.ENDED, by=user_id)
        await db.commit()
        await LiveKitService.delete_room(call.room_name)

        other_participant_id = call.receiver_id if user_id == call.caller_id else call.caller_id
        if other_participant_id:
            data = {
                "call_id": str(call.id),
                "status": call.status.value,
                "duration_seconds": call.duration_seconds,
            }
            asyncio.create_task(_emit(other_participant_id, "call_ended", "Call Ended", "The call has ended.", data))

        return call

    @staticmethod
    async def get_call_state(db: AsyncSession, call_id: int, user_id: str) -> dict:
        """The server's view of one call, for a client that may have missed events (app was in the
        background, socket dropped) to resync. Participants and anyone it was rung to may ask."""
        call = await db.get(Call, call_id)
        if not call:
            raise HTTPException(status_code=404, detail="Call not found")
        if user_id not in (call.caller_id, call.receiver_id) and user_id not in await CallService.rung_ids(db, call):
            raise HTTPException(status_code=403, detail="Not your call")
        return {
            "call_id": str(call.id),
            "status": call.status.value,
            "kind": call.kind,
            "receiver_id": call.receiver_id,
            "answered_by_other": bool(call.receiver_id and user_id not in (call.caller_id, call.receiver_id)),
            "duration_seconds": call.duration_seconds,
        }

    @staticmethod
    async def rate_call(db: AsyncSession, call_id: int, user_id: str, rating: int, feedback: str | None = None):
        stmt = select(Call).where(Call.id == call_id).with_for_update()
        result = await db.execute(stmt)
        call = result.scalar_one_or_none()

        if not call:
            raise HTTPException(status_code=404, detail="Call not found")

        # Allow either participant to rate
        if user_id not in (call.caller_id, call.receiver_id):
            raise HTTPException(status_code=403, detail="Unauthorized to rate this call")

        call.rating = rating
        call.feedback = feedback
        
        await db.commit()
        await db.refresh(call)
        return call

    @staticmethod
    async def get_history(db: AsyncSession, user_id: str, limit: int = 20, offset: int = 0):
        stmt = (
            select(Call)
            .options(
                selectinload(Call.caller).selectinload(User.nurse_profile),
                selectinload(Call.caller).selectinload(User.driver_profile),
                selectinload(Call.receiver).selectinload(User.nurse_profile),
                selectinload(Call.receiver).selectinload(User.driver_profile)
            )
            .where(or_(Call.caller_id == user_id, Call.receiver_id == user_id))
            .order_by(desc(Call.created_at))
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(stmt)
        calls = result.scalars().all()
        return calls
