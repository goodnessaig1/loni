"""Driver <-> mother: the ride never gets stuck, and both sides always hear what happened."""
import pytest
from sqlalchemy import select

from app.core.config import settings
from app.modules.rides.models import Ride, RideOffer, RideOfferStatusEnum, RideStatusEnum
from app.modules.rides.services import ride_service
from app.modules.rides.services.ride_service import RideService
from app.modules.users.models import AccountStatusEnum, DriverProfile, User, UserTypeEnum

pytestmark = pytest.mark.anyio

_REAL_WATCHDOG = RideService._offer_timeout_watchdog


@pytest.fixture(autouse=True)
def heard(monkeypatch, session_factory):
    out = []

    async def _emit(user_id, event_type, title, body, data):
        out.append((user_id, event_type, data))

    async def _ws(user_id, event_type, data):
        return True

    async def _noop(*a, **k):
        return None

    monkeypatch.setattr(ride_service, "_emit", _emit)
    monkeypatch.setattr(ride_service.ws_manager, "send_to_user", _ws)
    monkeypatch.setattr(ride_service, "AsyncSessionLocal", session_factory)
    monkeypatch.setattr(RideService, "_offer_timeout_watchdog", staticmethod(_noop))
    monkeypatch.setattr(RideService, "_alert_contacts", staticmethod(_noop))
    return out


def told(heard, event):
    return {u for u, e, _ in heard if e == event}


@pytest.fixture
def driver(make_user, session_factory):
    async def _make(name, lat=6.52, lng=3.38):
        u = await make_user(name)
        async with session_factory() as s:
            row = await s.get(User, u.id)
            row.user_type = UserTypeEnum.driver
            row.account_status = AccountStatusEnum.active
            row.is_online = True
            s.add(DriverProfile(user_id=u.id, is_available=True, current_lat=lat, current_lng=lng))
            await s.commit()
        return u
    return _make


@pytest.fixture
async def mum(make_user):
    return await make_user("Amara")


async def request(as_user, mum):
    body = {"pickup": {"lat": 6.5244, "lng": 3.3792}, "dropoff": {"lat": 6.455, "lng": 3.384}, "dropoff_name": "LUTH"}
    r = await (await as_user(mum)).post("/api/v1/rides/request", json=body)
    assert r.status_code == 200, r.text
    return r.json()


async def status(session_factory, ride_id):
    async with session_factory() as s:
        return (await s.get(Ride, ride_id)).status


async def test_ignored_offers_expire_and_she_is_told_no_driver(as_user, mum, driver, session_factory, heard, monkeypatch):
    monkeypatch.setattr(settings, "RIDE_OFFER_TIMEOUT_SECONDS", 0)
    d = await driver("David")
    ride = await request(as_user, mum)
    assert told(heard, "ride_request") == {d.id}
    heard.clear()
    await _REAL_WATCHDOG(ride["id"])                       # David never answers
    assert await status(session_factory, ride["id"]) == RideStatusEnum.NO_DRIVERS
    assert told(heard, "ride_no_drivers") == {mum.id}
    assert d.id in told(heard, "ride_taken")               # the request leaves David's screen
    async with session_factory() as s:
        offers = (await s.execute(select(RideOffer))).scalars().all()
    assert all(o.status == RideOfferStatusEnum.EXPIRED for o in offers)


async def test_her_cancel_reaches_drivers_still_looking_at_the_request(as_user, mum, driver, heard):
    a, b = await driver("A"), await driver("B")
    ride = await request(as_user, mum)
    heard.clear()
    assert (await (await as_user(mum)).post(f"/api/v1/rides/{ride['id']}/cancel", json={})).status_code == 200
    assert told(heard, "ride_cancelled") == {a.id, b.id}


async def test_when_every_driver_declines_she_hears_straight_away(as_user, mum, driver, session_factory, heard):
    a = await driver("A")
    ride = await request(as_user, mum)
    assert (await (await as_user(a)).post(f"/api/v1/rides/{ride['id']}/decline")).status_code == 200
    assert await status(session_factory, ride["id"]) == RideStatusEnum.NO_DRIVERS
    assert mum.id in told(heard, "ride_no_drivers")


async def test_a_driver_who_backs_out_hands_her_to_another_driver(as_user, mum, driver, session_factory, heard):
    a, b = await driver("A"), await driver("B", lat=6.60, lng=3.40)
    ride = await request(as_user, mum)
    assert (await (await as_user(a)).post(f"/api/v1/rides/{ride['id']}/accept")).status_code == 200
    heard.clear()

    r = await (await as_user(a)).post(f"/api/v1/rides/{ride['id']}/cancel", json={"reason": "Flat tyre"})
    assert r.status_code == 200 and r.json()["status"] == "SEARCHING" and r.json()["driver_id"] is None
    assert mum.id in told(heard, "ride_driver_cancelled")
    async with session_factory() as s:
        prof = (await s.execute(select(DriverProfile).where(DriverProfile.user_id == a.id))).scalar_one()
        assert prof.active_ride_id is None and prof.is_available
    # B (outside the first 8 km search) is offered it now; A is not offered it again
    assert told(heard, "ride_request") == {b.id}
    assert (await (await as_user(b)).post(f"/api/v1/rides/{ride['id']}/accept")).status_code == 200
    assert await status(session_factory, ride["id"]) == RideStatusEnum.DRIVER_ASSIGNED


async def test_unapproved_driver_cannot_accept(as_user, mum, driver, session_factory):
    d = await driver("New")
    ride = await request(as_user, mum)
    async with session_factory() as s:
        (await s.get(User, d.id)).account_status = AccountStatusEnum.pending
        await s.commit()
    assert (await (await as_user(d)).post(f"/api/v1/rides/{ride['id']}/accept")).status_code == 403
