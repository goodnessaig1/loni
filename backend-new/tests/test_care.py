from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.modules.care import service
from app.modules.users.models import StatusEnum, User

pytestmark = pytest.mark.anyio

CARE = "/api/v1/care"


async def _plus_mother(make_user, as_user, session_factory, week="22 weeks", status=StatusEnum.pregnant):
    user = await make_user("Ada One")
    async with session_factory() as s:
        u = await s.get(User, user.id)
        u.status = status
        if status == StatusEnum.pregnant:
            u.pregnancy_week = week
        else:
            u.baby_age = "3"
        await s.commit()
    c = await as_user(user)
    assert (await c.post("/api/v1/subscriptions/trial", json={"plan": "monthly"})).status_code == 201
    return user, c


async def test_everything_is_locked_without_loniplus(make_user, as_user):
    c = await as_user(await make_user("Ada One"))
    for path in ("/overview", "/today", "/nutrition", "/weekly-report", "/hospital-bag", "/labour-prep",
                 "/labour-prep/labour-stages"):
        r = await c.get(CARE + path)
        assert r.status_code == 403 and r.json()["message"] == "LoniPlus required", path
    assert (await c.put(f"{CARE}/today/hydration", json={"done": True})).status_code == 403


async def test_daily_checklist_tick_untick_and_progress(make_user, as_user, session_factory):
    _, c = await _plus_mother(make_user, as_user, session_factory)
    plan = (await c.get(f"{CARE}/today")).json()["data"]
    assert plan["stage"] == "pregnancy" and plan["done"] == 0 and plan["total"] == 12  # kick count unlocked at wk 20
    assert plan["categories"]["nutrition"] == {"done": 0, "total": 4}

    r = (await c.put(f"{CARE}/today/hydration", json={"done": True})).json()["data"]
    assert r["done"] == 1 and next(t for t in r["tasks"] if t["key"] == "hydration")["done"] is True
    again = (await c.put(f"{CARE}/today/hydration", json={"done": True})).json()["data"]
    assert again["done"] == 1  # idempotent: a double tap never double counts

    off = (await c.put(f"{CARE}/today/hydration", json={"done": False})).json()["data"]
    assert off["done"] == 0
    assert (await c.put(f"{CARE}/today/not_a_task", json={"done": True})).status_code == 404


async def test_plan_depends_on_week_and_stage(make_user, as_user, session_factory):
    _, early = await _plus_mother(make_user, as_user, session_factory, week="8 weeks")
    keys = {t["key"] for t in (await early.get(f"{CARE}/today")).json()["data"]["tasks"]}
    assert "kick_count" not in keys

    _, mum = await _plus_mother(make_user, as_user, session_factory, status=StatusEnum.newMom)
    plan = (await mum.get(f"{CARE}/today")).json()["data"]
    assert plan["stage"] == "postpartum" and "postnatal_vitamin" in {t["key"] for t in plan["tasks"]}


async def test_day_is_clamped_so_history_cannot_be_backfilled(make_user, as_user, session_factory):
    _, c = await _plus_mother(make_user, as_user, session_factory)
    far = (date.today() - timedelta(days=30)).isoformat()
    plan = (await c.put(f"{CARE}/today/hydration", params={"day": far}, json={"done": True})).json()["data"]
    assert plan["day"] != far
    assert service.resolve_day(date(2000, 1, 1)) >= date.today() - timedelta(days=2)


async def test_weekly_report_counts_days_and_lists_missed(make_user, as_user, session_factory):
    _, c = await _plus_mother(make_user, as_user, session_factory)
    await c.put(f"{CARE}/today/hydration", json={"done": True})
    rep = (await c.get(f"{CARE}/weekly-report")).json()["data"]
    hyd = next(a for a in rep["activities"] if a["key"] == "hydration")
    assert hyd["days_done"] == 1 and hyd["of"] == 7
    assert rep["completion_pct"] > 0 and any("hydration" in o.lower() for o in rep["observations"])
    assert all(m["key"] != "hydration" for m in rep["missed"]) and len(rep["missed"]) <= 3


async def test_overview_and_recent_activity(make_user, as_user, session_factory):
    _, c = await _plus_mother(make_user, as_user, session_factory)
    await c.put(f"{CARE}/today/hydration", json={"done": True})
    o = (await c.get(f"{CARE}/overview")).json()["data"]
    assert o["today"] == {"done": 1, "total": 12}
    assert o["bag"]["total"] == 16 and o["recent"][0]["title"] == "Completed hydration"


async def test_hospital_bag_persists(make_user, as_user, session_factory):
    _, c = await _plus_mother(make_user, as_user, session_factory)
    bag = (await c.put(f"{CARE}/hospital-bag/insurance_id", json={"checked": True})).json()["data"]
    assert bag["done"] == 1
    assert bag["groups"][0]["items"][0] == {"key": "insurance_id", "title": "Insurance card & ID", "checked": True}
    assert (await c.get(f"{CARE}/hospital-bag")).json()["data"]["done"] == 1  # survives a reload
    assert (await c.put(f"{CARE}/hospital-bag/insurance_id", json={"checked": False})).json()["data"]["done"] == 0
    assert (await c.put(f"{CARE}/hospital-bag/nope", json={"checked": True})).status_code == 404


async def test_labour_and_nutrition_content(make_user, as_user, session_factory):
    _, c = await _plus_mother(make_user, as_user, session_factory)
    topics = (await c.get(f"{CARE}/labour-prep")).json()["data"]
    assert [t["slug"] for t in topics["topics"]][0] == "understanding-labour" and topics["disclaimer"]
    assert (await c.get(f"{CARE}/labour-prep/labour-stages")).json()["data"]["sections"]
    assert (await c.get(f"{CARE}/labour-prep/zzz")).status_code == 404
    nut = (await c.get(f"{CARE}/nutrition")).json()["data"]
    assert nut["meals"][0]["slot"] == "Breakfast" and nut["avoid"] and nut["hydration"]["goal_cups"] == 10
