"""Admin portal operations: rides, calls, payouts, support, KYC, community moderation, analytics, reports, profile."""
from datetime import datetime, timedelta, timezone

import pytest

from app.modules.account.models import SupportMessage
from app.modules.calls.models import Call, CallStatusEnum
from app.modules.community.models import CommunityPost, CommunityPostStats
from app.modules.rides.models import Ride, RideStatusEnum
from app.modules.subscriptions.models import Subscription
from app.modules.users.models import AccountStatusEnum, DriverProfile, NurseProfile, User, UserTypeEnum
from tests.test_admin_staff import API, api, bearer, mail, make_staff, sign_in  # noqa: F401  (fixtures)

pytestmark = pytest.mark.anyio
NOW = datetime.now(timezone.utc)


@pytest.fixture
def world(session_factory, make_user):
    async def _seed():
        mum = await make_user("Ada Eze")
        other = await make_user("Bisi Adeyemi")
        driver = await make_user("Emeka Okoro")
        nurse = await make_user("Chiamaka Nwankwo")
        async with session_factory() as s:
            d = await s.get(User, driver.id)
            d.user_type, d.account_status, d.is_online = UserTypeEnum.driver, AccountStatusEnum.active, True
            s.add(DriverProfile(user_id=driver.id, vehicle_brand="Toyota", vehicle_model="Sienna", plate_number="LAG-1",
                                submitted_at=NOW, verification_documents={"driver_license": "https://res.cloudinary.com/x/dl.pdf"}))
            n = await s.get(User, nurse.id)
            n.user_type = UserTypeEnum.nurse
            s.add(NurseProfile(user_id=nurse.id, years_of_experience=6, hospital_affiliation="LUTH",
                               verification_documents={"photo": "https://res.cloudinary.com/x/p.jpg", "licenseNumber": "RN-1"}))
            common = dict(pickup_lat=6.5, pickup_lng=3.3, dropoff_lat=6.6, dropoff_lng=3.4)
            s.add_all([
                Ride(id=1, rider_id=mum.id, driver_id=driver.id, status=RideStatusEnum.COMPLETED, pickup_address="Yaba, Lagos",
                     dropoff_name="LUTH", fare_final=4200, requested_at=NOW - timedelta(hours=3),
                     assigned_at=NOW - timedelta(hours=3) + timedelta(minutes=4), completed_at=NOW - timedelta(hours=2), **common),
                Ride(id=2, rider_id=other.id, driver_id=driver.id, status=RideStatusEnum.COMPLETED, pickup_address="Ikeja",
                     dropoff_name="LASUTH", fare_final=6000, requested_at=NOW - timedelta(hours=1), completed_at=NOW, **common),
                Ride(id=3, rider_id=other.id, status=RideStatusEnum.CANCELLED, pickup_address="Surulere", dropoff_name="LUTH",
                     requested_at=NOW, **common),
                Call(caller_id=mum.id, receiver_id=nurse.id, status=CallStatusEnum.ENDED, room_name="r1", kind="nurse",
                     answered_at=NOW, duration_seconds=1104, rating=5),
                Call(caller_id=other.id, receiver_id=nurse.id, status=CallStatusEnum.MISSED, room_name="r2", kind="nurse"),
                SupportMessage(user_id=mum.id, user_type="user", name="Ada Eze", email="ada@example.com",
                               subject="Rides & trips", message="Reported feeling unsafe during a ride."),
                Subscription(user_id=mum.id, plan="monthly", status="active", current_period_end=NOW + timedelta(days=20)),
                Subscription(user_id=other.id, plan="annual", status="trialing", trial_ends_at=NOW + timedelta(days=3),
                             current_period_end=NOW + timedelta(days=3)),
            ])
            post = CommunityPost(author_id=other.id, body="This home remedy will cure every pregnancy complication.")
            s.add(post)
            await s.flush()
            s.add(CommunityPostStats(post_id=post.id))
            await s.commit()
            return {"mum": mum, "other": other, "driver": driver, "nurse": nurse, "post_id": post.id}
    return _seed


