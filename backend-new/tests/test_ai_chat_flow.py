"""The chat stream end to end, with a fake database and a fake model: what is sent, in what order, and what is saved."""
import asyncio
import json
from types import SimpleNamespace

import pytest

from app.modules.ai_chat import classifier, safety, service
from app.modules.ai_chat.triage import StageContext, Urgency, triage
from app.modules.users.models import StatusEnum
from tests.fakes import FakeDb

pytestmark = pytest.mark.anyio


# ── fakes ────────────────────────────────────────────────────────────────────────────────────────────

class FakeLLM:
    """`classifier_reply` answers the non-streaming triage call; `answer` is streamed for the real reply."""

    def __init__(self, answer=("Here is some ", "helpful information."), classifier_reply='{"urgency":"routine","domain":"general"}',
                 classifier_error=None, answer_error=None, failing_models=()):
        self.answer, self.classifier_reply = answer, classifier_reply
        self.classifier_error, self.answer_error = classifier_error, answer_error
        self.failing_models = failing_models
        self.stream_calls = []
        self.stream_models = []
        self.classifier_calls = 0
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def with_options(self, **_):
        return self

    async def _create(self, **kw):
        if not kw.get("stream"):
            self.classifier_calls += 1
            if self.classifier_error:
                raise self.classifier_error
            msg = SimpleNamespace(content=self.classifier_reply)
            return SimpleNamespace(choices=[SimpleNamespace(message=msg)])
        self.stream_calls.append(kw["messages"])
        self.stream_models.append(kw["model"])
        if self.answer_error:
            raise self.answer_error
        if kw["model"] in self.failing_models:
            raise RuntimeError("503 This model is currently experiencing high demand")

        async def gen():
            for piece in self.answer:
                yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=piece))])
        return gen()


MOTHER = SimpleNamespace(name="Toyosola Ade", email="toyo@example.com", phone="08012345678", status=StatusEnum.pregnant,
                         pregnancy_week="22 weeks", pregnancy_start_date=None, baby_age=None)


@pytest.fixture
def env(monkeypatch, session_factory):
    db = FakeDb()
    monkeypatch.setattr(service, "get_mongo_db", lambda: db)
    monkeypatch.setattr(service, "AsyncSessionLocal", session_factory)
    holder = {}

    def use(llm: FakeLLM):
        holder["llm"] = llm
        monkeypatch.setattr(service, "_client_and_model", lambda: (llm, "fake-model"))
        return llm
    return db, use


async def run(text, user=MOTHER, session="s1"):
    events = []
    async for raw in service.stream_chat_message(session, "u1", text, user):
        assert raw.startswith("data: ")
        body = raw[6:].strip()
        events.append(body if body == "[DONE]" else json.loads(body))
    meta = next(e["meta"] for e in events if isinstance(e, dict) and "meta" in e)
    content = "".join(e["content"] for e in events if isinstance(e, dict) and "content" in e)
    return events, meta, content


# ── tests ────────────────────────────────────────────────────────────────────────────────────────────

async def test_emergency_is_answered_instantly_without_calling_the_model(env):
    db, use = env
    llm = use(FakeLLM())
    events, meta, content = await run("I'm bleeding heavily, can I sleep first?")

    assert meta["urgency"] == "emergency"
    assert [a["type"] for a in meta["actions"]] == ["request_ride", "talk_to_nurse", "call_emergency"]
    assert meta["actions"][2]["phone"]  # the number comes from settings, never from the model
    assert content.startswith("**This could be an emergency") and "?" not in content  # action first, no questions
    assert "about 22 weeks pregnant" in content
    assert events[0] == {"meta": meta} and events[-1] == "[DONE]"
    assert llm.stream_calls == [] and llm.classifier_calls == 0  # nothing waited on a model

    saved = [m for m in db["messages"].docs if m["role"] == "assistant"][0]
    assert saved["content"] == content and saved["meta"]["urgency"] == "emergency"  # history reloads with its card
    audit = db["ai_safety_events"].docs[0]
    assert audit["urgency"] == "emergency" and audit["llm_called"] is False
    assert "sleep first" not in json.dumps(audit, default=str)  # the audit trail never holds her words


