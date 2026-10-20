"""Who can call whom: nurse calls stay with nurses, and during a ride the mother and her driver can call each other."""
import pytest

from app.modules.calls.models import Call, CallStatusEnum
from app.modules.calls.services import call_service
from app.modules.calls.services.call_service import CallService
from app.modules.calls.services.livekit_service import LiveKitService
from app.modules.rides.models import Ride, RideStatusEnum
from app.modules.users.models import AccountStatusEnum, User, UserTypeEnum

pytestmark = pytest.mark.anyio

API = "/api/v1/calls"

# The autouse fixture below swaps the watchdogs for no-ops; keep the real ones for the tests that need them.
_REAL_RING_WATCHDOG = CallService._ring_timeout_watchdog
_REAL_RECONNECT_WATCHDOG = CallService._reconnect_watchdog


@pytest.fixture(autouse=True)
def _no_livekit(monkeypatch):
    async def _noop(*a, **k):
        return None

    monkeypatch.setattr(LiveKitService, "create_room", staticmethod(_noop))
    monkeypatch.setattr(LiveKitService, "delete_room", staticmethod(_noop))
    monkeypatch.setattr(LiveKitService, "create_token", staticmethod(lambda *a, **k: "tok"))
    monkeypatch.setattr(CallService, "_ring_timeout_watchdog", staticmethod(_noop))
    monkeypatch.setattr(CallService, "_reconnect_watchdog", staticmethod(_noop))
    sent = []

    async def _emit(user_id, event_type, title, body, data):
        sent.append((user_id, event_type, data))

    monkeypatch.setattr(call_service, "_emit", _emit)
    return sent


@pytest.fixture
def person(make_user, session_factory):
    async def _make(name, user_type=UserTypeEnum.user, online=False, approved=True):
        u = await make_user(name)
        async with session_factory() as s:
            row = await s.get(User, u.id)
            row.user_type = user_type
            row.is_online = online
            row.account_status = AccountStatusEnum.active if approved else AccountStatusEnum.pending
            await s.commit()
            return row
    return _make


async def _ride(session_factory, rider, driver, status=RideStatusEnum.DRIVER_ASSIGNED):
    async with session_factory() as s:
        r = Ride(rider_id=rider.id, driver_id=driver.id if driver else None, status=status,
                 pickup_lat=6.5, pickup_lng=3.3, dropoff_lat=6.6, dropoff_lng=3.4)
        s.add(r)
        await s.commit()
        return r


async def test_an_open_call_rings_online_nurses_and_only_a_nurse_can_answer(person, as_user, _no_livekit):
    mum = await person("Amara")
    nurse = await person("Nurse Joy", UserTypeEnum.nurse, online=True)
    driver = await person("David", UserTypeEnum.driver, online=True)

    call = (await (await as_user(mum)).post(f"{API}/request", json={})).json()
    assert call["kind"] == "nurse" and call["receiver_id"] is None
    rung = {u for u, ev, _ in _no_livekit if ev == "incoming_call"}
    assert rung == {nurse.id}

    assert (await (await as_user(driver)).post(f"{API}/{call['id']}/accept")).status_code == 403
    ok = await (await as_user(nurse)).post(f"{API}/{call['id']}/accept")
    assert ok.status_code == 200 and ok.json()["call"]["receiver_id"] == nurse.id


async def test_naming_someone_who_is_not_a_nurse_is_refused(person, as_user):
    mum = await person("Amara")
    driver = await person("David", UserTypeEnum.driver)
    r = await (await as_user(mum)).post(f"{API}/request", json={"nurse_id": driver.id})
    assert r.status_code == 400


