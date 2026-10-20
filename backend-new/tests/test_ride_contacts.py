"""What a mother's support partners hear about her emergency ride, and the live progress she sees."""
import pytest
from sqlalchemy import select

from app.modules.notifications.models import NotificationLog
from app.modules.rides.models import Ride, RideStatusEnum
from app.modules.rides.services import ride_service
from app.modules.rides.services.ride_service import RideService, ride_progress
from app.modules.users.models import (
    AccountStatusEnum, DriverProfile, EmergencyContact, EmergencyContactStatus, User, UserTypeEnum,
)

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def heard(monkeypatch):
    """(user_id, event, via) for every message the ride service sends."""
    out = []

    async def _emit(user_id, event_type, title, body, data):
        out.append((user_id, event_type, "push+ws"))

    async def _ws(user_id, event_type, data):
        out.append((user_id, event_type, "ws"))
        return True

    monkeypatch.setattr(ride_service, "_emit", _emit)
    monkeypatch.setattr(ride_service.ws_manager, "send_to_user", _ws)
    return out


@pytest.fixture
async def circle(make_user, session_factory):
    """A mother, her driver, and three partners: connected, connected-without-location, still pending."""
    mum = await make_user("Amara Ogunleye")
    driver = await make_user("David Okafor")
    full = await make_user("Tunde")
    no_loc = await make_user("Sister")
    pending = await make_user("Cousin")
    async with session_factory() as s:
        d = await s.get(User, driver.id)
        d.user_type = UserTypeEnum.driver
        d.account_status = AccountStatusEnum.active
        s.add(DriverProfile(user_id=driver.id))
        s.add(EmergencyContact(user_id=mum.id, contact_user_id=full.id, relationship="Husband",
                               status=EmergencyContactStatus.connected))
        s.add(EmergencyContact(user_id=mum.id, contact_user_id=no_loc.id, relationship="Sister",
                               status=EmergencyContactStatus.connected, location=False))
        s.add(EmergencyContact(user_id=mum.id, contact_user_id=pending.id, relationship="Cousin"))
        ride = Ride(rider_id=mum.id, status=RideStatusEnum.SEARCHING, notify_contacts=True,
                    pickup_lat=6.5244, pickup_lng=3.3792, dropoff_lat=6.4550, dropoff_lng=3.3841,
                    distance_meters=8000, duration_seconds=1200)
        s.add(ride)
        await s.commit()
        return {"mum": mum, "driver": driver, "full": full, "no_loc": no_loc, "pending": pending, "ride": ride}


def _to(heard, event):
    return {u for u, e, _ in heard if e == event}


async def test_partners_hear_when_a_driver_accepts_but_pending_invites_do_not(session_factory, circle, heard):
    async with session_factory() as db:
        await RideService.accept_ride(db, circle["ride"].id, circle["driver"].id)
    assert _to(heard, "ride_accepted") == {circle["mum"].id, circle["full"].id, circle["no_loc"].id}


async def test_live_location_only_reaches_partners_she_shares_location_with(session_factory, circle, heard):
    async with session_factory() as db:
        await RideService.accept_ride(db, circle["ride"].id, circle["driver"].id)
        driver = (await db.execute(select(User).where(User.id == circle["driver"].id))).scalar_one()
        await db.refresh(driver, ["driver_profile"])
        heard.clear()
        await RideService.update_driver_location(db, driver, 6.5200, 3.3790, 90.0)
    assert _to(heard, "ride_driver_location") == {circle["mum"].id, circle["full"].id}


def test_progress_tells_her_when_the_driver_is_close_and_when_she_is_nearly_there():
    ride = Ride(status=RideStatusEnum.DRIVER_ASSIGNED, pickup_lat=6.5244, pickup_lng=3.3792,
                dropoff_lat=6.4550, dropoff_lng=3.3841, distance_meters=8000, duration_seconds=1200)
    far = ride_progress(ride, 6.56, 3.40)
    assert far["phase"] == "to_pickup" and not far["near"] and far["eta_seconds"] > 0
    assert ride_progress(ride, 6.5250, 3.3795)["near"]

    ride.status = RideStatusEnum.IN_PROGRESS
    p = ride_progress(ride, 6.4600, 3.3840)
    assert p["phase"] == "to_dropoff" and p["near"]

    ride.status = RideStatusEnum.DRIVER_ARRIVED
    assert ride_progress(ride, 0, 0) == {"phase": "at_pickup", "remaining_meters": 0, "eta_seconds": 0, "near": True}


async def test_she_can_share_her_trip_and_say_she_arrived(session_factory, circle, heard, as_user):
    async with session_factory() as s:
        r = await s.get(Ride, circle["ride"].id)
        r.notify_contacts = False
        await s.commit()
    c = await as_user(circle["mum"])
    url = f"/api/v1/rides/{circle['ride'].id}/notify-contacts"

    res = await c.post(url, json={"kind": "share"})
    assert res.status_code == 200 and res.json()["data"]["notified"] == 2
    assert _to(heard, "ride_contact_alert") == {circle["full"].id, circle["no_loc"].id}
    async with session_factory() as s:
        assert (await s.get(Ride, circle["ride"].id)).notify_contacts is True

    assert (await c.post(url, json={"kind": "arrived"})).status_code == 409   # not there yet
    async with session_factory() as s:
        r = await s.get(Ride, circle["ride"].id)
        r.status = RideStatusEnum.COMPLETED
        await s.commit()
    assert (await c.post(url, json={"kind": "arrived"})).status_code == 200
    async with session_factory() as s:
        logged = (await s.execute(select(NotificationLog).where(NotificationLog.type == "ride_arrived_safely"))).scalars().all()
    assert {n.user_id for n in logged} == {circle["full"].id, circle["no_loc"].id}

    other = await as_user(circle["full"])
    assert (await other.post(url, json={"kind": "share"})).status_code == 404       # only the mother can


async def test_a_partner_without_location_sharing_sees_the_ride_but_not_where_she_is(session_factory, circle, as_user):
    async with session_factory() as db:
        await RideService.accept_ride(db, circle["ride"].id, circle["driver"].id)
    url = f"/api/v1/rides/{circle['ride'].id}"
    full = (await (await as_user(circle["full"])).get(url)).json()
    assert full["pickup"] and full["location_shared"] is True
    private = (await (await as_user(circle["no_loc"])).get(url)).json()
    assert private["pickup"] is None and private["location_shared"] is False and private["driver"]["name"] == "David Okafor"
    assert (await (await as_user(circle["pending"])).get(url)).status_code == 403