async def test_urgent_gets_the_fixed_line_first_then_a_directed_model_answer(env):
    db, use = env
    llm = use(FakeLLM(answer=("Fever in pregnancy needs a check. ", "Tap Talk to a Nurse below.")))
    events, meta, content = await run("I have a fever of 39 and chills")

    assert meta["urgency"] == "urgent"
    assert content.startswith("**Please get this checked by a healthcare professional today")
    assert "Fever in pregnancy needs a check." in content
    sent = llm.stream_calls[0]
    assert sent[-1]["role"] == "system" and "URGENT CASE" in sent[-1]["content"]  # directive goes last, where it weighs most


async def test_a_reassuring_model_answer_to_a_red_flag_is_corrected(env):
    db, use = env
    use(FakeLLM(answer=("Don't worry, this is completely normal in pregnancy.",)))
    _, _, content = await run("my baby hasn't moved all day")
    assert "please don't wait or assume this is normal" in content
    assert db["ai_safety_events"].docs[0]["validator_notes"] >= 1


async def test_urgent_model_failure_still_tells_her_to_get_care(env):
    db, use = env
    use(FakeLLM(answer_error=RuntimeError("provider down")))
    _, _, content = await run("I have a fever of 39")
    assert content.startswith("**Please get this checked") and "Talk to a Nurse" in content


async def test_an_overloaded_main_model_hands_the_reply_to_the_fast_one(env, monkeypatch):
    db, use = env
    monkeypatch.setattr(service, "get_provider", lambda: SimpleNamespace(classifier_model="fake-fast", short_max_tokens=40))
    llm = use(FakeLLM(failing_models=("fake-model",)))
    events, meta, content = await run("What foods are good for iron?")
    assert llm.stream_models == ["fake-model", "fake-fast"]
    assert "Here is some helpful information." in content
    assert "technical difficulties" not in content
    assert events[-1] == "[DONE]"


async def test_classifier_can_raise_a_message_the_rules_missed_to_an_emergency(env):
    db, use = env
    text = "something feels terribly wrong, the baby, I think I'm dying"
    assert triage(text, StageContext("pregnancy", 22)).urgency in (Urgency.educational, Urgency.routine)  # rules alone miss it
    llm = use(FakeLLM(classifier_reply='{"urgency":"emergency","domain":"pregnancy"}'))
    _, meta, content = await run(text)
    assert meta["urgency"] == "emergency" and "llm_classifier" in db["ai_safety_events"].docs[0]["rule_ids"]
    assert content.startswith("**This could be an emergency") and llm.stream_calls == []


async def test_classifier_cannot_lower_what_the_rules_found(env):
    db, use = env
    use(FakeLLM(classifier_reply='{"urgency":"educational","domain":"general"}'))
    _, meta, _ = await run("I have a fever of 39")
    assert meta["urgency"] == "urgent"


async def test_classifier_failures_fail_open_to_the_rules(env):
    db, use = env
    for llm in (FakeLLM(classifier_error=asyncio.TimeoutError()), FakeLLM(classifier_reply="I think this is fine!"),
                FakeLLM(classifier_reply='{"urgency":"banana"}')):
        use(llm)
        _, meta, content = await run("What foods should I avoid?")
        assert meta["urgency"] == "educational" and "helpful information" in content
        _, meta, _ = await run("my baby is turning blue", user=SimpleNamespace(**{**MOTHER.__dict__, "status": StatusEnum.newMom, "baby_age": "0", "pregnancy_week": None}))
        assert meta["urgency"] == "emergency"  # the rules still protect her when the model is down


