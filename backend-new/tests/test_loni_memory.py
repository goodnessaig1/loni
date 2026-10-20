"""Loni's memory of her day: what is noted, what is never kept, how it shapes the next hello and the next chat."""
import json
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.modules.ai_chat import service as ai_service
from app.modules.checkins import content, memory, policy, service
from app.modules.checkins.models import WellbeingNote
from app.modules.users.models import StatusEnum, User
from tests.fakes import FakeDb
from tests.test_ai_chat_flow import FakeLLM
from tests.test_checkins_flow import NOW, logs, mongo, mother, run  # noqa: F401  (shared fixtures)

pytestmark = pytest.mark.anyio
TODAY = date(2026, 10, 15)


# ── extraction (pure) ────────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("text,mood,symptoms,topics", [
    ("I have a headache and feel so tired", None, ["headache", "tiredness"], []),
    ("no headache today, feeling great", 5, [], []),
    ("I'm not feeling great today.", 2, [], []),
    ("I'm doing well today.", 4, [], []),
    ("I feel hopeless", 1, [], []),
    ("my periods are irregular and I can't sleep", None, ["trouble sleeping"], ["sleep", "periods"]),
    ("without any nausea I managed to eat", None, [], ["food"]),
    ("work is stressing me and my husband doesn't help", 2, [], ["work", "relationship"]),
    ("having hot flushes at night", None, ["hot flushes"], ["menopause"]),
    ("nothing much, hello", None, [], []),
    ("", None, [], []),
])
def test_extraction(text, mood, symptoms, topics):
    got = memory.extract(text)
    assert (got.mood, sorted(got.symptoms), sorted(got.topics)) == (mood, sorted(symptoms), sorted(topics)), text


def test_only_fixed_tags_can_ever_be_kept_never_her_words():
    got = memory.extract("my husband John hit me at 12 Allen Avenue and I have a headache")
    blob = json.dumps(got.__dict__)
    assert "John" not in blob and "Allen" not in blob and "hit me" not in blob
    assert set(got.symptoms) <= set(memory.SYMPTOMS) and set(got.topics) <= set(memory.TOPICS)


def test_context_lines_are_short_tag_summaries_and_follow_up_looks_at_yesterday_or_the_day_before():
    n = lambda d, **k: SimpleNamespace(day=TODAY - timedelta(days=d), mood=k.get("mood"), symptoms=k.get("s", []), topics=k.get("t", []))
    notes = [n(0, mood=4), n(1, mood=2, s=["headache", "nausea"], t=["sleep"]), n(5, mood=3)]
    lines = memory.context_lines(notes, TODAY)
    assert lines[0] == "- Today: felt good"
    assert lines[1] == "- Yesterday: felt low; mentioned headache, nausea; talked about sleep"
    assert memory.follow_up_topic([n(1, s=["headache"])], TODAY) == {"kind": "symptom", "symptom": "headache"}
    assert memory.follow_up_topic([n(1, mood=2, s=["headache"])], TODAY) == {"kind": "low_mood"}
    assert memory.follow_up_topic([n(0, s=["headache"])], TODAY) is None          # today is not "last time" yet
    assert memory.follow_up_topic([n(4, mood=2)], TODAY) is None                  # too long ago to bring up
    assert memory.follow_up_topic([n(1, mood=4), n(3, mood=2)], TODAY) == {"kind": "better"}
    assert memory.low_mood_days([n(0, mood=2), n(1, mood=1), n(2, mood=5), n(9, mood=1)], TODAY) == 2


def test_a_run_of_low_days_raises_care_level():
    assert policy.care_level(content.WOMEN, policy.Signals(low_mood_days=3)) == policy.INTENSIVE
    assert policy.care_level(content.WOMEN, policy.Signals(low_mood_days=1)) == policy.ENHANCED
    assert policy.care_level(content.WOMEN, policy.Signals()) == policy.STANDARD


# ── storage ──────────────────────────────────────────────────────────────────────────────────────────

async def test_notes_merge_through_the_day_and_the_latest_mood_wins(make_user, session_factory):
    u = await make_user("Ada One")
    async with session_factory() as db:
        await memory.remember(db, u.id, "I have a headache", TODAY)
        await memory.remember(db, u.id, "and I feel anxious and low", TODAY)
        await memory.remember(db, u.id, "ok now I'm feeling better", TODAY)
        await memory.remember(db, u.id, "hello", TODAY)                     # says nothing: no row change
        rows = (await db.execute(select(WellbeingNote))).scalars().all()
    assert len(rows) == 1 and rows[0].symptoms == ["anxiety", "headache"] and rows[0].mood == 4


async def test_memory_off_means_nothing_is_kept_and_forgetting_erases_everything(make_user, as_user, session_factory):
    u = await make_user("Ada One")
    c = await as_user(u)
    async with session_factory() as db:
        await memory.remember(db, u.id, "I have a headache", TODAY)
    mem = (await c.get("/api/v1/checkins/memory")).json()["data"]
    assert mem["remember"] is True and mem["notes"][0]["symptoms"] == ["headache"]
    assert set(mem["notes"][0]) == {"day", "mood", "symptoms", "topics"}      # tags only: there is no text field to leak

    assert (await c.put("/api/v1/checkins/preferences", json={"remember": False})).json()["data"]["remember"] is False
    async with session_factory() as db:
        assert await memory.remember(db, u.id, "my back hurts", TODAY - timedelta(days=1)) is None
    assert len((await c.get("/api/v1/checkins/memory")).json()["data"]["notes"]) == 1

    r = await c.delete("/api/v1/checkins/memory")
    assert r.json()["data"]["removed"] == 1 and (await c.get("/api/v1/checkins/memory")).json()["data"]["notes"] == []


