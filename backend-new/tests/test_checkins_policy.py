from datetime import date, datetime, timezone

import pytest

from app.modules.checkins import content, policy
from app.modules.checkins.policy import ENHANCED, INTENSIVE, STANDARD, Prefs, Signals

KW = dict(default_tz="Africa/Lagos", end_hour=20, max_per_day=2)
UTC = timezone.utc


def at(h, m=0, day=15):
    return datetime(2026, 10, day, h, m, tzinfo=UTC)


def decide(now, category=content.PREG_T2, signals=None, prefs=None):
    return policy.decide_daily(now, prefs or Prefs(), category, signals or Signals(), **KW)


# ── categories and care levels ───────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("kind,week,expected", [
    ("pregnancy", 5, content.PREG_T1), ("pregnancy", 12, content.PREG_T1), ("pregnancy", 13, content.PREG_T2),
    ("pregnancy", 27, content.PREG_T2), ("pregnancy", 28, content.PREG_T3), ("pregnancy", 36, content.PREG_T3),
    ("pregnancy", 37, content.PREG_TERM), ("pregnancy", 41, content.PREG_TERM), ("pregnancy", None, content.GENERAL),
    ("postpartum", 0, content.PP_EARLY), ("postpartum", 6, content.PP_EARLY), ("postpartum", 7, content.PP_ACTIVE),
    ("postpartum", 12, content.PP_ACTIVE), ("postpartum", 13, content.PP_EXTENDED), (None, None, content.GENERAL),
])
def test_category_of(kind, week, expected):
    assert content.category_of(kind, week) == expected


def test_care_level_follows_recent_danger_and_distress_over_the_stage():
    assert policy.care_level(content.PREG_T2, Signals()) == STANDARD
    assert policy.care_level(content.PREG_TERM, Signals()) == ENHANCED          # fast-changing stretches
    assert policy.care_level(content.PP_EARLY, Signals()) == ENHANCED
    assert policy.care_level(content.PREG_T2, Signals(urgent_event_hours=30)) == INTENSIVE
    assert policy.care_level(content.PREG_T2, Signals(urgent_event_hours=24 * 10)) == ENHANCED
    assert policy.care_level(content.PREG_T2, Signals(urgent_event_hours=24 * 20)) == STANDARD
    assert policy.care_level(content.PREG_T2, Signals(mental_health_event_days=3)) == INTENSIVE
    assert policy.care_level(content.PREG_T2, Signals(rough_responses_3d=1)) == ENHANCED
    assert policy.care_level(content.PREG_T2, Signals(rough_responses_3d=2)) == INTENSIVE


def test_cadence_depends_on_category_and_level_and_backs_off_when_ignored():
    assert policy.gap_days(content.PREG_T2, STANDARD, 0) == 3
    assert policy.gap_days(content.PREG_T1, STANDARD, 0) == 2
    assert policy.gap_days(content.PP_EARLY, ENHANCED, 0) == 1
    assert policy.gap_days(content.PREG_T2, INTENSIVE, 0) == 1
    assert policy.gap_days(content.PREG_T2, INTENSIVE, 3) == 7   # even a mother who needs more is not pestered when she is silent
    assert policy.gap_days(content.GENERAL, STANDARD, 2) == 3


# ── each guard ───────────────────────────────────────────────────────────────────────────────────────

def test_happy_path_sends_in_her_morning():
    d = decide(at(8, 30))             # 09:30 in Lagos
    assert d.send and d.reason == "ok" and d.local_date == date(2026, 10, 15)


