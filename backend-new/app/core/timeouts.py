"""
Durable safety net for every call and ride timeout.

The precise timers (45 s ring, 30 s reconnect grace, ride offer rounds) are asyncio tasks inside the
process that started them. A restart, deploy or crash loses them, which used to leave calls ringing
and rides "searching" forever. This sweep runs every TIMEOUT_SWEEP_SECONDS on one process (advisory
lock) and finishes anything overdue using the same code paths, so the outcome - and what each phone
is told - is identical, just up to one sweep later.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.leader import leader
from app.modules.calls.models import Call, CallStatusEnum
from app.modules.calls.services import call_service
from app.modules.calls.services.call_service import CallService
from app.modules.calls.services.livekit_service import LiveKitService
from app.modules.rides.models import Ride, RideOffer, RideOfferStatusEnum, RideStatusEnum
from app.modules.rides.services import ride_service
from app.modules.rides.services.ride_service import RideService

logger = logging.getLogger("timeouts")

LOCK_KEY = 7_340_021
GRACE = 5                      # let the in-process timer win when it is alive
CONNECT_DEADLINE = 120         # answered but nobody ever got into the room

_task: Optional[asyncio.Task] = None


def _cut(db, seconds: float) -> datetime:
    """Cutoff `seconds` ago; naive UTC on SQLite, which stores timestamps without a zone."""
    t = datetime.now(timezone.utc) - timedelta(seconds=seconds)
    return t.replace(tzinfo=None) if db.bind.dialect.name == "sqlite" else t


async def _locked_call(db, call_id: int) -> Optional[Call]:
    return (await db.execute(select(Call).where(Call.id == call_id).with_for_update())).scalar_one_or_none()


async def sweep_once(session_factory=AsyncSessionLocal) -> dict:
    done = {"calls_timed_out": 0, "calls_dropped": 0, "calls_never_connected": 0, "rides_no_drivers": 0, "rides_redispatched": 0}
    async with session_factory() as db:
        # 1. Calls still ringing past the ring timeout.
        ids = (await db.execute(select(Call.id).where(
            Call.status.in_([CallStatusEnum.REQUESTED, CallStatusEnum.RINGING]),
            Call.created_at < _cut(db, call_service.RING_TIMEOUT_SECONDS + GRACE),
        ))).scalars().all()
        for cid in ids:
            call = await _locked_call(db, cid)
            if call and call.status in (CallStatusEnum.REQUESTED, CallStatusEnum.RINGING):
                await CallService._stop_ringing(db, call, CallStatusEnum.TIMEOUT, notify_caller=True)
                done["calls_timed_out"] += 1
            await db.commit()

        # 2. Someone dropped out of a connected call and never came back.
        ids = (await db.execute(select(Call.id).where(
            Call.status == CallStatusEnum.RECONNECTING,
            Call.updated_at < _cut(db, call_service.RECONNECT_GRACE_SECONDS + GRACE),
        ))).scalars().all()
        # 3. Answered, but the two never met in the room (app killed while connecting, etc.).
        stuck = (await db.execute(select(Call.id).where(
            Call.status.in_([CallStatusEnum.ACCEPTED, CallStatusEnum.CONNECTING]),
            Call.updated_at < _cut(db, CONNECT_DEADLINE),
        ))).scalars().all()
        for cid, status, event, key in [*[(i, CallStatusEnum.ENDED, "call_ended", "calls_dropped") for i in ids],
                                        *[(i, CallStatusEnum.FAILED, "call_failed", "calls_never_connected") for i in stuck]]:
            call = await _locked_call(db, cid)
            if not call or call.status in call_service.TERMINAL_STATUSES:
                await db.commit()
                continue
            await CallService._finish(db, call, status, by=None)
            await db.commit()
            data = {"call_id": str(call.id), "status": call.status.value, "duration_seconds": call.duration_seconds}
            for uid in (call.caller_id, call.receiver_id):
                if uid:
                    await call_service._emit(uid, event, "Call ended", "The call was disconnected.", data)
            await LiveKitService.delete_room(call.room_name)
            done[key] += 1

        # 4. Rides still searching. `updated_at` is when the search (re)started (request, or a driver
        #    backing out). Past every dispatch round: give up and tell her. Otherwise, if nobody is
        #    left to wait on, expire stale offers and look wider - what the lost watchdog would do.
        window = settings.RIDE_OFFER_TIMEOUT_SECONDS * RideService.DISPATCH_ROUNDS + GRACE
        rides = (await db.execute(select(Ride).where(
            Ride.status == RideStatusEnum.SEARCHING,
            Ride.updated_at < _cut(db, settings.RIDE_OFFER_TIMEOUT_SECONDS + GRACE),
        ))).scalars().all()
        overdue_cut = _cut(db, window)
        for ride in rides:
            ride = (await db.execute(select(Ride).where(Ride.id == ride.id).with_for_update())).scalar_one_or_none()
            if not ride or ride.status != RideStatusEnum.SEARCHING:
                await db.commit()
                continue
            updated = ride.updated_at.replace(tzinfo=None) if overdue_cut.tzinfo is None else (
                ride.updated_at if ride.updated_at.tzinfo else ride.updated_at.replace(tzinfo=timezone.utc))
            if updated < overdue_cut:
                await RideService._mark_no_drivers(db, ride.id)
                done["rides_no_drivers"] += 1
                continue
            stale = datetime.now(timezone.utc) - timedelta(seconds=settings.RIDE_OFFER_TIMEOUT_SECONDS)
            await RideService._withdraw_offers(db, ride, "ride_taken", older_than=stale)
            await db.commit()
            if await RideService._pending_offers(db, ride.id) == 0:
                if await RideService._dispatch(db, ride, settings.RIDE_SEARCH_RADIUS_MAX_KM) == 0:
                    await RideService._mark_no_drivers(db, ride.id)
                    done["rides_no_drivers"] += 1
                else:
                    done["rides_redispatched"] += 1
    return done


async def _loop() -> None:
    while True:
        try:
            async with leader(LOCK_KEY) as ok:
                if ok:
                    done = await sweep_once()
                    if any(done.values()):
                        logger.info("timeout sweep: %s", done)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("timeout sweep failed: %s", e)
        await asyncio.sleep(settings.TIMEOUT_SWEEP_SECONDS)


def start_timeout_sweeper() -> None:
    global _task
    if _task is None:
        _task = asyncio.create_task(_loop())


async def stop_timeout_sweeper() -> None:
    global _task
    if _task:
        _task.cancel()
        try:
            await _task
        except (asyncio.CancelledError, Exception):
            pass
        _task = None