# ── the next hello picks up where she left off ───────────────────────────────────────────────────────

async def note(session_factory, user_id, days_ago, base=NOW, **kw):
    async with session_factory() as db:
        db.add(WellbeingNote(user_id=user_id, day=(base - timedelta(days=days_ago)).date(), mood=kw.get("mood"),
                             symptoms=kw.get("symptoms", []), topics=kw.get("topics", [])))
        await db.commit()


async def test_the_hello_asks_about_the_symptom_she_mentioned_yesterday(session_factory, mongo, mother):
    u = await mother(week=38)
    await note(session_factory, u.id, 1, symptoms=["headache"])
    await run(session_factory, mongo)
    (log,) = await logs(session_factory)
    assert log.template_key == "fu_symptom"
    text = mongo["messages"].docs[0]["content"]
    assert "headache" in text and "Toyosola" in text


async def test_a_low_day_gets_a_gentle_thinking_of_you_and_raises_care(session_factory, mongo, mother):
    u = await mother(week=20)
    await note(session_factory, u.id, 1, mood=2)
    await run(session_factory, mongo)
    (log,) = await logs(session_factory)
    assert log.template_key == "fu_lowmood" and log.care_level == "enhanced"


async def test_it_does_not_ask_about_the_same_thing_two_days_running(session_factory, mongo, mother):
    u = await mother(week=38)
    await note(session_factory, u.id, 1, symptoms=["headache"])
    await note(session_factory, u.id, 0, symptoms=["headache"])
    await run(session_factory, mongo)
    await run(session_factory, mongo, NOW + timedelta(days=1))
    keys = [l.template_key for l in await logs(session_factory)]
    assert keys[0] == "fu_symptom" and keys[1] != "fu_symptom"


async def test_with_memory_off_the_hello_is_generic(session_factory, mongo, mother):
    u = await mother(week=38)
    await note(session_factory, u.id, 1, symptoms=["headache"])
    async with session_factory() as db:
        await service.save_preferences(db, u.id, None, None, None, False)
    await run(session_factory, mongo)
    assert (await logs(session_factory))[0].template_key not in ("fu_symptom", "fu_lowmood", "fu_better")


async def test_a_milestone_is_marked_once(session_factory, mongo, mother):
    await mother(week=12)
    await run(session_factory, mongo)
    await run(session_factory, mongo, NOW + timedelta(days=2))
    keys = [l.template_key for l in await logs(session_factory)]
    assert keys[0] == "ms_12" and keys[1] != "ms_12"
    assert "first trimester" in mongo["messages"].docs[0]["content"].lower()


# ── the chat remembers too ───────────────────────────────────────────────────────────────────────────

@pytest.fixture
def chat(monkeypatch, session_factory):
    db = FakeDb()
    monkeypatch.setattr(ai_service, "get_mongo_db", lambda: db)
    monkeypatch.setattr(ai_service, "AsyncSessionLocal", session_factory)
    llm = FakeLLM()
    monkeypatch.setattr(ai_service, "_client_and_model", lambda: (llm, "fake"))
    return llm


async def talk(user_id, text, status=StatusEnum.general, session="s1"):
    woman = SimpleNamespace(name="Ngozi Eze", status=status, pregnancy_week=None, pregnancy_start_date=None, baby_age=None)
    return [e async for e in ai_service.stream_chat_message(session, user_id, text, woman)]


async def test_the_ai_is_told_what_she_mentioned_yesterday_and_learns_from_today(make_user, session_factory, chat):
    u = await make_user("Ngozi Eze")
    # a live chat reads the real clock, so "yesterday" has to be relative to today, not the fixed NOW
    await note(session_factory, u.id, 1, base=datetime.now(timezone.utc), mood=2, symptoms=["headache"])
    await talk(u.id, "I haven't been sleeping well")
    block = next(m["content"] for m in chat.stream_calls[0] if m["content"].startswith("WHAT SHE HAS TOLD YOU RECENTLY"))
    assert "Yesterday: felt low; mentioned headache" in block and "Today: " in block and "trouble sleeping" in block
    assert "haven't been sleeping" not in block             # tags, never her words
    async with session_factory() as db:
        today_row = (await db.execute(select(WellbeingNote).where(WellbeingNote.day == datetime.now(timezone.utc).date()))).scalars().all()
    assert any("trouble sleeping" in (r.symptoms or []) for r in today_row)


async def test_no_memory_block_when_she_turned_memory_off(make_user, as_user, session_factory, chat):
    u = await make_user("Ngozi Eze")
    await note(session_factory, u.id, 1, symptoms=["headache"])
    async with session_factory() as db:
        await service.save_preferences(db, u.id, None, None, None, False)
    await talk(u.id, "I haven't been sleeping well")
    assert not any(m["content"].startswith("WHAT SHE HAS TOLD YOU") for m in chat.stream_calls[0])
