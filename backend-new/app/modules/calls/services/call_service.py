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
from app.modules.users.models import User, UserTypeEnum
from app.utils.user_enrichment import enrich_user_data
from app.core.ws_manager import manager as ws_manager
from app.core.database import AsyncSessionLocal

logger = logging.getLogger("call_service")

# How long a call is allowed to stay in REQUESTED/RINGING before we give up
# and mark it MISSED/TIMEOUT (Issue 8: these enum values existed but nothing
# ever set them, so an unanswered call stayed "REQUESTED" in the DB forever
# and the caller's screen had no server-driven way to know to stop trying).
RING_TIMEOUT_SECONDS = 45

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

        room_name = f"room-{uuid.uuid4()}"
        call = Call(
            caller_id=caller_id,
            receiver_id=request.nurse_id,
            status=CallStatusEnum.RINGING,
            room_name=room_name
        )
        db.add(call)
        await db.flush()

        participant = CallParticipant(
            call_id=call.id,
            user_id=caller_id,
            role=ParticipantRoleEnum.CALLER
        )
        db.add(participant)

        event = CallEvent(call_id=call.id, event_type="CallRequested")
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
        }

        if request.nurse_id:
            asyncio.create_task(_emit(
                request.nurse_id, "incoming_call", "Incoming Call", f"{caller_info.name} is calling you.", payload
            ))
        else:
            # Broadcast to all online nurses
            stmt = select(User.id).where(User.user_type == UserTypeEnum.nurse, User.is_online == True)
            result = await db.execute(stmt)
            nurse_ids = result.scalars().all()
            for n_id in nurse_ids:
                asyncio.create_task(_emit(
                    n_id, "incoming_call", "Incoming Call", f"{caller_info.name} is calling.", payload
                ))

        asyncio.create_task(CallService._ring_timeout_watchdog(call.id))

        return call

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

            call.status = CallStatusEnum.TIMEOUT
            call.ended_at = datetime.now(timezone.utc)
            db.add(CallEvent(call_id=call.id, event_type="CallTimeout"))
            await db.commit()

            data = {"call_id": str(call.id), "status": CallStatusEnum.TIMEOUT.value}
            await _emit(call.caller_id, "call_timeout", "No Answer", "No one answered your call.", data)
            if call.receiver_id:
                await _emit(call.receiver_id, "call_missed", "Missed Call", "You missed a call.", data)
            else:
                # broadcast case: tell all nurses who were rung to clear the UI
                stmt2 = select(User.id).where(User.user_type == UserTypeEnum.nurse, User.is_online == True)
                res2 = await db.execute(stmt2)
                for n_id in res2.scalars().all():
                    await _emit(n_id, "call_missed", "Missed Call", "You missed a call.", data)

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

        # If broadcast to all nurses, one nurse rejecting doesn't end the call
        if not call.receiver_id:
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

        was_still_ringing = call.status in (CallStatusEnum.REQUESTED, CallStatusEnum.RINGING)

        call.status = CallStatusEnum.CANCELLED if was_still_ringing else CallStatusEnum.ENDED
        call.ended_at = datetime.now(timezone.utc)

        # Talk time is measured from when media actually started (set by
        # the LiveKit webhook handler on room_started / first participant
        # join - see webhook_router.py), NOT from when the row was created.
        # Falls back to answered_at so we still record *something* if the
        # webhook never fired (e.g. webhooks misconfigured).
        basis = call.started_at or call.answered_at
        if basis:
            delta = call.ended_at - basis
            call.duration_seconds = max(0, int(delta.total_seconds()))

        db.add(CallEvent(call_id=call.id, event_type="CallEnded", payload={"ended_by": user_id}))

        # Issue 14: mark every participant who hasn't already left as having
        # left now, so call history / presence can be reconstructed later.
        # This column existed in the schema but nothing ever wrote to it.
        p_stmt = select(CallParticipant).where(
            CallParticipant.call_id == call.id, CallParticipant.left_at.is_(None)
        )
        p_result = await db.execute(p_stmt)
        for p in p_result.scalars().all():
            p.left_at = call.ended_at

        await LiveKitService.delete_room(call.room_name)

        await db.commit()

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
