"""The whole check-in cycle against a real (SQLite) database and a fake Mongo: who is messaged, when, how often, and
what happens when she replies."""
import asyncio
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.modules.ai_chat import service as ai_service
from app.modules.checkins import service
from app.modules.checkins.models import CheckinLog, CheckinPreference
from app.modules.notifications.models import NotificationLog
from app.modules.rides.models import Ride
from app.modules.users.models import AccountStatusEnum, StatusEnum, User, UserTypeEnum
from tests.fakes import FakeDb
from tests.test_ai_chat_flow import FakeLLM

pytestmark = pytest.mark.anyio
UTC = timezone.utc
NOW = datetime(2026, 10, 15, 8, 30, tzinfo=UTC)   # 09:30 in Lagos


@pytest.fixture
def mongo():
    return FakeDb()


@pytest.fixture
def mother(make_user, session_factory, mongo):
    """`await mother(week=20)` -> a reachable pregnant mother (one device registered)."""
    async def _make(week=20, status=StatusEnum.pregnant, device=True, name="Toyosola Ade", **fields):
        u = await make_user(name)
        async with session_factory() as s:
            row = await s.get(User, u.id)
            row.status = status
            if status == StatusEnum.pregnant:
                row.pregnancy_week = f"{week} weeks"
            else:
                row.baby_age = str(week)
            for k, v in fields.items():
                setattr(row, k, v)
            await s.commit()
        if device:
            await mongo["devices"].insert_one({"user_id": u.id, "token": f"tok-{u.id}", "device_type": "android"})
        return u
    return _make


async def logs(session_factory, user_id=None):
    async with session_factory() as s:
        q = select(CheckinLog).order_by(CheckinLog.id)
        if user_id:
            q = q.where(CheckinLog.user_id == user_id)
        return (await s.execute(q)).scalars().all()


async def run(session_factory, mongo, now=NOW, **kw):
    return await service.run_cycle(session_factory, mongo, now, **kw)


# ── the hello itself ─────────────────────────────────────────────────────────────────────────────────

async def test_a_due_mother_gets_a_hello_with_a_conversation_ready_to_open(session_factory, mongo, mother, _no_push):
    u = await mother(week=20)
    rep = await run(session_factory, mongo)
    assert rep.sent == 1 and rep.considered == 1

    (log,) = await logs(session_factory, u.id)
    assert log.kind == "daily" and log.status == "sent" and log.category == "preg_t2" and log.care_level == "standard"
    assert log.dedupe_key == "daily:2026-10-15" and log.session_id and log.notification_id

    session = mongo["sessions"].docs[0]
    first = mongo["messages"].docs[0]
    assert session["id"] == log.session_id and session["origin"]["type"] == "checkin" and session["user_id"] == u.id
    assert "Toyosola" in first["content"] and first["role"] == "assistant"
    assert [c["key"] for c in first["meta"]["suggestions"]] == ["good", "rough", "question", "nurse"]

    async with session_factory() as s:
        note = (await s.execute(select(NotificationLog))).scalar_one()
    assert note.type == "checkin" and note.data["session_id"] == log.session_id and note.data["route"] == "/chat/conversation"
    assert len(_no_push) == 1 and _no_push[0][3]["type"] == "checkin"


async def test_never_twice_in_one_day_even_if_the_scheduler_runs_again(session_factory, mongo, mother, _no_push):
    await mother()
    await run(session_factory, mongo)
    for later in (NOW + timedelta(minutes=15), NOW + timedelta(hours=3), NOW + timedelta(hours=9)):
        rep = await run(session_factory, mongo, later)
        assert rep.sent == 0
    assert len(await logs(session_factory)) == 1 and len(_no_push) == 1


async def test_two_schedulers_racing_send_exactly_one_hello(session_factory, mongo, mother, _no_push):
    await mother()
    a, b = await asyncio.gather(run(session_factory, mongo), run(session_factory, mongo))
    assert a.sent + b.sent == 1 and a.duplicates + b.duplicates == 1
    assert len(await logs(session_factory)) == 1 and len(_no_push) == 1


async def test_the_next_local_day_is_a_new_day(session_factory, mongo, mother):
    await mother(week=38)  # term: enhanced, daily
    await run(session_factory, mongo)
    assert (await run(session_factory, mongo, NOW + timedelta(days=1))).sent == 1
    assert [l.dedupe_key for l in await logs(session_factory)] == ["daily:2026-10-15", "daily:2026-10-16"]


# ── who is NOT messaged ──────────────────────────────────────────────────────────────────────────────

