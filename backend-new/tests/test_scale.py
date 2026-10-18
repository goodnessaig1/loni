"""Scale safety nets: timeouts that survive restarts, events across processes, capped fan-out."""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core import timeouts
from app.core.config import settings
from app.core.ws_manager import ConnectionManager
from app.modules.calls.models import Call, CallStatusEnum
from app.modules.calls.services import call_service
from app.modules.calls.services.call_service import CallService
from app.modules.calls.services.livekit_service import LiveKitService
from app.modules.rides.models import Ride, RideStatusEnum
from app.modules.rides.services import ride_service
from app.modules.users.models import AccountStatusEnum, User, UserTypeEnum

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def sent(monkeypatch):
    out = []

    async def _emit(user_id, event_type, title, body, data):
        out.append((user_id, event_type))

    async def _noop(*a, **k):
        return None

    async def _ws(*a, **k):
        return True

    monkeypatch.setattr(call_service, "_emit", _emit)
    monkeypatch.setattr(ride_service, "_emit", _emit)
    monkeypatch.setattr(ride_service.ws_manager, "send_to_user", _ws)
    monkeypatch.setattr(LiveKitService, "delete_room", staticmethod(_noop))
    return out


def ago(seconds):
    return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=seconds)   # SQLite stores naive UTC


async def test_sweep_finishes_what_lost_timers_left_behind(make_user, session_factory, sent):
    mum, nurse = await make_user("Amara"), await make_user("Joy")
    async with session_factory() as s:
        ringing = Call(caller_id=mum.id, room_name="r1", status=CallStatusEnum.RINGING, created_at=ago(120), updated_at=ago(120))
        dropped = Call(caller_id=mum.id, receiver_id=nurse.id, room_name="r2", status=CallStatusEnum.RECONNECTING,
                       started_at=ago(300), updated_at=ago(120))
        stuck = Call(caller_id=mum.id, receiver_id=nurse.id, room_name="r3", status=CallStatusEnum.CONNECTING,
                     answered_at=ago(600), updated_at=ago(600))
        fresh = Call(caller_id=mum.id, room_name="r4", status=CallStatusEnum.RINGING)
        search = Ride(rider_id=mum.id, status=RideStatusEnum.SEARCHING, pickup_lat=6.5, pickup_lng=3.3,
                      dropoff_lat=6.6, dropoff_lng=3.4, updated_at=ago(3600))
        s.add_all([ringing, dropped, stuck, fresh, search])
        await s.commit()
        ids = (ringing.id, dropped.id, stuck.id, fresh.id, search.id)

    done = await timeouts.sweep_once(session_factory)
    assert done["calls_timed_out"] == 1 and done["calls_dropped"] == 1 and done["calls_never_connected"] == 1
    assert done["rides_no_drivers"] == 1
    async with session_factory() as s:
        assert (await s.get(Call, ids[0])).status == CallStatusEnum.TIMEOUT
        assert (await s.get(Call, ids[1])).status == CallStatusEnum.ENDED
        assert (await s.get(Call, ids[2])).status == CallStatusEnum.FAILED
        assert (await s.get(Call, ids[3])).status == CallStatusEnum.RINGING      # not overdue yet
        assert (await s.get(Ride, ids[4])).status == RideStatusEnum.NO_DRIVERS
    assert (mum.id, "call_timeout") in sent and (nurse.id, "call_ended") in sent
    assert (mum.id, "ride_no_drivers") in sent
    # running again changes nothing
    assert not any((await timeouts.sweep_once(session_factory)).values())


class FakeRedis:
    """Just enough of redis.asyncio for pub/sub between two managers in one test."""
    def __init__(self):
        self.queues = []

    async def publish(self, channel, msg):
        for q in self.queues:
            q.put_nowait({"type": "message", "data": msg})

    def pubsub(self):
        q = asyncio.Queue()
        self.queues.append(q)

        class P:
            async def subscribe(self, channel):
                return None

            async def listen(self):
                while True:
                    yield await q.get()
        return P()


class FakeSocket:
    def __init__(self):
        self.got = []

    async def accept(self):
        return None

    async def send_text(self, text):
        self.got.append(text)


async def test_events_reach_a_user_connected_to_another_process():
    redis = FakeRedis()
    a, b = ConnectionManager(), ConnectionManager()
    for m in (a, b):
        m._redis = redis
        m._listener = asyncio.create_task(m._listen())
    await asyncio.sleep(0.01)                     # let both listeners subscribe
    import app.core.ws_manager as wsm
    b_id = "other-process"
    sock = FakeSocket()
    await b.connect("u1", sock)
    # b must look like a different process to a: give each its own instance id while publishing
    orig = wsm.INSTANCE_ID
    try:
        wsm.INSTANCE_ID = "process-a"
        await a.send_to_user("u1", "call_accepted", {"call_id": "7"})
        wsm.INSTANCE_ID = b_id
        for _ in range(20):
            if sock.got:
                break
            await asyncio.sleep(0.01)
    finally:
        wsm.INSTANCE_ID = orig
        for m in (a, b):
            m._listener.cancel()
    assert sock.got and '"call_accepted"' in sock.got[0]


async def test_an_open_call_rings_a_capped_number_of_nurses(make_user, session_factory, monkeypatch):
    monkeypatch.setattr(settings, "CALL_RING_MAX_NURSES", 3)
    for i in range(6):
        u = await make_user(f"Nurse {i}")
        async with session_factory() as s:
            row = await s.get(User, u.id)
            row.user_type, row.is_online, row.account_status = UserTypeEnum.nurse, True, AccountStatusEnum.active
            await s.commit()
    async with session_factory() as s:
        assert len(await CallService._available_nurses(s)) == 3


async def test_rate_limit_returns_429_after_the_limit(make_user, as_user, monkeypatch):
    from app.core import ratelimit
    monkeypatch.setattr(ratelimit, "_local", {})
    c = await as_user(await make_user("Amara"))
    codes = [(await c.post("/api/v1/account/support", json={"subject": "Other", "message": "hello there"})).status_code
             for _ in range(6)]
    assert codes[:5] == [201] * 5 and codes[5] == 429
