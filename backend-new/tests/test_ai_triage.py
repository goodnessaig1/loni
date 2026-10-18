import pytest

from app.modules.ai_chat.triage import StageContext, Urgency, triage
from tests.triage_cases import EMERGENCY, NOT_ESCALATED, URGENT, WOMENS_EMERGENCY, WOMENS_NOT_ESCALATED, WOMENS_URGENT

_RANK = {Urgency.educational: 0, Urgency.routine: 1, Urgency.urgent: 2, Urgency.emergency: 3}


def _stage(s):
    return StageContext(*s) if s else StageContext()


@pytest.mark.parametrize("text,stage", EMERGENCY)
def test_emergencies_are_never_under_triaged(text, stage):
    r = triage(text, _stage(stage))
    assert r.urgency == Urgency.emergency, f"{text!r} -> {r.urgency.value} {r.rule_ids}"


@pytest.mark.parametrize("text,stage", URGENT)
def test_urgent_signs_are_never_dismissed(text, stage):
    r = triage(text, _stage(stage))
    assert _RANK[r.urgency] >= _RANK[Urgency.urgent], f"{text!r} -> {r.urgency.value} {r.rule_ids}"


@pytest.mark.parametrize("text,stage", NOT_ESCALATED)
def test_everyday_questions_are_not_alarmed(text, stage):
    r = triage(text, _stage(stage))
    assert _RANK[r.urgency] <= _RANK[Urgency.routine], f"{text!r} -> {r.urgency.value} {r.rule_ids}"


# ── behaviour that matters beyond the label ──────────────────────────────────────────────────────────

def test_negation_only_cancels_the_symptom_it_touches():
    assert triage("I'm not sure what's wrong but I'm bleeding heavily").urgency == Urgency.emergency
    assert triage("no bleeding but I can't breathe").urgency == Urgency.emergency
    assert _RANK[triage("I have no bleeding and no pain").urgency] <= 1


def test_a_general_question_is_flagged_info_only_not_alarmed():
    r = triage("What does heavy bleeding in pregnancy mean?", StageContext("pregnancy", 25))
    assert r.urgency == Urgency.educational and r.info_only
    assert triage("What are the signs of preeclampsia?", StageContext("pregnancy", 25)).urgency == Urgency.educational
    assert triage("I have a severe headache and blurred vision", StageContext("pregnancy", 25)).urgency == Urgency.emergency


def test_waters_or_labour_before_37_weeks_escalate_to_emergency():
    assert triage("my waters broke", StageContext("pregnancy", 34)).urgency == Urgency.emergency
    assert triage("my waters broke", StageContext("pregnancy", 39)).urgency == Urgency.urgent
    assert triage("my waters broke").urgency == Urgency.urgent  # week unknown: not escalated beyond urgent


def test_no_movement_early_in_pregnancy_is_not_a_red_flag_but_later_is():
    assert _RANK[triage("I can't feel the baby move", StageContext("pregnancy", 12)).urgency] <= 1
    assert triage("I can't feel the baby move", StageContext("pregnancy", 30)).urgency == Urgency.urgent
    assert triage("I can't feel the baby move").urgency == Urgency.urgent  # unknown week: err on the safe side


def test_my_baby_while_pregnant_is_not_read_as_a_newborn_problem():
    r = triage("my baby is hot and kicking a lot", StageContext("pregnancy", 30))
    assert "newborn_danger_signs" not in r.rule_ids


def test_lochia_after_birth_is_not_alarmed_but_heavy_bleeding_still_is():
    assert _RANK[triage("I'm still bleeding lightly", StageContext("postpartum", 2)).urgency] <= 1
    assert triage("I'm bleeding heavily", StageContext("postpartum", 2)).urgency == Urgency.emergency


def test_three_separate_urgent_signs_together_become_an_emergency():
    r = triage("I have a fever, I've been vomiting all day and I can't keep water down, and my face is suddenly swollen", StageContext("pregnancy", 30))
    assert r.urgency == Urgency.emergency


def test_actions_only_include_things_loni_can_do():
    allowed = {"request_ride", "talk_to_nurse", "call_emergency"}
    for text, stage in EMERGENCY + URGENT:
        for a in triage(text, _stage(stage)).actions:
            assert a["type"] in allowed
    bleed = triage("I'm bleeding heavily", StageContext("pregnancy", 30))
    assert [a["type"] for a in bleed.actions] == ["request_ride", "talk_to_nurse", "call_emergency"]


def test_a_mental_health_crisis_is_not_sent_a_ride():
    r = triage("I want to kill myself")
    assert r.urgency == Urgency.emergency and r.domain == "mental_health" and r.template == "crisis"
    assert [a["type"] for a in r.actions] == ["talk_to_nurse", "call_emergency"]
    assert triage("I might hurt my baby").template == "harm_baby"