@pytest.mark.parametrize("signals,prefs,now,reason", [
    (Signals(), Prefs(enabled=False), at(9), "disabled"),
    (Signals(), Prefs(), at(7, 30), "before_preferred_hour"),   # 08:30 Lagos, she is first eligible at 09:00
    (Signals(), Prefs(), at(19, 30), "quiet_hours"),            # 20:30 Lagos
    (Signals(daily_sent_today=True, sent_today=1), Prefs(), at(9), "already_sent_today"),
    (Signals(sent_today=2), Prefs(), at(9), "daily_cap"),
    (Signals(last_daily_local_date=date(2026, 10, 14)), Prefs(), at(9), "too_soon"),   # t2 standard gap is 3 days
    (Signals(active_today=True), Prefs(), at(9), "active_today"),
    (Signals(ride_active=True), Prefs(), at(9), "ride_active"),
    (Signals(has_device=False), Prefs(), at(9), "no_device"),
])
def test_every_guard_blocks_with_its_own_reason(signals, prefs, now, reason):
    d = decide(now, signals=signals, prefs=prefs)
    assert not d.send and d.reason == reason


def test_the_same_hello_cannot_go_twice_on_one_local_day_even_at_different_hours():
    sent = Signals(daily_sent_today=True, sent_today=1, last_daily_local_date=date(2026, 10, 15))
    for h in (9, 12, 15, 19):
        assert decide(at(h - 1), signals=sent).reason == "already_sent_today"


def test_time_windows_use_her_timezone_not_the_servers():
    ny = Prefs(timezone="America/New_York")                     # UTC-4 in October
    assert decide(at(14), prefs=ny).send                         # 10:00 in New York
    assert decide(at(8), prefs=ny).reason == "before_preferred_hour"   # 04:00 there
    assert decide(at(0, 30, day=16), prefs=ny).local_date == date(2026, 10, 15)  # still the 15th in New York


def test_a_bad_timezone_falls_back_instead_of_breaking_the_run():
    d = decide(at(8, 30), prefs=Prefs(timezone="Mars/Olympus"))
    assert d.send


def test_gap_is_counted_in_her_local_days():
    last = Signals(last_daily_local_date=date(2026, 10, 12))   # 3 days ago
    assert decide(at(9), signals=last).send
    assert decide(at(9), category=content.PREG_TERM, signals=Signals(last_daily_local_date=date(2026, 10, 14))).send  # enhanced: daily


def test_followups_ignore_the_gap_but_respect_opt_out_quiet_hours_cap_and_reachability():
    f = lambda s, p=Prefs(), now=at(10): policy.decide_followup(now, p, s, **KW)
    assert f(Signals(last_daily_local_date=date(2026, 10, 15), daily_sent_today=True, sent_today=1)).send
    assert f(Signals(), Prefs(enabled=False)).reason == "disabled"
    assert f(Signals(), now=at(19, 30)).reason == "quiet_hours"
    assert f(Signals(sent_today=2)).reason == "daily_cap"
    assert f(Signals(has_device=False)).reason == "no_device"
    assert f(Signals(ride_active=True)).reason == "ride_active"


# ── messages ─────────────────────────────────────────────────────────────────────────────────────────

def test_every_template_renders_with_or_without_a_name_and_week():
    for t in content.all_templates():
        for name, week in (("Toyosola", 22), (None, None), ("  ", 0)):
            title, body = content.render(t, name, week)
            assert "{" not in title + body and "}" not in title + body and body.strip()
    assert "there" in content.render(content._T[content.GENERAL][0], None, None)[1]


def test_pick_avoids_repeating_the_last_message():
    for last in ("t2_a", "t2_b", "t2_c"):
        for _ in range(30):
            assert content.pick(content.PREG_T2, last).key != last
    assert content.pick(content.GENERAL, "no-such-key").key.startswith("gen_")


def test_chips_map_back_to_their_meaning_and_nurse_chip_has_no_message():
    assert content.chip_for_message("I'm not feeling great today.").key == "rough"
    assert content.chip_for_message("  i'm doing well today.  ").key == "good"
    assert content.chip_for_message("something else entirely") is None
    assert content.NURSE.message is None
    assert all(len(set(c.key for c in cs)) == len(cs) for cs in (content.CHIPS, content.FOLLOWUP_CHIPS, content.FOLLOWUP_MENTAL_CHIPS))
