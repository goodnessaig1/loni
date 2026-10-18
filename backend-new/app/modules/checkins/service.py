"""Check-in engine: find mothers who are due, claim the day's slot, deliver, and learn from how she responds."""
import logging
import uuid
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Awaitable, Callable, Dict, List, Optional

from sqlalchemy import or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.core.config import settings
from app.modules.ai_chat.context import first_name, stage_context
from app.modules.checkins import content, memory, policy
from app.modules.checkins.models import CheckinLog, CheckinPreference, WellbeingNote
from app.modules.notifications.models import NotificationLog
from app.modules.notifications.service import NotificationService
from app.modules.rides.models import Ride, TERMINAL_STATUSES
from app.modules.users.models import AccountStatusEnum, User, UserTypeEnum

logger = logging.getLogger("checkins")

BATCH = 500


@dataclass
class CycleReport:
    considered: int = 0
    sent: int = 0
    failed: int = 0
    duplicates: int = 0
    skipped: Counter = field(default_factory=Counter)
    would_send: List[dict] = field(default_factory=list)   # filled in dry runs

    def as_dict(self) -> dict:
        return {"considered": self.considered, "sent": self.sent, "failed": self.failed, "duplicates": self.duplicates,
                "skipped": dict(self.skipped), "would_send": self.would_send}


# ── preferences ──────────────────────────────────────────────────────────────────────────────────────

def effective_prefs(row: Optional[CheckinPreference]) -> policy.Prefs:
    return policy.Prefs(
        enabled=True if row is None else bool(row.enabled),
        timezone=(row.timezone if row and row.timezone else settings.CHECKIN_DEFAULT_TZ),
        preferred_hour=(row.preferred_hour if row and row.preferred_hour is not None else settings.CHECKIN_DEFAULT_HOUR),
        remember=True if row is None else bool(row.remember),
    )


async def get_preferences(db, user_id: str) -> policy.Prefs:
    return effective_prefs(await db.get(CheckinPreference, user_id))


async def save_preferences(db, user_id: str, enabled: Optional[bool], tz: Optional[str], hour: Optional[int],
                           remember: Optional[bool] = None) -> policy.Prefs:
    row = await db.get(CheckinPreference, user_id)
    if row is None:
        row = CheckinPreference(user_id=user_id, enabled=True)
        db.add(row)
    if enabled is not None:
        row.enabled = enabled
    if tz is not None:
        row.timezone = tz
    if hour is not None:
        row.preferred_hour = hour
    if remember is not None:
        row.remember = remember
    await db.commit()
    return effective_prefs(row)


# ── gathering what the policy needs ──────────────────────────────────────────────────────────────────

def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _log_signals(logs: List[CheckinLog], today: date, now: datetime) -> policy.Signals:
    """Postgres-side signals for one mother, from her recent check-in log (newest first)."""
    s = policy.Signals()
    daily = [l for l in logs if l.kind == "daily"]
    if daily:
        s.last_daily_local_date = max(l.local_date for l in daily)
        s.last_template_key = max(daily, key=lambda l: (l.local_date, l.id)).template_key
    s.sent_today = sum(1 for l in logs if l.local_date == today)
    s.daily_sent_today = any(l.local_date == today for l in daily)

    # A hello only counts as ignored once a day has passed; a fresh one has not had a chance to be answered yet.
    for l in sorted(daily, key=lambda l: l.sent_at, reverse=True):
        if _aware(l.sent_at) > now - timedelta(hours=20):
            continue
        if l.opened_at or l.responded_at:
            break
        s.consecutive_ignored += 1
    cutoff = now - timedelta(days=3)
    s.rough_responses_3d = sum(1 for l in logs if l.response_key in ("rough", "concerning") and l.responded_at and _aware(l.responded_at) >= cutoff)
    return s


async def _mongo_signals(mongo, user_id: str, since_local_midnight: datetime, now: datetime, s: policy.Signals) -> None:
    """The costlier, Mongo-side signals. Only fetched for mothers who passed every cheaper guard."""
    s.has_device = bool(await mongo["devices"].find({"user_id": user_id}).limit(1).to_list(length=1))

    sessions = await mongo["sessions"].find({"user_id": user_id}).to_list(length=200)
    ids = [x["id"] for x in sessions]
    if ids:
        recent = await mongo["messages"].find(
            {"session_id": {"$in": ids}, "role": "user", "created_at": {"$gte": since_local_midnight}}).limit(1).to_list(length=1)
        s.active_today = bool(recent)

    events = await mongo["ai_safety_events"].find({"user_id": user_id, "created_at": {"$gte": now - timedelta(days=14)}}).to_list(length=200)
    for e in events:
        age = (now - _aware(e["created_at"])).total_seconds()
        if e.get("urgency") in ("urgent", "emergency"):
            h = age / 3600
            s.urgent_event_hours = h if s.urgent_event_hours is None else min(s.urgent_event_hours, h)
        if e.get("domain") == "mental_health":
            d = age / 86400
            s.mental_health_event_days = d if s.mental_health_event_days is None else min(s.mental_health_event_days, d)