async def test_no_device_means_no_hello_and_the_day_is_not_used_up(session_factory, mongo, mother):
    u = await mother(device=False)
    assert (await run(session_factory, mongo)).skipped["no_device"] == 1 and await logs(session_factory) == []
    await mongo["devices"].insert_one({"user_id": u.id, "token": "late"})            # she installs the app later today
    assert (await run(session_factory, mongo, NOW + timedelta(hours=2))).sent == 1


async def test_opt_out_is_respected(session_factory, mongo, mother):
    u = await mother()
    async with session_factory() as s:
        await service.save_preferences(s, u.id, False, None, None)
    rep = await run(session_factory, mongo)
    assert rep.sent == 0 and rep.skipped["disabled"] == 1


async def test_quiet_hours_and_her_own_timezone(session_factory, mongo, mother):
    u = await mother()
    assert (await run(session_factory, mongo, datetime(2026, 10, 15, 19, 30, tzinfo=UTC))).skipped["quiet_hours"] == 1   # 20:30 Lagos
    assert (await run(session_factory, mongo, datetime(2026, 10, 15, 7, 30, tzinfo=UTC))).skipped["before_preferred_hour"] == 1
    async with session_factory() as s:
        await service.save_preferences(s, u.id, None, "America/New_York", 10)
    assert (await run(session_factory, mongo, datetime(2026, 10, 15, 14, 30, tzinfo=UTC))).sent == 1                     # 10:30 there
    (log,) = await logs(session_factory)
    assert log.local_date.isoformat() == "2026-10-15"


async def test_not_while_she_is_already_chatting_with_loni_today(session_factory, mongo, mother):
    u = await mother()
    await mongo["sessions"].insert_one({"id": "old", "user_id": u.id, "created_at": NOW, "updated_at": NOW})
    await mongo["messages"].insert_one({"id": "m", "session_id": "old", "role": "user", "content": "hi", "created_at": NOW - timedelta(minutes=30)})
    assert (await run(session_factory, mongo)).skipped["active_today"] == 1
    # a message from yesterday does not count
    mongo["messages"].docs[0]["created_at"] = NOW - timedelta(days=1)
    assert (await run(session_factory, mongo)).sent == 1


async def test_not_during_a_ride(session_factory, mongo, mother):
    u = await mother()
    async with session_factory() as s:
        s.add(Ride(rider_id=u.id, pickup_lat=6.5, pickup_lng=3.3, dropoff_lat=6.6, dropoff_lng=3.4))
        await s.commit()
    assert (await run(session_factory, mongo)).skipped["ride_active"] == 1


async def test_only_reachable_mothers_are_considered(session_factory, mongo, mother, make_user):
    await mother(account_status=AccountStatusEnum.suspended)
    nurse = await mother(user_type=UserTypeEnum.nurse)
    no_stage = await make_user("No Stage")                     # not a mother yet (no status)
    await mongo["devices"].insert_one({"user_id": no_stage.id, "token": "t"})
    ok = await mother()
    rep = await run(session_factory, mongo)
    assert rep.considered == 1 and rep.sent == 1               # suspended, nurse and not-yet-a-mother are never even looked at
    assert [l.user_id for l in await logs(session_factory)] == [ok.id]
    assert nurse.id not in {l.user_id for l in await logs(session_factory)}


# ── different mothers, different care ────────────────────────────────────────────────────────────────

async def test_steady_second_trimester_gets_a_lighter_touch_than_term_or_newborn(session_factory, mongo, mother):
    t2 = await mother(week=20)
    term = await mother(week=38)
    new_mum = await mother(week=2, status=StatusEnum.newMom)
    for day in range(0, 4):
        await run(session_factory, mongo, NOW + timedelta(days=day))
    by_user = {}
    for l in await logs(session_factory):
        by_user.setdefault(l.user_id, []).append(l)
    assert len(by_user[t2.id]) == 2        # day 0 and day 3
    assert len(by_user[term.id]) == 3      # daily for three days, then eased off (nobody opened them)
    assert len(by_user[new_mum.id]) == 3
    assert {l.category for l in by_user[new_mum.id]} == {"pp_early"} and {l.care_level for l in by_user[term.id]} == {"enhanced"}


async def test_consecutive_messages_use_different_wording(session_factory, mongo, mother):
    await mother(week=38)
    for day in range(6):
        await run(session_factory, mongo, NOW + timedelta(days=day))
    keys = [l.template_key for l in await logs(session_factory)]
    assert all(a != b for a, b in zip(keys, keys[1:]))


async def test_a_silent_mother_is_eased_off_to_weekly_and_wakes_up_when_she_engages(session_factory, mongo, mother):
    u = await mother(week=38)                                  # would be daily
    sent_days = []
    for day in range(0, 12):
        rep = await run(session_factory, mongo, NOW + timedelta(days=day))
        if rep.sent:
            sent_days.append(day)
    assert sent_days[:3] == [0, 1, 2]                          # three ignored in a row ...
    assert sent_days[3] - sent_days[2] >= 7                    # ... then at most weekly
    last = (await logs(session_factory))[-1]
    # she finally opens one: back to normal rhythm
    async with session_factory() as s:
        await service.record_opened(s, u.id, last.id)
    nxt = await run(session_factory, mongo, NOW + timedelta(days=sent_days[-1] + 1))
    assert nxt.sent == 1