async def test_rides_list_tabs_and_detail(api, mail, make_staff, world):
    w = await world()
    await make_staff("rides@lonimum.com", ["rides.view"])
    h = bearer(await sign_in(api, mail, "rides@lonimum.com"))
    data = (await api.get(f"{API}/rides", headers=h)).json()["data"]
    assert data["total"] == 3 and data["counts"]["completed"] == 2 and data["counts"]["cancelled"] == 1
    assert data["items"][0]["route"] == "Surulere → LUTH"
    found = (await api.get(f"{API}/rides?q=RIDE-1", headers=h)).json()["data"]["items"]
    assert [r["id"] for r in found] == [1]
    detail = (await api.get(f"{API}/rides/1", headers=h)).json()["data"]
    assert detail["mother"] == "Ada Eze" and detail["payout"]["status"] == "pending"
    assert (await api.get(f"{API}/calls", headers=h)).status_code == 403


async def test_calls_never_name_the_mother(api, mail, make_staff, world):
    w = await world()
    await make_staff("calls@lonimum.com", ["calls.view"])
    h = bearer(await sign_in(api, mail, "calls@lonimum.com"))
    res = await api.get(f"{API}/calls", headers=h)
    data = res.json()["data"]
    assert data["counts"] == {"all": 2, "in_progress": 0, "completed": 1, "failed": 1}
    assert "Ada Eze" not in res.text and data["items"][0]["user_ref"].startswith("Mother · USR-")
    done = next(i for i in data["items"] if i["status"] == "completed")
    assert done["duration_seconds"] == 1104 and done["nurse"] == "Chiamaka Nwankwo"


async def test_payouts_summary_verify_and_permissions(api, mail, make_staff, world):
    await world()
    await make_staff("fin@lonimum.com", ["payments.view"], role_name="Finance viewer")
    view = bearer(await sign_in(api, mail, "fin@lonimum.com"))
    data = (await api.get(f"{API}/payouts", headers=view)).json()["data"]
    assert data["summary"] == {"eligible": 10200, "pending": 10200, "paid": 0} and data["total"] == 2
    assert (await api.post(f"{API}/payouts/1/verify", headers=view, json={})).status_code == 403

    await make_staff("pay@lonimum.com", ["payments.view", "payments.manage"], role_name="Finance")
    pay = bearer(await sign_in(api, mail, "pay@lonimum.com"))
    assert (await api.post(f"{API}/payouts/1/verify", headers=pay, json={"reference": "TRF-001"})).status_code == 200
    assert (await api.post(f"{API}/payouts/1/verify", headers=pay, json={})).status_code == 409
    assert (await api.post(f"{API}/payouts/3/verify", headers=pay, json={})).status_code == 404  # not completed
    after = (await api.get(f"{API}/payouts?tab=paid", headers=pay)).json()["data"]
    assert after["summary"]["paid"] == 4200 and after["items"][0]["reference"] == "TRF-001"


async def test_support_status_flow(api, mail, make_staff, world):
    await world()
    await make_staff("sup@lonimum.com", ["support.manage"])
    h = bearer(await sign_in(api, mail, "sup@lonimum.com"))
    items = (await api.get(f"{API}/support", headers=h)).json()["data"]["items"]
    msg_id = items[0]["id"]
    assert items[0]["ref"] == f"INC-{msg_id}" and items[0]["reporter_type"] == "Mother"
    assert (await api.post(f"{API}/support/{msg_id}/status", headers=h, json={"status": "resolved"})).status_code == 200
    data = (await api.get(f"{API}/support?tab=resolved", headers=h)).json()["data"]
    assert data["total"] == 1 and data["counts"]["open"] == 0
    detail = (await api.get(f"{API}/support/{msg_id}", headers=h)).json()["data"]
    assert detail["resolved_by"] and detail["message"].startswith("Reported feeling unsafe")


async def test_kyc_queue_and_driver_tabs(api, mail, make_staff, world):
    w = await world()
    await make_staff("kyc@lonimum.com", ["kyc.review", "drivers.view"])
    h = bearer(await sign_in(api, mail, "kyc@lonimum.com"))
    data = (await api.get(f"{API}/kyc", headers=h)).json()["data"]
    assert data["counts"]["approved"] == 1 and data["counts"]["pending"] == 1
    nurse = next(i for i in data["items"] if i["kind"] == "nurse")
    assert nurse["documents"] == "2 of 4 documents" and nurse["status"] == "pending"
    drivers = (await api.get(f"{API}/accounts?segment=drivers&tab=online", headers=h)).json()["data"]
    assert drivers["total"] == 1 and drivers["items"][0]["rides"] == 2
    activity = (await api.get(f"{API}/accounts/{w['driver'].id}/activity", headers=h)).json()["data"]
    assert activity["total"] == 2