async def _logs_for(db, user_ids: List[str], now: datetime) -> Dict[str, List[CheckinLog]]:
    since = (now - timedelta(days=30)).date()
    rows = (await db.execute(select(CheckinLog).where(CheckinLog.user_id.in_(user_ids), CheckinLog.local_date >= since))).scalars().all()
    out: Dict[str, List[CheckinLog]] = {}
    for r in rows:
        out.setdefault(r.user_id, []).append(r)
    return out


async def _notes_for(db, user_ids: List[str], now: datetime) -> Dict[str, List[WellbeingNote]]:
    since = (now - timedelta(days=9)).date()
    rows = (await db.execute(select(WellbeingNote).where(WellbeingNote.user_id.in_(user_ids), WellbeingNote.day >= since)
                             .order_by(WellbeingNote.day.desc()))).scalars().all()
    out: Dict[str, List[WellbeingNote]] = {}
    for r in rows:
        out.setdefault(r.user_id, []).append(r)
    return out


def choose_template(category: str, week: Optional[int], last_key: Optional[str], logs: List[CheckinLog],
                    notes: List[WellbeingNote], today: date, remembers: bool):
    """(template, symptom). What she told Loni lately beats a generic hello; a milestone beats nothing; otherwise rotate."""
    topic = memory.follow_up_topic(notes, today) if remembers else None
    if topic and last_key not in ("fu_symptom", "fu_lowmood", "fu_better"):
        if topic["kind"] == "symptom":
            return content.FOLLOW_UP_SYMPTOM, topic["symptom"]
        if topic["kind"] == "low_mood":
            return content.FOLLOW_UP_LOW_MOOD, None
        if topic["kind"] == "better":
            return content.FOLLOW_UP_GOOD_NEWS, None
    milestone = content.MILESTONES.get(week or -1) if category in (content.PREG_T1, content.PREG_T2, content.PREG_T3, content.PREG_TERM) else None
    if milestone and not any(l.template_key == milestone.key for l in logs):
        return milestone, None
    return content.pick(category, last_key), None


async def _riders_in_a_ride(db, user_ids: List[str]) -> set:
    return set((await db.execute(
        select(Ride.rider_id).where(Ride.rider_id.in_(user_ids), Ride.status.notin_(TERMINAL_STATUSES)))).scalars().all())


# ── claiming and delivering ──────────────────────────────────────────────────────────────────────────

async def _claim(db, **values) -> Optional[int]:
    """INSERT the log row; only the caller whose insert succeeds may send. This IS the duplicate guard."""
    insert = pg_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
    stmt = insert(CheckinLog).values(status="claimed", **values).on_conflict_do_nothing(index_elements=["user_id", "dedupe_key"]).returning(CheckinLog.id)
    row = (await db.execute(stmt)).first()
    await db.commit()
    return row[0] if row else None


def _chip_payload(chips) -> List[dict]:
    return [{"key": c.key, "label": c.label, "message": c.message, "action": "talk_to_nurse" if c.message is None else None} for c in chips]