async def test_mother_and_driver_call_each_other_during_a_ride(person, as_user, session_factory, _no_livekit):
    mum = await person("Amara")
    driver = await person("David", UserTypeEnum.driver)
    nurse = await person("Nurse Joy", UserTypeEnum.nurse, online=True)
    ride = await _ride(session_factory, mum, driver)

    call = (await (await as_user(mum)).post(f"{API}/request", json={"ride_id": ride.id})).json()
    assert call["kind"] == "ride" and call["ride_id"] == ride.id and call["receiver_id"] == driver.id
    rung = [(u, d) for u, ev, d in _no_livekit if ev == "incoming_call"]
    assert [u for u, _ in rung] == [driver.id]            # nurses are not rung for a ride call
    assert rung[0][1]["kind"] == "ride"

    assert (await (await as_user(nurse)).post(f"{API}/{call['id']}/accept")).status_code == 403
    assert (await (await as_user(driver)).post(f"{API}/{call['id']}/accept")).status_code == 200
    joined = await (await as_user(mum)).post(f"{API}/{call['id']}/join")
    assert joined.status_code == 200 and joined.json()["participant"]["id"] == driver.id

    # nobody can start a second call while this one is live
    assert (await (await as_user(driver)).post(f"{API}/request", json={"ride_id": ride.id})).status_code == 409
    assert (await (await as_user(mum)).post(f"{API}/{call['id']}/end")).status_code == 200

    # and the other way round
    back = (await (await as_user(driver)).post(f"{API}/request", json={"ride_id": ride.id})).json()
    assert back["receiver_id"] == mum.id


async def test_ride_calls_need_an_active_ride_you_are_on(person, as_user, session_factory):
    mum = await person("Amara")
    driver = await person("David", UserTypeEnum.driver)
    stranger = await person("Eve")
    done = await _ride(session_factory, mum, driver, RideStatusEnum.COMPLETED)
    searching = await _ride(session_factory, mum, None, RideStatusEnum.SEARCHING)
    live = await _ride(session_factory, mum, driver)

    c = await as_user(mum)
    assert (await c.post(f"{API}/request", json={"ride_id": done.id})).status_code == 400
    assert (await c.post(f"{API}/request", json={"ride_id": searching.id})).status_code == 400
    assert (await (await as_user(stranger)).post(f"{API}/request", json={"ride_id": live.id})).status_code == 404


async def test_nurse_stats_count_today_and_average_ratings(person, as_user, session_factory):
    from datetime import datetime, timezone
    mum = await person("Amara")
    nurse = await person("Nurse Joy", UserTypeEnum.nurse)
    async with session_factory() as s:
        for i, rating in enumerate([5, 4, None]):
            s.add(Call(caller_id=mum.id, receiver_id=nurse.id, room_name=f"r{i}", duration_seconds=120,
                       rating=rating, created_at=datetime.now(timezone.utc)))
        s.add(Call(caller_id=mum.id, receiver_id=nurse.id, room_name="missed", duration_seconds=0))
        await s.commit()
    stats = (await (await as_user(nurse)).get(f"{API}/stats")).json()
    assert stats["total_calls"] == 3 and stats["today_calls"] == 3
    assert stats["rating_avg"] == 4.5 and stats["rating_count"] == 2



def _events(sent, event):
    return {u for u, ev, _ in sent if ev == event}


async def test_only_approved_online_free_nurses_are_rung(person, as_user, session_factory, _no_livekit):
    mum = await person("Amara")
    free = await person("Free", UserTypeEnum.nurse, online=True)
    await person("Offline", UserTypeEnum.nurse)
    await person("Pending", UserTypeEnum.nurse, online=True, approved=False)
    busy = await person("Busy", UserTypeEnum.nurse, online=True)
    other_mum = await person("Bisi")
    async with session_factory() as s:
        s.add(Call(caller_id=other_mum.id, receiver_id=busy.id, room_name="live", status=CallStatusEnum.CONNECTED))
        await s.commit()
    await (await as_user(mum)).post(f"{API}/request", json={})
    assert _events(_no_livekit, "incoming_call") == {free.id}


async def test_no_free_nurse_is_refused_straight_away(person, as_user):
    mum = await person("Amara")
    r = await (await as_user(mum)).post(f"{API}/request", json={})
    assert r.status_code == 409 and "No nurse" in r.json()["message"]


async def test_cancel_and_answer_stop_every_other_nurse_ringing(person, as_user, _no_livekit):
    mum = await person("Amara")
    a = await person("A", UserTypeEnum.nurse, online=True)
    b = await person("B", UserTypeEnum.nurse, online=True)
    c = await as_user(mum)

    first = (await c.post(f"{API}/request", json={})).json()
    _no_livekit.clear()
    assert (await c.post(f"{API}/{first['id']}/end")).status_code == 200
    assert _events(_no_livekit, "call_ended") == {a.id, b.id}          # both nurses stop ringing

    second = (await c.post(f"{API}/request", json={})).json()
    _no_livekit.clear()
    assert (await (await as_user(a)).post(f"{API}/{second['id']}/accept")).status_code == 200
    taken = [(u, d) for u, ev, d in _no_livekit if ev == "call_accepted"]
    assert {u for u, _ in taken} == {mum.id, b.id}
    assert [d.get("taken") for u, d in taken if u == b.id] == [True]
    assert (await (await as_user(b)).post(f"{API}/{second['id']}/accept")).status_code == 400


