"""
Loni AI as a companion, not a call centre: symptom investigation, fewer needless nurse referrals, cheaper small talk,
less repeated boilerplate, quality signals and explicit feedback. Deterministic (fake model), like test_loni_scenarios.
"""
from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from app.modules.ai_chat import investigation, safety, service as ai_service, signals
from app.modules.ai_chat.prompts import build_system_prompt
from app.modules.ai_chat.triage import StageContext, Urgency, triage
from app.modules.checkins import facts
from app.modules.users.models import StatusEnum
from tests.test_loni_scenarios import LAGOS_TODAY, add_fact, chat, say, system_text, woman  # noqa: F401  (shared fixtures)

pytestmark = pytest.mark.anyio
GENERAL = StageContext("general")
not_pregnant = woman(StatusEnum.general)


# ── the name and the prompt ──────────────────────────────────────────────────────────────────────────

def test_the_companion_is_called_loni_ai_and_luma_is_gone():
    p = build_system_prompt("112")
    assert "Loni AI" in p and "luma" not in p.lower()


def test_the_prompt_investigates_and_does_not_behave_like_a_call_centre():
    p = build_system_prompt("112").lower()
    for must in ("before you answer", "investigating a symptom", "warning signs first", "do not answer an ordinary question with \"kindly speak to a nurse\"",
                 "never act like a call centre", "say why in one line", "never claim human or motherhood experiences",
                 "only cite a source when it appears in a reference notes block", "loni's understanding"):
        assert must in p, must


# ── symptom investigation (the brief's bleeding dialogue) ────────────────────────────────────────────

def _turn(text, inv):
    return [{"role": "user", "content": text}, {"role": "assistant", "content": "...", "meta": {"investigation": investigation.meta(inv)}}]


def test_bleeding_is_investigated_warning_signs_first_then_answered():
    first = investigation.assess("I've been bleeding for two days", GENERAL)
    assert first.id == "bleeding" and "onset" in {s.key for s in first.known} and not first.ready
    assert [s.key for s in first.missing[:2]] == ["amount", "soaking"]          # warning-sign questions lead

    h = _turn("I've been bleeding for two days", first) + [{"role": "user", "content": "I'm using a pad"}]
    second = investigation.assess("I'm using a pad", GENERAL, h)               # a short answer continues the same concern
    assert second.id == "bleeding" and [s.key for s in second.missing[:2]] == ["soaking", "pain_dizzy"]

    reply = "It's not soaking fast, no pain or dizziness, I'm on the pill"
    h = h[:-1] + _turn("I'm using a pad", second) + [{"role": "user", "content": reply}]
    third = investigation.assess(reply, GENERAL, h)
    assert third.ready and "stop investigating" in investigation.directive(third)

    h = h[:-1] + _turn(reply, third)
    assert investigation.assess("ok thanks", GENERAL, h) is None               # once answered, it is over


def test_profile_answers_questions_she_should_never_be_asked():
    inv = investigation.assess("I'm 8 weeks pregnant and experiencing abdominal pain", StageContext("pregnancy", 8))
    assert inv.id == "abdominal_pain"
    keys = {s.key for s in inv.missing}
    assert "pregnancy_possible" not in keys and {"severity", "bleeding"} <= keys
    assert "she is pregnant (profile)" in investigation.directive(inv)


def test_a_repeated_complaint_is_recognised():
    note = ("headache", "- Symptom: headache (she said, last mentioned 9 days ago)")
    inv = investigation.assess("My head is hurting again", StageContext("pregnancy", 30), symptom_notes=[note])
    d = investigation.directive(inv)
    assert inv.id == "headache" and "mentioned this before" in d and "same or different" in d
    assert inv.missing[0].red_flag and "vision" in " ".join(s.ask for s in inv.missing if s.red_flag)


def test_general_questions_and_feelings_are_not_turned_into_questionnaires():
    assert investigation.assess("Why do women experience cramps during their periods?", GENERAL, personal=False) is None
    assert investigation.assess("I'm having a really bad day", GENERAL) is None


def test_she_can_ask_for_an_answer_instead_of_more_questions():
    assert investigation.assess("I've been bleeding, just tell me what it could be", GENERAL).ready


def test_a_long_new_topic_does_not_continue_the_old_investigation():
    first = investigation.assess("I've been bleeding for two days", GENERAL)
    history = _turn("I've been bleeding for two days", first)
    for text in ("What foods should I eat to keep my energy up?",
                 "Okay. Separately, my sister is visiting next week and I want to plan meals that are good for both of us, "
                 "since we are both trying to eat healthier this year and cut down on sugar"):
        assert investigation.assess(text, GENERAL, history + [{"role": "user", "content": text}]) is None, text
    # ...but asking for Loni's view of this concern is still part of it
    assert investigation.assess("what could it be?", GENERAL, history + [{"role": "user", "content": "what could it be?"}]).ready


async def test_the_pipeline_sends_the_investigation_and_remembers_it_for_the_next_turn(make_user, chat):
    u = await make_user("Amaka Obi")
    meta, _ = await say(u.id, "I've been bleeding for two days", who=not_pregnant)
    assert meta["urgency"] == "routine"
    assert "SYMPTOM INVESTIGATION: vaginal bleeding" in system_text(chat.llm)
    saved = [m for m in chat.db["messages"].docs if m["role"] == "assistant"][-1]
    assert saved["meta"]["investigation"]["id"] == "bleeding" and saved["meta"]["investigation"]["turn"] == 1

    await say(u.id, "I'm using a pad", who=not_pregnant)
    sys = system_text(chat.llm)
    assert "SYMPTOM INVESTIGATION: vaginal bleeding" in sys and "amount" in sys.split("do NOT ask again")[1].split("\n")[0]
    events = chat.db["ai_safety_events"].docs
    assert events[-1]["investigation"] == {"id": "bleeding", "turn": 2, "ready": False}