async def test_a_mental_health_emergency_gets_the_crisis_message_not_a_ride(env):
    db, use = env
    llm = use(FakeLLM())
    _, meta, content = await run("I don't want to live anymore")
    assert meta["urgency"] == "emergency" and [a["type"] for a in meta["actions"]] == ["talk_to_nurse", "call_emergency"]
    assert "safety matters most" in content and llm.stream_calls == []


async def test_the_model_gets_her_stage_and_name_but_no_contact_details(env):
    db, use = env
    llm = use(FakeLLM())
    await run("Can I eat pap, eggs or local fish?")
    sent = llm.stream_calls[0]
    context = next(m["content"] for m in sent if m["role"] == "system" and m["content"].startswith("MOTHER CONTEXT"))
    assert "Toyosola" in context and "week 22" in context and "trimester 2" in context
    joined = json.dumps(sent)
    assert "toyo@example.com" not in joined and "08012345678" not in joined and "Ade" not in context


async def test_question_type_directive_reaches_the_model(env):
    db, use = env
    llm = use(FakeLLM())
    await run("Should I stop taking my prescribed iron tablets?")
    last = llm.stream_calls[0][-1]
    assert last["role"] == "system" and "never tell her to start, stop or change" in last["content"]


async def test_an_unknown_profile_does_not_invent_a_week(env):
    db, use = env
    llm = use(FakeLLM())
    nobody = SimpleNamespace(name=None, status=None, pregnancy_week=None, pregnancy_start_date=None, baby_age=None)
    await run("hello", user=nobody)
    context = next(m["content"] for m in llm.stream_calls[0] if m["content"].startswith("MOTHER CONTEXT"))
    assert "Stage: unknown" in context and "about week" not in context


async def test_general_question_about_a_danger_sign_is_answered_not_alarmed(env):
    db, use = env
    llm = use(FakeLLM())
    _, meta, _ = await run("What does heavy bleeding in pregnancy mean?")
    assert meta["urgency"] == "educational" and [a["type"] for a in meta["actions"]] == ["talk_to_nurse"]
    assert "general question" in llm.stream_calls[0][-1]["content"]


# ── output validator ─────────────────────────────────────────────────────────────────────────────────

def test_validator_catches_unsafe_claims():
    assert safety.validate(Urgency.urgent, "Don't worry, it's normal.")
    assert safety.validate(Urgency.urgent, "Rest and drink water.")  # no referral at all
    assert safety.validate(Urgency.urgent, "Please see a doctor today.") == [safety.DISCLAIMER]  # referral ok, reminder missing
    assert safety.validate(Urgency.routine, "Take 500 mg of paracetamol every 6 hours.")
    assert safety.validate(Urgency.routine, "You can stop taking your tablets.")
    assert safety.validate(Urgency.routine, "I've booked a driver and a nurse is on the way.")
    assert not safety.validate(Urgency.educational, "Pap is a good source of energy. Eat it warm.")
    assert not safety.validate(Urgency.routine, "Talk to a nurse or your doctor about your medicines.")


def test_classifier_parse_is_strict():
    assert classifier.parse('{"urgency":"emergency","domain":"newborn"}') == (Urgency.emergency, "newborn")
    assert classifier.parse('Sure! {"urgency": "Urgent", "domain": "weird"}') == (Urgency.urgent, "general")
    for bad in ("", "emergency", '{"urgency":"maybe"}', "{not json}", '{"domain":"pregnancy"}'):
        assert classifier.parse(bad) is None


# ── disclaimer, emergency number, nurse offer, partner, transport, human review ─────────────────────

def test_health_answers_carry_a_short_disclaimer_but_small_talk_does_not():
    assert safety.validate(Urgency.routine, "Nausea is common. Try small meals.", "symptom_guidance")[-1] == safety.DISCLAIMER
    assert safety.validate(Urgency.educational, "Pap is a good energy food.", "nutrition") == [safety.DISCLAIMER]
    assert not safety.validate(Urgency.educational, "Nausea is common. This is general information and not a substitute for your own doctor.", "symptom_guidance")
    assert not safety.validate(Urgency.educational, "Hello! How are you today?", "other")
    assert not safety.validate(Urgency.routine, "That sounds heavy. I'm here with you.", "emotional_support")