def test_newborn_and_seizure_get_their_own_messages():
    assert triage("my newborn is not breathing", StageContext("postpartum", 0)).template == "newborn"
    assert triage("she is having a seizure").template == "seizure"
    assert triage("I can't breathe").template == "breathing"
    assert triage("the baby's head is coming out").template == "birth"


def test_question_type_selects_a_response_pattern():
    assert triage("Can I take this malaria medicine at 20 weeks?", StageContext("pregnancy", 20)).answer_type == "medication"
    assert triage("My haemoglobin is 9.8, what does it mean?").answer_type == "test_explanation"
    assert triage("Can you help me find a nurse for tomorrow?").answer_type == "care_navigation"
    assert triage("Can I eat pap, eggs or local fish?").answer_type == "nutrition"
    assert triage("I feel so lonely and scared").answer_type == "emotional_support"


def test_care_navigation_never_offers_more_than_the_app_can_do():
    r = triage("Can you help me find a nurse for tomorrow?")
    assert [a["type"] for a in r.actions] == ["talk_to_nurse"]


def test_blank_and_odd_input_is_safe():
    for text in ("", "   ", "???", "😭", "a" * 5000):
        assert triage(text).urgency in (Urgency.educational, Urgency.routine)


@pytest.mark.parametrize("text,stage", WOMENS_EMERGENCY)
def test_womens_health_emergencies(text, stage):
    r = triage(text, _stage(stage))
    assert r.urgency == Urgency.emergency, f"{text!r} -> {r.urgency.value} {r.rule_ids}"


@pytest.mark.parametrize("text,stage", WOMENS_URGENT)
def test_womens_health_urgent_signs(text, stage):
    r = triage(text, _stage(stage))
    assert _RANK[r.urgency] >= _RANK[Urgency.urgent], f"{text!r} -> {r.urgency.value} {r.rule_ids}"


@pytest.mark.parametrize("text,stage", WOMENS_NOT_ESCALATED)
def test_everyday_womens_health_questions_are_not_alarmed(text, stage):
    r = triage(text, _stage(stage))
    assert _RANK[r.urgency] <= _RANK[Urgency.routine], f"{text!r} -> {r.urgency.value} {r.rule_ids}"


def test_pregnancy_only_rules_do_not_fire_for_women_who_are_not_pregnant():
    for text in ("I have some spotting", "baby hasn't moved", "my waters broke", "I think I'm in labour", "I fell on my stomach"):
        assert _RANK[triage(text, StageContext("general", 0)).urgency] <= 1, text
    assert triage("my waters broke", StageContext("pregnancy", 30)).urgency == Urgency.emergency


def test_a_very_heavy_period_is_urgent_but_heavy_bleeding_with_faintness_or_unknown_cause_is_an_emergency():
    heavy = "my period is very heavy and I'm soaking pads"
    assert triage(heavy, StageContext("general", 0)).urgency == Urgency.urgent
    assert triage(heavy + " and I feel dizzy", StageContext("general", 0)).urgency == Urgency.emergency
    assert triage("I'm bleeding heavily", StageContext("general", 0)).urgency == Urgency.emergency   # could be a miscarriage she doesn't know about
    assert triage(heavy, StageContext("pregnancy", 12)).urgency == Urgency.emergency


def test_womens_health_question_types_and_nurse_offer():
    t = lambda text: triage(text, StageContext("general", 0))
    assert t("Which birth control is best for me?").answer_type == "contraception"
    assert t("We are trying to conceive, when do I ovulate?").answer_type == "fertility"
    assert t("I have hot flushes and night sweats").answer_type == "menopause"
    assert t("How do I check my breasts for lumps?").answer_type == "breast_health"
    assert t("What is a pap smear?").answer_type == "sexual_health"
    assert t("I have a UTI").answer_type == "urinary_pelvic"
    assert t("My periods are irregular").answer_type == "cycle_health"
    assert [a["type"] for a in t("My periods are irregular").actions] == ["talk_to_nurse"]


def test_breast_lump_and_postmenopausal_bleeding_ask_for_a_check_soon_not_an_emergency_message():
    r = triage("I found a lump in my breast", StageContext("general", 0))
    assert r.urgency == Urgency.urgent and r.template == "soon"
    r = triage("I'm 60 and my periods stopped 10 years ago but I saw some blood", StageContext("general", 0))
    assert r.urgency == Urgency.urgent and r.template == "soon"


def test_sexual_assault_gets_a_supportive_urgent_message_with_emergency_services_and_a_nurse():
    r = triage("I was raped last night", StageContext("general", 0))
    assert r.urgency == Urgency.urgent and r.template == "assault" and [a["type"] for a in r.actions] == ["call_emergency", "talk_to_nurse"]
