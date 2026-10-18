"""Care plan logic: stage lookup, daily checklist, weekly report, hospital bag."""
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.care import content
from app.modules.care.models import CareTaskLog, HospitalBagCheck
from app.modules.users.models import User


def stage_of(user: User, now: Optional[datetime] = None) -> Tuple[str, int]:
    """('pregnancy' | 'postpartum' | 'general', current week). Weeks come from the start date when we have it.
    'general' covers women who are not pregnant or postpartum (including trying to conceive); week is 0."""
    now = now or datetime.now(timezone.utc)
    status = user.status.value if user.status else None
    if status in ('general', 'ttc'):
        return 'general', 0
    kind = 'postpartum' if status == 'newMom' else 'pregnancy'
    if user.pregnancy_start_date:
        start = user.pregnancy_start_date
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        return kind, max(int((now - start).days // 7), 0)
    raw = user.baby_age if kind == 'postpartum' else user.pregnancy_week
    digits = ''.join(ch for ch in str(raw or '') if ch.isdigit())
    return kind, int(digits) if digits else 0


def resolve_day(day: Optional[date], now: Optional[datetime] = None) -> date:
    """The app sends the device's local date (so "today" matches the mother's midnight). Anything more than a
    day away from UTC today is clamped, which covers every timezone but stops back-filling history."""
    today = (now or datetime.now(timezone.utc)).date()
    if day is None:
        return today
    return min(max(day, today - timedelta(days=1)), today + timedelta(days=1))


def _insert(db: AsyncSession):
    return pg_insert if db.get_bind().dialect.name == 'postgresql' else sqlite_insert


# ── daily checklist ──────────────────────────────────────────────────────────

async def done_keys(db: AsyncSession, user_id: str, day: date) -> set:
    return set((await db.execute(
        select(CareTaskLog.task_key).where(CareTaskLog.user_id == user_id, CareTaskLog.day == day)
    )).scalars().all())


async def today_plan(db: AsyncSession, user: User, day: date) -> dict:
    kind, week = stage_of(user)
    tasks = content.tasks_for(kind, week)
    done = await done_keys(db, user.id, day)
    items = [{**{k: t[k] for k in ('key', 'title', 'subtitle', 'category')}, 'done': t['key'] in done} for t in tasks]
    categories: Dict[str, dict] = {}
    for it in items:
        c = categories.setdefault(it['category'], {'done': 0, 'total': 0})
        c['total'] += 1
        c['done'] += int(it['done'])
    return {
        'day': day.isoformat(), 'stage': kind, 'week': week,
        'done': sum(1 for i in items if i['done']), 'total': len(items),
        'categories': categories, 'tasks': items,
    }


async def set_task(db: AsyncSession, user: User, task_key: str, day: date, done: bool) -> bool:
    """Idempotent tick / un-tick. Returns False when the task isn't part of this mother's plan."""
    kind, week = stage_of(user)
    if task_key not in {t['key'] for t in content.tasks_for(kind, week)}:
        return False
    if done:
        await db.execute(_insert(db)(CareTaskLog).values(user_id=user.id, task_key=task_key, day=day)
                         .on_conflict_do_nothing(index_elements=['user_id', 'task_key', 'day']))
    else:
        await db.execute(delete(CareTaskLog).where(
            CareTaskLog.user_id == user.id, CareTaskLog.task_key == task_key, CareTaskLog.day == day))
    await db.commit()
    return True


# ── weekly report ────────────────────────────────────────────────────────────

TRACKED = [('hydration', 'Daily hydration tracking'), ('prenatal_vitamin', 'Prenatal vitamin taken'),
           ('postnatal_vitamin', 'Postnatal vitamin taken'), ('gentle_movement', 'Gentle movement (walking)'),
           ('gentle_walk', 'Gentle walk'), ('kick_count', 'Kick count logged')]


async def weekly_report(db: AsyncSession, user: User, end: date) -> dict:
    kind, week = stage_of(user)
    catalog = content.tasks_for(kind, week)
    keys = {t['key']: t for t in catalog}
    start = end - timedelta(days=6)
    rows = (await db.execute(
        select(CareTaskLog.task_key, func.count(CareTaskLog.id))
        .where(CareTaskLog.user_id == user.id, CareTaskLog.day >= start, CareTaskLog.day <= end)
        .group_by(CareTaskLog.task_key)
    )).all()
    days_done = {k: n for k, n in rows if k in keys}

    activities = [{'key': k, 'title': title, 'days_done': days_done.get(k, 0), 'of': 7}
                  for k, title in TRACKED if k in keys]
    # Recommended daily but not once this week.
    missed = [{'key': k, 'title': t['title'], 'note': 'Recommended daily'}
              for k, t in keys.items() if days_done.get(k, 0) == 0][:3]

    total_possible = len(catalog) * 7
    total_done = sum(days_done.values())
    pct = round(100 * total_done / total_possible) if total_possible else 0

    observations: List[str] = []
    if total_done == 0:
        observations.append("Tick off your daily care tasks and your weekly report will fill in here.")
    else:
        observations.append(f"You completed {total_done} care tasks this week - about {pct}% of your plan.")
        h = days_done.get('hydration', 0)
        if 'hydration' in keys:
            observations.append(
                f"You logged hydration on {h} of 7 days - great consistency." if h >= 5
                else f"Hydration was logged on {h} of 7 days. A water bottle within reach can help.")
        rest = days_done.get('rest_break', 0)
        if 'rest_break' in keys and rest < 3:
            observations.append("Rest breaks were few this week. Even 20 minutes lying down can help.")
        move = days_done.get('gentle_movement', 0) + days_done.get('gentle_walk', 0)
        if move >= 4:
            observations.append(f"You moved gently on {move} days - keep listening to your body.")

    headline = ("Here is your week at a glance." if kind == 'general'
                else f"You're in week {week} of pregnancy." if kind == 'pregnancy'
                else f"You're {week} {'week' if week == 1 else 'weeks'} postpartum.")
    return {'start': start.isoformat(), 'end': end.isoformat(), 'stage': kind, 'week': week, 'headline': headline,
            'completion_pct': pct, 'observations': observations[:4], 'activities': activities, 'missed': missed}


async def recent_activity(db: AsyncSession, user_id: str, limit: int = 3) -> List[dict]:
    rows = (await db.execute(
        select(CareTaskLog.task_key, CareTaskLog.created_at).where(CareTaskLog.user_id == user_id)
        .order_by(CareTaskLog.created_at.desc(), CareTaskLog.id.desc()).limit(limit)
    )).all()
    titles = {t['key']: t['title'] for t in content.PREGNANCY_TASKS + content.POSTPARTUM_TASKS + content.GENERAL_TASKS}
    return [{'key': k, 'title': f"Completed {titles.get(k, k).lower()}", 'at': at.isoformat()} for k, at in rows]


# ── hospital bag ─────────────────────────────────────────────────────────────

async def hospital_bag(db: AsyncSession, user_id: str) -> dict:
    checked = set((await db.execute(select(HospitalBagCheck.item_key).where(HospitalBagCheck.user_id == user_id))).scalars().all())
    groups = [{'id': g['id'], 'title': g['title'],
               'items': [{'key': i['key'], 'title': i['title'], 'checked': i['key'] in checked} for i in g['items']]}
              for g in content.HOSPITAL_BAG]
    total = sum(len(g['items']) for g in groups)
    return {'groups': groups, 'done': len(checked & content.BAG_KEYS), 'total': total}


async def set_bag_item(db: AsyncSession, user_id: str, item_key: str, checked: bool) -> bool:
    if item_key not in content.BAG_KEYS:
        return False
    if checked:
        await db.execute(_insert(db)(HospitalBagCheck).values(user_id=user_id, item_key=item_key)
                         .on_conflict_do_nothing(index_elements=['user_id', 'item_key']))
    else:
        await db.execute(delete(HospitalBagCheck).where(
            HospitalBagCheck.user_id == user_id, HospitalBagCheck.item_key == item_key))
    await db.commit()
    return True