async def test_recent_danger_makes_her_intensive_even_in_a_steady_stage(session_factory, mongo, mother):
    u = await mother(week=20)
    await mongo["ai_safety_events"].insert_one({"id": "e1", "user_id": u.id, "urgency": "urgent", "domain": "pregnancy",
                                                 "created_at": NOW - timedelta(hours=10)})
    await run(session_factory, mongo)
    (log,) = await logs(session_factory)
    assert log.care_level == "intensive"


async def test_a_worrying_answer_raises_care_for_the_next_days(session_factory, mongo, mother):
    u = await mother(week=20)
    await run(session_factory, mongo)
    (log,) = await logs(session_factory)
    assert await service.record_response(session_factory, log.session_id, u.id, "I'm not feeling great today.", "routine") == "rough"
    rep = await run(session_factory, mongo, NOW + timedelta(days=1))   # standard would wait 3 days; enhanced does not
    assert rep.sent == 1 and (await logs(session_factory))[-1].care_level == "enhanced"


# ── follow-ups ───────────────────────────────────────────────────────────────────────────────────────

async def event(mongo, user_id, hours_ago, urgency="urgent", domain="pregnancy", eid="e1"):
    await mongo["ai_safety_events"].insert_one({"id": eid, "user_id": user_id, "urgency": urgency, "domain": domain,
                                                 "created_at": NOW - timedelta(hours=hours_ago)})


async def test_followup_the_day_after_an_urgent_conversation_and_only_once(session_factory, mongo, mother, _no_push):
    u = await mother()
    await event(mongo, u.id, 24)
    first = await service.run_followups(session_factory, mongo, NOW)
    again = await service.run_followups(session_factory, mongo, NOW + timedelta(minutes=15))
    assert first.sent == 1 and again.sent == 0 and again.duplicates == 1
    (log,) = await logs(session_factory)
    assert log.kind == "followup" and log.template_key == "followup_urgent" and log.dedupe_key == "followup:e1"
    assert "get checked" in mongo["messages"].docs[0]["content"] or "checked" in mongo["messages"].docs[0]["content"]
    assert mongo["sessions"].docs[0]["origin"]["kind"] == "followup"


async def test_followup_window_and_other_guards(session_factory, mongo, mother):
    u = await mother()
    await event(mongo, u.id, 5, eid="too_new")
    await event(mongo, u.id, 60, eid="too_old")
    await event(mongo, u.id, 30, urgency="routine", eid="not_risky")
    assert (await service.run_followups(session_factory, mongo, NOW)).sent == 0
    await event(mongo, u.id, 25, eid="ok")
    assert (await service.run_followups(session_factory, mongo, datetime(2026, 10, 15, 19, 30, tzinfo=UTC))).skipped["quiet_hours"] == 1
    assert (await service.run_followups(session_factory, mongo, NOW)).sent == 1


async def test_mental_health_followup_is_gentler_and_does_not_need_an_urgent_label(session_factory, mongo, mother):
    u = await mother()
    await event(mongo, u.id, 26, urgency="routine", domain="mental_health")
    assert (await service.run_followups(session_factory, mongo, NOW)).sent == 1
    assert (await logs(session_factory))[0].template_key == "followup_mental"
    assert [c["key"] for c in mongo["messages"].docs[0]["meta"]["suggestions"]] == ["good", "rough", "question", "nurse"]


async def test_followup_and_hello_can_share_a_day_but_never_more_than_the_cap(session_factory, mongo, mother, _no_push):
    u = await mother(week=38)
    await event(mongo, u.id, 24)
    await run(session_factory, mongo)                       # the daily hello
    await service.run_followups(session_factory, mongo, NOW)  # plus the follow-up: 2 today
    assert len(_no_push) == 2
    await event(mongo, u.id, 22, eid="another")
    assert (await service.run_followups(session_factory, mongo, NOW)).skipped["daily_cap"] == 1
    assert len(_no_push) == 2


# ── preview / dry run ────────────────────────────────────────────────────────────────────────────────

async def test_dry_run_reports_who_would_be_messaged_and_changes_nothing(session_factory, mongo, mother, _no_push):
    a = await mother(week=38)
    await mother(device=False)
    rep = await run(session_factory, mongo, dry_run=True)
    assert rep.sent == 0 and rep.would_send == [{"user_id": a.id, "category": "preg_term", "level": "enhanced", "template": rep.would_send[0]["template"]}]
    assert rep.skipped["no_device"] == 1
    assert await logs(session_factory) == [] and _no_push == [] and mongo["sessions"].docs == []