async def test_a_health_reply_is_saved_with_the_disclaimer_appended(env):
    db, use = env
    use(FakeLLM(answer=("Eat small meals and drink water.",)))
    _, _, content = await run("Why do I feel nauseous every morning?")
    assert content.rstrip().endswith(safety.DISCLAIMER)
    saved = [m for m in db["messages"].docs if m["role"] == "assistant"][0]
    assert saved["content"] == content


async def test_emergency_message_names_the_configured_number_and_says_loni_is_not_an_ambulance(env, monkeypatch):
    db, use = env
    use(FakeLLM())
    monkeypatch.setattr(service.settings, "EMERGENCY_PHONE", "112")
    _, meta, content = await run("I'm bleeding heavily")
    assert "emergency services (112)" in content and "not an ambulance" in content.lower()
    assert next(a for a in meta["actions"] if a["type"] == "call_emergency")["phone"] == "112"


def test_system_prompt_has_the_agreed_structure_and_the_configured_number():
    from app.modules.ai_chat.prompts import build_system_prompt
    p = build_system_prompt("112")
    assert "emergency number for this app is 112" in p and "{emergency_phone}" not in p
    for must in ("older sister", "not alone", "Please get medical care right away if", "not a substitute", "LONI nurse",
                 "Never contradict a doctor", "primary health centre", "never delay urgent advice", "she controls what her partner"):
        assert must.lower() in p.lower(), must


def test_nurse_is_offered_under_health_answers_and_partner_invite_where_it_fits():
    kinds = lambda text, st=None: [a["type"] for a in triage(text, st).actions]
    assert kinds("Why do I feel nauseous every morning?", StageContext("pregnancy", 8)) == ["talk_to_nurse"]
    assert kinds("I feel so lonely and scared") == ["talk_to_nurse", "invite_partner"]
    assert kinds("How do I involve my husband in my pregnancy?") == ["invite_partner", "talk_to_nurse"]
    assert kinds("When should I go to hospital?", StageContext("pregnancy", 38)) == ["talk_to_nurse"]
    assert kinds("Can I eat pap, eggs or local fish?") == []  # no nurse button on a food question
    assert triage("How do I involve my husband in my pregnancy?").answer_type == "partner_family"
    assert triage("Which hospital should I choose for delivery?").answer_type == "decision_support"


def test_needing_a_way_to_hospital_puts_the_ride_first():
    for text in ("I need to get to the hospital now", "please take me to the hospital urgently", "I need an ambulance"):
        r = triage(text, StageContext("pregnancy", 36))
        assert r.urgency in (Urgency.urgent, Urgency.emergency) and r.actions[0]["type"] == "request_ride", text
    assert triage("Which hospital should I choose?", StageContext("pregnancy", 20)).urgency != Urgency.urgent


async def test_high_risk_conversations_are_queued_for_human_review(env):
    db, use = env
    use(FakeLLM())
    await run("I'm bleeding heavily", session="s-red")
    await run("What foods should I avoid?", session="s-green")
    events = await service.list_safety_events()
    assert [e["session_id"] for e in events] == ["s-red"]          # only the risky one is queued
    assert "bleeding heavily" not in json.dumps(events, default=str)  # and it holds no message text

    assert await service.mark_safety_event_reviewed(events[0]["id"], "admin1", "  Appropriate response.  ")
    assert await service.list_safety_events() == []
    done = (await service.list_safety_events(needs_review=False))
    reviewed = next(e for e in done if e["session_id"] == "s-red")
    assert reviewed["reviewed_by"] == "admin1" and reviewed["review_note"] == "Appropriate response."
    assert not await service.mark_safety_event_reviewed("nope", "admin1", None)