async def test_community_report_to_removal(api, mail, make_staff, world, as_user, session_factory):
    w = await world()
    mum_client = await as_user(w["mum"])
    r = await mum_client.post(f"/api/v1/community/posts/{w['post_id']}/report", json={"reason": "harmful_medical_advice"})
    assert r.status_code == 200
    again = await mum_client.post(f"/api/v1/community/posts/{w['post_id']}/report", json={"reason": "misinformation"})
    assert again.status_code == 200  # updates, doesn't double count

    await make_staff("mod@lonimum.com", ["community.moderate"])
    h = bearer(await sign_in(api, mail, "mod@lonimum.com"))
    data = (await api.get(f"{API}/community/reports", headers=h)).json()["data"]
    assert data["total"] == 1 and data["items"][0]["reports"] == 1 and data["summary"]["new"]["value"] == 1
    detail = (await api.get(f"{API}/community/posts/{w['post_id']}", headers=h)).json()["data"]
    assert "Ada" not in str(detail["reports"])  # reporters are anonymous
    assert (await api.post(f"{API}/community/posts/{w['post_id']}/action", headers=h, json={"action": "remove"})).status_code == 400
    assert (await api.post(f"{API}/community/posts/{w['post_id']}/action", headers=h,
                           json={"action": "remove", "note": "Dangerous medical claim."})).status_code == 200
    async with session_factory() as s:
        assert (await s.get(CommunityPost, w["post_id"])).deleted_at is not None
    feed = (await mum_client.get("/api/v1/community/posts")).json()
    assert all(p["id"] != w["post_id"] for p in feed["data"]["items"])


async def test_analytics_subscriptions_and_reports(api, mail, make_staff, world):
    await world()
    await make_staff("boss@lonimum.com", super_admin=True)
    h = bearer(await sign_in(api, mail, "boss@lonimum.com"))
    a = (await api.get(f"{API}/analytics?days=7", headers=h)).json()["data"]
    assert a["ride_outcomes"] == {"total": 3, "completed": 2, "cancelled": 1, "unfulfilled": 0}
    assert a["cards"]["dispatch_seconds"]["value"] == 240 and a["cards"]["active_users"]["value"] >= 2
    assert a["drivers"][0]["rides"] == 2
    sub = (await api.get(f"{API}/subscriptions/summary", headers=h)).json()["data"]
    assert sub["cards"]["premium"] == 1 and sub["cards"]["trials"] == 1 and sub["cards"]["revenue_estimate"] == 9900
    for kind in ("user_activity", "ride_operations", "driver_performance", "payout_reconciliation", "kyc_decisions", "subscription_revenue"):
        r = await api.get(f"{API}/reports/{kind}?days=30", headers=h)
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv"), kind
    assert (await api.get(f"{API}/reports/nope", headers=h)).status_code == 404


async def test_staff_can_edit_own_profile(api, mail, make_staff):
    await make_staff("me@lonimum.com", ["dashboard.view"])
    h = bearer(await sign_in(api, mail, "me@lonimum.com"))
    r = await api.patch(f"{API}/auth/me", headers=h, json={"name": "Serene  Okafor", "phone": "+234 803 555 0198", "timezone": "Africa/Lagos"})
    assert r.status_code == 200 and r.json()["name"] == "Serene Okafor" and r.json()["phone"] == "+234 803 555 0198"
    assert (await api.patch(f"{API}/auth/me", headers=h, json={"timezone": "Mars/Base"})).status_code == 400
    assert (await api.patch(f"{API}/auth/me", headers=h, json={"phone": "call me maybe"})).status_code == 400


async def test_app_report_contract(world, as_user):
    """The mother app reads data.reasons[{key,label}] and the top-level message after reporting."""
    w = await world()
    other = await as_user(w["mum"])
    reasons = (await other.get("/api/v1/community/report-reasons")).json()["data"]["reasons"]
    assert {"key": "harmful_medical_advice", "label": "Harmful medical advice"} in reasons and len(reasons) == 6
    r = await other.post(f"/api/v1/community/posts/{w['post_id']}/report", json={"reason": "spam", "note": "Selling tea"})
    assert r.status_code == 200 and "review" in r.json()["message"]
    assert (await other.post(f"/api/v1/community/posts/{w['post_id']}/report", json={"reason": "nonsense"})).status_code == 400
    author = await as_user(w["other"])
    own = await author.post(f"/api/v1/community/posts/{w['post_id']}/report", json={"reason": "spam"})
    assert own.status_code == 400 and own.json()["message"] == "You can't report your own post"
