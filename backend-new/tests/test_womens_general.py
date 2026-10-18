"""Loni is for every woman, not only mothers: a woman who is not pregnant is a first-class user."""
import json
from datetime import timedelta
from types import SimpleNamespace

import pytest

from app.modules.ai_chat import service as ai_service
from app.modules.ai_chat.context import profile_lines, stage_context
from app.modules.ai_chat.prompts import build_system_prompt
from app.modules.checkins import content
from app.modules.users.models import StatusEnum, User
from tests.fakes import FakeDb
from tests.test_ai_chat_flow import FakeLLM
from tests.test_checkins_flow import NOW, logs, mongo, mother, run  # noqa: F401

pytestmark = pytest.mark.anyio


def woman(status, **kw):
    base = dict(name="Ngozi Eze", status=status, pregnancy_week=None, pregnancy_start_date=None, baby_age=None)
    return SimpleNamespace(**{**base, **kw})


def test_stage_context_for_every_kind_of_user():
    assert stage_context(woman(StatusEnum.general)).kind == "general"
    assert stage_context(woman(StatusEnum.ttc)).kind == "ttc"
    assert stage_context(woman(StatusEnum.pregnant, pregnancy_week="22 weeks")).week == 22
    assert stage_context(woman(StatusEnum.newMom, baby_age="3")).kind == "postpartum"
    assert stage_context(woman(None)).kind is None                    # unknown is unknown, not "pregnant"
    assert stage_context(None).kind is None


def test_the_ai_is_told_her_situation_in_words_that_fit_it():
    g = " ".join(profile_lines(woman(StatusEnum.general), stage_context(woman(StatusEnum.general))))
    assert "not pregnant" in g and "periods" in g
    t = " ".join(profile_lines(woman(StatusEnum.ttc), stage_context(woman(StatusEnum.ttc))))
    assert "trying to conceive" in t


def test_the_prompt_is_for_all_women_has_a_human_voice_and_stays_honest_about_being_ai():
    p = build_system_prompt("112")
    for must in ("ALL women, whether or not she is pregnant", "periods and cycles", "menopause", "nurse-friend", "Never claim to be human",
                 "Never discourage real-world care", "WHEN SHE WANTS TO TALK, NOT BE FIXED", "Reflect back", "ONE question at a time",
                 "LOOKUP RESULTS", "from memory", "bleeding after menopause", "only that number"):
        assert must.lower() in p.lower(), must


async def test_a_woman_who_is_not_pregnant_gets_a_proper_conversation(monkeypatch, session_factory):
    db, llm = FakeDb(), FakeLLM()
    monkeypatch.setattr(ai_service, "get_mongo_db", lambda: db)
    monkeypatch.setattr(ai_service, "AsyncSessionLocal", session_factory)
    monkeypatch.setattr(ai_service, "_client_and_model", lambda: (llm, "fake"))
    events = [e async for e in ai_service.stream_chat_message("s1", "u1", "My periods have been irregular for months", woman(StatusEnum.general))]
    meta = json.loads(events[0][6:])["meta"]
    assert meta["urgency"] == "routine" and meta["answer_type"] == "cycle_health" and [a["type"] for a in meta["actions"]] == ["talk_to_nurse"]
    sent = llm.stream_calls[0]
    assert any("Periods/cycle question" in m["content"] for m in sent if m["role"] == "system")
    assert any("not pregnant" in m["content"] for m in sent)
    assert "periods" not in " ".join(m["content"] for m in sent if m["role"] == "user").replace("My periods", "")  # nothing odd injected


# ── check-ins for women who are not pregnant ─────────────────────────────────────────────────────────

def test_categories_and_rhythm_for_women_and_ttc():
    assert content.category_of("general", None) == content.WOMEN and content.category_of("ttc", None) == content.TTC
    assert content.STANDARD_GAP_DAYS[content.WOMEN] == 2 and content.STANDARD_GAP_DAYS[content.TTC] == 2
    for cat in (content.WOMEN, content.TTC):
        assert len(content._T[cat]) >= 3


async def test_non_pregnant_women_get_their_own_hellos(session_factory, mongo, mother):
    a = await mother(status=StatusEnum.general, name="Ngozi Eze")
    b = await mother(status=StatusEnum.ttc, name="Amaka Obi")
    rep = await run(session_factory, mongo)
    assert rep.sent == 2
    cats = {l.user_id: l.category for l in await logs(session_factory)}
    assert cats == {a.id: "women", b.id: "ttc"}
    texts = [m["content"] for m in mongo["messages"].docs]
    assert any("Ngozi" in t for t in texts) and not any("pregnan" in t.lower() and "trimester" in t.lower() for t in texts)
    assert await run(session_factory, mongo, NOW + timedelta(days=1)) is not None


# ── stage and care plan ──────────────────────────────────────────────────────────────────────────────

async def test_switching_to_general_or_ttc_clears_pregnancy_details(make_user, as_user, session_factory):
    u = await make_user("Ada One")
    async with session_factory() as s:
        row = await s.get(User, u.id)
        row.status, row.pregnancy_week = StatusEnum.pregnant, "20 weeks"
        await s.commit()
    c = await as_user(u)
    out = (await c.patch("/api/v1/users/stage", json={"status": "general"})).json()["data"]["user"]
    assert out["status"] == "general" and not out.get("pregnancyWeek") and not out.get("trimester")
    assert (await c.patch("/api/v1/users/stage", json={"status": "ttc"})).json()["data"]["user"]["status"] == "ttc"
    assert (await c.patch("/api/v1/users/stage", json={"status": "pregnant"})).json()["data"]["user"]["status"] == "pregnant"
    assert (await c.patch("/api/v1/users/stage", json={"status": "teapot"})).status_code == 400


async def test_the_care_plan_for_a_woman_who_is_not_pregnant_is_a_wellness_plan(make_user, as_user, session_factory):
    u = await make_user("Ngozi Eze")
    async with session_factory() as s:
        row = await s.get(User, u.id)
        row.status = StatusEnum.general
        await s.commit()
    c = await as_user(u)
    assert (await c.post("/api/v1/subscriptions/trial", json={"plan": "monthly"})).status_code == 201
    plan = (await c.get("/api/v1/care/today")).json()["data"]
    keys = {t["key"] for t in plan["tasks"]}
    assert plan["stage"] == "general" and "cycle_log" in keys and "kick_count" not in keys and "prenatal_vitamin" not in keys
    nutrition = (await c.get("/api/v1/care/nutrition")).json()["data"]
    assert nutrition["stage"] == "general" and nutrition["meals"]
    assert (await c.put("/api/v1/care/today/cycle_log", json={"done": True})).json()["data"]["done"] == 1