# ── replying: the conversation continues with the AI ────────────────────────────────────────────────

@pytest.fixture
def ai(monkeypatch, mongo, session_factory):
    monkeypatch.setattr(ai_service, "get_mongo_db", lambda: mongo)
    monkeypatch.setattr(ai_service, "AsyncSessionLocal", session_factory)
    llm = FakeLLM()
    monkeypatch.setattr(ai_service, "_client_and_model", lambda: (llm, "fake"))
    return llm


async def reply(user, session_id, text):
    mother_obj = SimpleNamespace(name=user.name, status=StatusEnum.pregnant, pregnancy_week="20 weeks", pregnancy_start_date=None, baby_age=None)
    return [raw async for raw in ai_service.stream_chat_message(session_id, user.id, text, mother_obj)]


async def test_her_reply_is_recorded_and_the_ai_is_told_how_the_chat_began(session_factory, mongo, mother, ai):
    u = await mother()
    await run(session_factory, mongo)
    (log,) = await logs(session_factory)
    await reply(u, log.session_id, "I'm doing well today.")

    (log,) = await logs(session_factory)
    assert log.response_key == "good" and log.responded_at and log.opened_at
    last = ai.stream_calls[0][-1]
    assert last["role"] == "system" and "proactive check-in" in last["content"] and "preg_t2" in last["content"]
    assert mongo["messages"].docs[0]["content"] in last["content"]       # it knows what Loni said first


async def test_only_the_first_reply_counts_and_a_worrying_one_is_flagged(session_factory, mongo, mother, ai):
    u = await mother()
    await run(session_factory, mongo)
    (log,) = await logs(session_factory)
    await reply(u, log.session_id, "I have a fever of 39 and chills")
    await reply(u, log.session_id, "I'm doing well today.")
    assert (await logs(session_factory))[0].response_key == "concerning"


async def test_an_emergency_reply_to_a_checkin_is_still_recorded(session_factory, mongo, mother, ai):
    u = await mother()
    await run(session_factory, mongo)
    (log,) = await logs(session_factory)
    events = await reply(u, log.session_id, "I'm bleeding heavily")
    assert any("This could be an emergency" in e for e in events) and ai.stream_calls == []
    assert (await logs(session_factory))[0].response_key == "concerning"


# ── preferences API ──────────────────────────────────────────────────────────────────────────────────

async def test_preferences_api_validates_and_persists(make_user, as_user, session_factory):
    c = await as_user(await make_user("Ada One"))
    base = (await c.get("/api/v1/checkins/preferences")).json()["data"]
    assert base["enabled"] is True and base["timezone"] == "Africa/Lagos" and base["preferred_hour"] == 9 and base["quiet_from_hour"] == 20 and base["remember"] is True

    ok = await c.put("/api/v1/checkins/preferences", json={"enabled": False, "timezone": "Europe/London", "preferred_hour": 10})
    assert ok.json()["data"] == {"enabled": False, "timezone": "Europe/London", "preferred_hour": 10, "remember": True, "quiet_from_hour": 20}
    assert (await c.get("/api/v1/checkins/preferences")).json()["data"]["enabled"] is False
    assert (await c.put("/api/v1/checkins/preferences", json={"timezone": "Mars/Base"})).status_code == 400
    assert (await c.put("/api/v1/checkins/preferences", json={"preferred_hour": 21})).status_code == 400   # inside quiet hours
    assert (await c.put("/api/v1/checkins/preferences", json={"preferred_hour": 30})).status_code == 400
    async with session_factory() as s:
        assert len((await s.execute(select(CheckinPreference))).scalars().all()) == 1


async def test_opening_the_notification_is_recorded_once_and_only_for_the_owner(make_user, as_user, session_factory, mongo, mother):
    u = await mother()
    await run(session_factory, mongo)
    (log,) = await logs(session_factory)
    stranger = await as_user(await make_user("Not Her"))
    await stranger.post(f"/api/v1/checkins/{log.id}/opened")
    assert (await logs(session_factory))[0].opened_at is None
    owner = await as_user(u)
    assert (await owner.post(f"/api/v1/checkins/{log.id}/opened")).status_code == 200
    assert (await logs(session_factory))[0].opened_at is not None


async def test_admin_endpoints_need_an_admin_and_a_confirmation(make_user, as_user, session_factory):
    mum = await as_user(await make_user("Ada One"))
    assert (await mum.get("/api/v1/checkins/admin/preview")).status_code in (401, 403)
    assert (await mum.post("/api/v1/checkins/admin/run?confirm=true")).status_code in (401, 403)