async def _deliver(db, mongo, user: User, log_id: int, *, template: content.Template, chips, category: str, level: str, kind: str,
                   stage_week: Optional[int], symptom: Optional[str] = None) -> bool:
    """Create the AI conversation that opens when she taps, the Notification Centre row, and the push."""
    title, body = content.render(template, first_name(user.name), stage_week, symptom)
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    try:
        await mongo["sessions"].insert_one({
            "id": session_id, "user_id": user.id, "title": "Loni check-in", "created_at": now, "updated_at": now,
            "origin": {"type": "checkin", "checkin_id": log_id, "kind": kind, "category": category, "level": level, "template": template.key, "text": body},
        })
        await mongo["messages"].insert_one({
            "id": str(uuid.uuid4()), "session_id": session_id, "role": "assistant", "content": body, "created_at": now,
            "meta": {"urgency": "educational", "answer_type": "checkin", "actions": [], "checkin_id": log_id, "suggestions": _chip_payload(chips)},
        })
        data = {"type": "checkin", "checkin_id": log_id, "session_id": session_id, "route": "/chat/conversation"}
        push_data = {**data, "title": title, "body": body}  # data-only pushes carry their own text for the in-app banner
        note = NotificationLog(user_id=user.id, type="checkin", title=title, body=body, data=data)
        db.add(note)
        await db.flush()
        await db.execute(update(CheckinLog).where(CheckinLog.id == log_id).values(session_id=session_id, notification_id=note.id, status="sent", sent_at=now))
        await db.commit()
    except Exception:
        logger.exception("check-in %s could not be created for %s", log_id, user.id)
        await db.rollback()
        await db.execute(update(CheckinLog).where(CheckinLog.id == log_id).values(status="failed"))
        await db.commit()
        return False
    try:
        await NotificationService.notify_user(user.id, title, body, push_data)
    except Exception:  # the in-app copy exists; a push failure must not undo it
        logger.exception("check-in push failed for %s", user.id)
    return True


# ── the daily cycle ──────────────────────────────────────────────────────────────────────────────────

async def _mothers(db, after_id: str, limit: int):
    stmt = (
        select(User, CheckinPreference)
        .outerjoin(CheckinPreference, CheckinPreference.user_id == User.id)
        .where(User.id > after_id, User.status.isnot(None), or_(User.user_type == UserTypeEnum.user, User.user_type.is_(None)),
               User.account_status != AccountStatusEnum.suspended)
        .order_by(User.id).limit(limit)
    )
    return (await db.execute(stmt)).all()


async def run_cycle(session_factory, mongo, now: Optional[datetime] = None, *, dry_run: bool = False, limit: Optional[int] = None) -> CycleReport:
    """One pass over every mother. Safe to run often and from several processes: each hello is claimed by INSERT."""
    now = now or datetime.now(timezone.utc)
    report = CycleReport()
    after = ""
    while True:
        async with session_factory() as db:
            batch = await _mothers(db, after, BATCH)
            if not batch:
                break
            after = batch[-1][0].id
            ids = [u.id for u, _ in batch]
            logs = await _logs_for(db, ids, now)
            riding = await _riders_in_a_ride(db, ids)
            notes = await _notes_for(db, ids, now)

            for user, pref_row in batch:
                if limit is not None and report.considered >= limit:
                    return report
                report.considered += 1
                prefs = effective_prefs(pref_row)
                tz = policy.safe_zone(prefs.timezone, settings.CHECKIN_DEFAULT_TZ)
                local = policy.local_now(now, tz)
                stage = stage_context(user)
                category = content.category_of(stage.kind, stage.week)

                sig = _log_signals(logs.get(user.id, []), local.date(), now)
                sig.ride_active = user.id in riding
                user_notes = notes.get(user.id, []) if prefs.remember else []
                sig.low_mood_days = memory.low_mood_days(user_notes, local.date())
                kw = dict(default_tz=settings.CHECKIN_DEFAULT_TZ, end_hour=settings.CHECKIN_END_HOUR, max_per_day=settings.CHECKIN_MAX_PER_DAY)
                decision = policy.decide_daily(now, prefs, category, sig, **kw)
                if decision.send:  # passed the cheap guards: now the Mongo-side ones
                    midnight = local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
                    await _mongo_signals(mongo, user.id, midnight, now, sig)
                    decision = policy.decide_daily(now, prefs, category, sig, **kw)
                if not decision.send:
                    report.skipped[decision.reason] += 1
                    continue

                template, symptom = choose_template(category, stage.week, sig.last_template_key, logs.get(user.id, []), user_notes,
                                                    local.date(), prefs.remember)
                if dry_run:
                    report.would_send.append({"user_id": user.id, "category": category, "level": decision.level, "template": template.key})
                    continue
                log_id = await _claim(db, user_id=user.id, dedupe_key=f"daily:{decision.local_date.isoformat()}", kind="daily",
                                      local_date=decision.local_date, category=category, care_level=decision.level, template_key=template.key)
                if log_id is None:
                    report.duplicates += 1
                    continue
                ok = await _deliver(db, mongo, user, log_id, template=template, chips=content.CHIPS, category=category,
                                    level=decision.level, kind="daily", stage_week=stage.week, symptom=symptom)
                report.sent += int(ok)
                report.failed += int(not ok)
    return report


