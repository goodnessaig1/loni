"""
The rules for WHETHER a mother gets a hello today. Pure functions: no database, no clock of their own, so every rule
can be tested exactly and the scheduler's dry-run can explain each decision.

The guards, in the order they are checked (cheap first):
  1. she turned check-ins off
  2. quiet hours / before her preferred hour (in HER timezone)
  3. already sent a daily hello for her local date          <- the "not twice a day" rule
  4. hit the cap on all proactive messages for today
  5. sent one too recently for her care level               <- the cadence
  6. she is mid-conversation with Loni or already active today
  7. a ride is in progress
  8. no device to deliver to
"""
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from app.modules.checkins import content

STANDARD, ENHANCED, INTENSIVE = "standard", "enhanced", "intensive"


@dataclass
class Signals:
    """Everything the decision needs, gathered by the service. Fields with a default are the 'nothing notable' case."""
    last_daily_local_date: Optional[date] = None      # her local date of the last daily hello
    last_template_key: Optional[str] = None
    sent_today: int = 0                               # proactive messages already sent for her local date (all kinds)
    daily_sent_today: bool = False
    consecutive_ignored: int = 0                      # hellos in a row that she neither opened nor answered
    rough_responses_3d: int = 0                       # "not great"/worrying answers in the last 3 days
    urgent_event_hours: Optional[float] = None        # hours since her last urgent/emergency AI conversation
    mental_health_event_days: Optional[float] = None  # days since a mental-health flagged conversation
    active_today: bool = False                        # chatted with Loni / logged care today
    ride_active: bool = False
    has_device: bool = True
    low_mood_days: int = 0                            # days in the last 5 where she told Loni she felt low


@dataclass
class Prefs:
    enabled: bool = True
    timezone: str = "Africa/Lagos"
    preferred_hour: int = 9
    remember: bool = True


@dataclass
class Decision:
    send: bool
    reason: str            # 'ok' or the guard that stopped it
    level: str = STANDARD
    local_date: Optional[date] = None
    gap_days: Optional[int] = None


def safe_zone(name: Optional[str], fallback: str) -> ZoneInfo:
    """A bad or missing timezone never breaks the run; it falls back to the deployment default."""
    for candidate in (name, fallback, "UTC"):
        try:
            return ZoneInfo(candidate)  # type: ignore[arg-type]
        except Exception:
            continue
    return ZoneInfo("UTC")


def care_level(category: str, s: Signals) -> str:
    """How much support she seems to need right now. Recent danger and distress outrank where she is in the journey."""
    if s.urgent_event_hours is not None and s.urgent_event_hours <= 72:
        return INTENSIVE
    if s.mental_health_event_days is not None and s.mental_health_event_days <= 7:
        return INTENSIVE
    if s.rough_responses_3d >= 2 or s.low_mood_days >= 3:
        return INTENSIVE
    if s.rough_responses_3d == 1 or s.low_mood_days >= 1:
        return ENHANCED
    if s.urgent_event_hours is not None and s.urgent_event_hours <= 24 * 14:
        return ENHANCED
    if category in (content.PREG_TERM, content.PP_EARLY):
        return ENHANCED      # the two stretches where things change fastest
    return STANDARD


def gap_days(category: str, level: str, consecutive_ignored: int) -> int:
    if consecutive_ignored >= content.BACKOFF_AFTER_IGNORED:
        return content.BACKOFF_GAP_DAYS      # be gentle: she is not engaging
    if level == INTENSIVE:
        return content.INTENSIVE_GAP_DAYS
    if level == ENHANCED:
        return content.ENHANCED_GAP_DAYS
    return content.STANDARD_GAP_DAYS.get(category, content.STANDARD_GAP_DAYS[content.GENERAL])


def local_now(now: datetime, tz: ZoneInfo) -> datetime:
    return (now if now.tzinfo else now.replace(tzinfo=timezone.utc)).astimezone(tz)


def decide_daily(now: datetime, prefs: Prefs, category: str, s: Signals, *, default_tz: str, end_hour: int, max_per_day: int) -> Decision:
    tz = safe_zone(prefs.timezone, default_tz)
    local = local_now(now, tz)
    today = local.date()
    level = care_level(category, s)
    gap = gap_days(category, level, s.consecutive_ignored)

    def no(reason: str) -> Decision:
        return Decision(False, reason, level, today, gap)

    if not prefs.enabled:
        return no("disabled")
    if local.hour >= end_hour:
        return no("quiet_hours")
    if local.hour < prefs.preferred_hour:
        return no("before_preferred_hour")
    if s.daily_sent_today:
        return no("already_sent_today")
    if s.sent_today >= max_per_day:
        return no("daily_cap")
    if s.last_daily_local_date is not None and (today - s.last_daily_local_date).days < gap:
        return no("too_soon")
    if s.active_today:
        return no("active_today")
    if s.ride_active:
        return no("ride_active")
    if not s.has_device:
        return no("no_device")
    return Decision(True, "ok", level, today, gap)


def decide_followup(now: datetime, prefs: Prefs, s: Signals, *, default_tz: str, end_hour: int, max_per_day: int) -> Decision:
    """A follow-up to a worrying conversation. Not limited by the daily-hello gap, but it respects opt-out, quiet hours,
    the per-day cap and whether she can be reached, because someone who is unwell should not be missed."""
    tz = safe_zone(prefs.timezone, default_tz)
    local = local_now(now, tz)
    today = local.date()

    def no(reason: str) -> Decision:
        return Decision(False, reason, INTENSIVE, today)

    if not prefs.enabled:
        return no("disabled")
    if local.hour >= end_hour:
        return no("quiet_hours")
    if local.hour < min(prefs.preferred_hour, 9):
        return no("before_preferred_hour")
    if s.sent_today >= max_per_day:
        return no("daily_cap")
    if s.ride_active:
        return no("ride_active")
    if not s.has_device:
        return no("no_device")
    return Decision(True, "ok", INTENSIVE, today)
