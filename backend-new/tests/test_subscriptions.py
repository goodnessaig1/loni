from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.modules.subscriptions.models import Subscription

pytestmark = pytest.mark.anyio

API = "/api/v1/subscriptions"


async def test_plans_are_served_by_the_backend(make_user, as_user):
    c = await as_user(await make_user("Ada One"))
    data = (await c.get(f"{API}/plans")).json()["data"]
    assert data["trial_days"] == 7
    assert {p["id"] for p in data["plans"]} == {"monthly", "annual"}
    assert data["features"][0] == "Unlimited Loni AI conversations"


async def test_no_subscription_by_default(make_user, as_user):
    c = await as_user(await make_user("Ada One"))
    me = (await c.get(f"{API}/me")).json()["data"]
    assert me["state"] == "none" and me["has_access"] is False and me["can_start_trial"] is True


async def test_trial_start_once_then_blocked(make_user, as_user):
    c = await as_user(await make_user("Ada One"))
    r = await c.post(f"{API}/trial", json={"plan": "annual"})
    assert r.status_code == 201
    sub = r.json()["data"]
    assert sub["state"] == "trialing" and sub["has_access"] and sub["plan"] == "annual"
    assert sub["days_left"] == 7 and sub["can_start_trial"] is False

    again = await c.post(f"{API}/trial", json={"plan": "monthly"})
    assert again.status_code == 409
    assert (await c.post(f"{API}/trial", json={"plan": "weekly"})).status_code == 400  # unknown plan


async def test_cancel_keeps_access_until_the_end_then_resume(make_user, as_user):
    c = await as_user(await make_user("Ada One"))
    await c.post(f"{API}/trial", json={"plan": "monthly"})

    r = await c.post(f"{API}/cancel", json={"reason": "too_expensive", "note": "  "})
    out = r.json()["data"]
    assert out["state"] == "cancelled" and out["has_access"] is True  # paid period still running
    assert (await c.post(f"{API}/cancel", json={"reason": "other"})).json()["message"] == "Already cancelled"

    resumed = (await c.post(f"{API}/resume")).json()["data"]
    assert resumed["state"] == "trialing" and resumed["has_access"]
    assert (await c.post(f"{API}/resume")).status_code == 409  # nothing left to resume
    assert (await c.post(f"{API}/cancel", json={"reason": "nope"})).status_code == 400


async def test_cancel_without_subscription_is_404(make_user, as_user):
    c = await as_user(await make_user("Ada One"))
    assert (await c.post(f"{API}/cancel", json={"reason": "other"})).status_code == 404


async def test_access_ends_by_itself_when_the_period_passes(make_user, as_user, session_factory):
    user = await make_user("Ada One")
    c = await as_user(user)
    await c.post(f"{API}/trial", json={"plan": "monthly"})
    async with session_factory() as s:  # time travel: the trial ended yesterday
        sub = (await s.execute(select(Subscription).where(Subscription.user_id == user.id))).scalar_one()
        sub.current_period_end = datetime.now(timezone.utc) - timedelta(days=1)
        sub.trial_ends_at = sub.current_period_end
        await s.commit()
    me = (await c.get(f"{API}/me")).json()["data"]
    assert me["state"] == "expired" and me["has_access"] is False and me["can_start_trial"] is False
    assert (await c.post(f"{API}/cancel", json={"reason": "other"})).status_code == 404