# ── follow-ups after a worrying conversation ─────────────────────────────────────────────────────────

FOLLOWUP_AFTER_HOURS = 20
FOLLOWUP_WITHIN_HOURS = 48


async def run_followups(session_factory, mongo, now: Optional[datetime] = None, *, dry_run: bool = False) -> CycleReport:
    """Ask after anyone whose AI conversation was urgent, an emergency, or about her mental health 20-48h ago."""
    now = now or datetime.now(timezone.utc)
    report = CycleReport()
    events = await mongo["ai_safety_events"].find({
        "created_at": {"$gte": now - timedelta(hours=FOLLOWUP_WITHIN_HOURS), "$lte": now - timedelta(hours=FOLLOWUP_AFTER_HOURS)},
    }).to_list(length=5000)
    latest: Dict[str, dict] = {}
    for e in events:
        if e.get("id") and (e.get("urgency") in ("urgent", "emergency") or e.get("domain") == "mental_health"):
            if e["user_id"] not in latest or e["created_at"] > latest[e["user_id"]]["created_at"]:
                latest[e["user_id"]] = e

    for user_id, event in latest.items():
        async with session_factory() as db:
            user = await db.get(User, user_id)
            if user is None or user.status is None or user.account_status == AccountStatusEnum.suspended:
                continue
            report.considered += 1
            prefs = await get_preferences(db, user_id)
            tz = policy.safe_zone(prefs.timezone, settings.CHECKIN_DEFAULT_TZ)
            local = policy.local_now(now, tz)
            logs = (await _logs_for(db, [user_id], now)).get(user_id, [])
            sig = _log_signals(logs, local.date(), now)
            sig.ride_active = user_id in await _riders_in_a_ride(db, [user_id])
            kw = dict(default_tz=settings.CHECKIN_DEFAULT_TZ, end_hour=settings.CHECKIN_END_HOUR, max_per_day=settings.CHECKIN_MAX_PER_DAY)
            decision = policy.decide_followup(now, prefs, sig, **kw)
            if decision.send:
                midnight = local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
                await _mongo_signals(mongo, user_id, midnight, now, sig)
                decision = policy.decide_followup(now, prefs, sig, **kw)
                if decision.send and sig.active_today:
                    decision = policy.Decision(False, "active_today", policy.INTENSIVE, local.date())
            if not decision.send:
                report.skipped[decision.reason] += 1
                continue

            mental = event.get("domain") == "mental_health"
            template = content.FOLLOWUP_MENTAL if mental else content.FOLLOWUP_URGENT
            chips = content.FOLLOWUP_MENTAL_CHIPS if mental else content.FOLLOWUP_CHIPS
            stage = stage_context(user)
            category = content.category_of(stage.kind, stage.week)
            if dry_run:
                report.would_send.append({"user_id": user_id, "category": category, "level": decision.level, "template": template.key})
                continue
            log_id = await _claim(db, user_id=user_id, dedupe_key=f"followup:{event['id']}", kind="followup", local_date=decision.local_date,
                                  category=category, care_level=decision.level, template_key=template.key)
            if log_id is None:
                report.duplicates += 1
                continue
            ok = await _deliver(db, mongo, user, log_id, template=template, chips=chips, category=category, level=decision.level,
                                kind="followup", stage_week=stage.week)
            report.sent += int(ok)
            report.failed += int(not ok)
    return report


# ── what she did with it ─────────────────────────────────────────────────────────────────────────────

async def record_opened(db, user_id: str, checkin_id: int) -> bool:
    res = await db.execute(update(CheckinLog).where(CheckinLog.id == checkin_id, CheckinLog.user_id == user_id, CheckinLog.opened_at.is_(None))
                           .values(opened_at=datetime.now(timezone.utc)))
    await db.commit()
    return res.rowcount > 0


async def record_response(session_factory, session_id: str, user_id: str, text: str, urgency: Optional[str]) -> Optional[str]:
    """Called when she replies inside a check-in conversation. Only the first reply counts."""
    chip = content.chip_for_message(text)
    key = "concerning" if urgency in ("urgent", "emergency") else (chip.key if chip else "other")
    async with session_factory() as db:
        now = datetime.now(timezone.utc)
        res = await db.execute(update(CheckinLog).where(CheckinLog.session_id == session_id, CheckinLog.user_id == user_id, CheckinLog.responded_at.is_(None))
                               .values(responded_at=now, response_key=key, opened_at=now))
        await db.commit()
        return key if res.rowcount else None