async def test_a_new_request_replaces_her_ringing_one(person, as_user, session_factory, _no_livekit):
    mum = await person("Amara")
    await person("A", UserTypeEnum.nurse, online=True)
    c = await as_user(mum)
    first = (await c.post(f"{API}/request", json={})).json()
    second = (await c.post(f"{API}/request", json={})).json()
    async with session_factory() as s:
        assert (await s.get(Call, first["id"])).status == CallStatusEnum.CANCELLED
        assert (await s.get(Call, second["id"])).status == CallStatusEnum.RINGING


async def test_when_every_nurse_declines_she_hears_at_once(person, as_user, _no_livekit):
    mum = await person("Amara")
    a = await person("A", UserTypeEnum.nurse, online=True)
    b = await person("B", UserTypeEnum.nurse, online=True)
    call = (await (await as_user(mum)).post(f"{API}/request", json={})).json()
    await (await as_user(a)).post(f"{API}/{call['id']}/reject")
    assert mum.id not in _events(_no_livekit, "call_rejected")      # B may still answer
    await (await as_user(b)).post(f"{API}/{call['id']}/reject")
    assert mum.id in _events(_no_livekit, "call_rejected")


async def test_state_endpoint_lets_a_client_resync(person, as_user):
    mum = await person("Amara")
    a = await person("A", UserTypeEnum.nurse, online=True)
    b = await person("B", UserTypeEnum.nurse, online=True)
    stranger = await person("Eve")
    call = (await (await as_user(mum)).post(f"{API}/request", json={})).json()
    assert (await (await as_user(mum)).get(f"{API}/{call['id']}/state")).json()["status"] == "RINGING"
    await (await as_user(a)).post(f"{API}/{call['id']}/accept")
    seen_by_b = (await (await as_user(b)).get(f"{API}/{call['id']}/state")).json()
    assert seen_by_b["status"] in ("ACCEPTED", "CONNECTING") and seen_by_b["answered_by_other"] is True
    assert (await (await as_user(stranger)).get(f"{API}/{call['id']}/state")).status_code == 403


async def test_timeout_tells_her_and_every_rung_nurse(person, as_user, session_factory, monkeypatch, _no_livekit):
    monkeypatch.setattr(call_service, "AsyncSessionLocal", session_factory)
    monkeypatch.setattr(call_service, "RING_TIMEOUT_SECONDS", 0)
    mum = await person("Amara")
    a = await person("A", UserTypeEnum.nurse, online=True)
    call = (await (await as_user(mum)).post(f"{API}/request", json={})).json()
    _no_livekit.clear()
    await _REAL_RING_WATCHDOG(call["id"])
    assert _events(_no_livekit, "call_timeout") == {mum.id}
    assert _events(_no_livekit, "call_missed") == {a.id}
    async with session_factory() as s:
        assert (await s.get(Call, call["id"])).status == CallStatusEnum.TIMEOUT


async def test_a_dropped_participant_who_does_not_return_ends_the_call(person, session_factory, monkeypatch, _no_livekit):
    from datetime import datetime, timedelta, timezone
    monkeypatch.setattr(call_service, "AsyncSessionLocal", session_factory)
    monkeypatch.setattr(call_service, "RECONNECT_GRACE_SECONDS", 0)
    mum = await person("Amara")
    a = await person("A", UserTypeEnum.nurse)
    started = datetime.now(timezone.utc) - timedelta(minutes=3)
    async with session_factory() as s:
        c = Call(caller_id=mum.id, receiver_id=a.id, room_name="r-drop", status=CallStatusEnum.RECONNECTING, started_at=started)
        s.add(c)
        await s.commit()
        call_id = c.id
    await _REAL_RECONNECT_WATCHDOG(call_id)
    async with session_factory() as s:
        c = await s.get(Call, call_id)
        assert c.status == CallStatusEnum.ENDED and c.duration_seconds >= 179
    assert _events(_no_livekit, "call_ended") == {mum.id, a.id}