async def test_an_emergency_is_never_investigated(make_user, chat):
    u = await make_user("Amaka Obi")
    meta, _ = await say(u.id, "I'm pregnant, bleeding heavily and feeling faint")
    assert meta["urgency"] == "emergency" and not chat.llm.stream_calls       # fixed message, model not called


async def test_a_repeat_headache_reaches_the_model_as_a_repeat(make_user, session_factory, chat):
    u = await make_user("Amaka Obi")
    await add_fact(session_factory, u.id, "symptom", "headache", LAGOS_TODAY() - timedelta(days=9))
    await say(u.id, "My head is hurting again", who=woman(week=20))
    assert "She has mentioned this before: Symptom: headache" in system_text(chat.llm)


# ── fewer needless referrals and less boilerplate ────────────────────────────────────────────────────

def test_a_general_education_question_gets_an_answer_not_a_nurse_button():
    r = triage("Why do women experience cramps during their periods?", GENERAL)
    assert r.urgency == Urgency.educational and r.actions == []
    # ...while a personal symptom still offers one, and a danger sign still escalates
    assert [a["type"] for a in triage("My periods are irregular").actions] == ["talk_to_nurse"]
    assert triage("I'm pregnant, bleeding heavily and feeling faint").urgency == Urgency.emergency


def test_the_reminder_is_not_repeated_on_every_routine_answer_but_always_on_urgent_ones():
    history = [{"role": "assistant", "content": "Some advice.\n\n" + safety.DISCLAIMER}, {"role": "user", "content": "and what else?"}]
    assert safety.reminded_recently(history)
    assert safety.DISCLAIMER not in safety.validate(Urgency.routine, "Try small meals.", "symptom_guidance", reminded_recently=True)
    assert safety.DISCLAIMER in safety.validate(Urgency.urgent, "Please see a doctor today.", "symptom_guidance", reminded_recently=True)
    assert safety.DISCLAIMER in safety.validate(Urgency.routine, "Try small meals.", "symptom_guidance", reminded_recently=False)


# ── cost: small talk on the fast model ───────────────────────────────────────────────────────────────

def test_greetings_are_recognised_and_carry_no_buttons():
    for text in ("hi", "Good morning Loni!", "thanks so much", "how far"):
        r = triage(text)
        assert r.answer_type == "greeting" and r.actions == [] and r.urgency == Urgency.educational, text
    assert triage("hi, I have a headache").answer_type == "symptom_guidance"


async def test_small_talk_uses_the_fast_model_and_health_uses_the_main_one(make_user, chat, monkeypatch):
    monkeypatch.setattr(ai_service, "get_provider", lambda: SimpleNamespace(classifier_model="fake-fast", short_max_tokens=40))
    u = await make_user("Amaka Obi")
    await say(u.id, "Good morning Loni!")
    await say(u.id, "I've had a headache since yesterday")
    assert chat.llm.stream_models == ["fake-fast", "fake"]


# ── learning about her ───────────────────────────────────────────────────────────────────────────────

def test_cycle_details_and_a_liking_for_detail_are_remembered():
    today = date(2026, 11, 22)
    found, _ = facts.extract("My cycle is usually 28 days and my last period started on 3 November", today)
    by_key = {f.key: f for f in found}
    assert by_key["usual cycle length"].detail == "28 days" and by_key["last period started"].event_date == date(2026, 11, 3)
    assert ("preference", "detailed_answers") in {(f.kind, f.key) for f in facts.extract("I prefer detailed explanations", today)[0]}
    assert facts.extract("can I take paracetamol?", today)[0] == []


def test_a_last_period_date_goes_stale_after_about_a_cycle():
    f = SimpleNamespace(kind="condition", key="last period started", event_date=date(2026, 10, 1), last_noted=date(2026, 10, 1))
    assert facts.is_stale(f, date(2026, 11, 22)) and not facts.is_stale(f, date(2026, 10, 20))


# ── quality signals and explicit feedback (labels only, never her words) ─────────────────────────────

def test_quality_signals():
    assert "correction" in signals.detect("No, that's not what I meant")
    assert "clarification" in signals.detect("I don't understand, explain again")
    assert "thanks" in signals.detect("thank you, that helped")
    h = [{"role": "user", "content": "what foods help with morning sickness in early pregnancy"}]
    assert "repeat" in signals.detect("which foods help with morning sickness in early pregnancy", h)
    assert signals.detect("hello") == []


async def test_feedback_on_an_answer_is_stored_without_text(make_user, chat):
    u = await make_user("Amaka Obi")
    await say(u.id, "No, that's not what I meant")
    assert "correction" in chat.db["ai_safety_events"].docs[-1]["signals"]
    answer = [m for m in chat.db["messages"].docs if m["role"] == "assistant"][-1]
    assert await ai_service.record_feedback(u.id, "s1", answer["id"], False, "misunderstood")
    assert await ai_service.record_feedback(u.id, "s1", answer["id"], True, "helpful")          # a new rating replaces the old
    (fb,) = chat.db["ai_feedback"].docs
    assert fb["helpful"] is True and fb["reason"] == "helpful" and "content" not in fb
    assert not await ai_service.record_feedback(u.id, "s1", "no-such-message", True, None)
