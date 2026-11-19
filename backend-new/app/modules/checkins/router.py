"""Wellness check-in API. Mounted at /api/v1/checkins."""
from datetime import date, datetime, timedelta, timezone
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.modules.staff.deps import StaffContext, require_permission
from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.mongo_db import get_mongo_db
from app.modules.ai_chat import audit
from app.modules.checkins import facts, service
from app.modules.users.models import User

router = APIRouter()


def _ok(data: dict, message: Optional[str] = None) -> dict:
    return {"success": True, "message": message, "data": data}


class PreferencesIn(BaseModel):
    enabled: Optional[bool] = None
    timezone: Optional[str] = Field(None, max_length=64)
    preferred_hour: Optional[int] = Field(None, ge=0, le=23)
    remember: Optional[bool] = None
    pause_days: Optional[int] = Field(None, ge=0, le=90, description="Pause check-ins for N days; 0 resumes now")


def _prefs_out(p) -> dict:
    return {"enabled": p.enabled, "timezone": p.timezone, "preferred_hour": p.preferred_hour,
            "remember": p.remember, "quiet_from_hour": settings.CHECKIN_END_HOUR,
            "paused_until": p.paused_until.isoformat() if p.paused_until else None}


async def _local_today(db, user_id: str) -> date:
    prefs = await service.get_preferences(db, user_id)
    return service.policy.local_now(datetime.now(timezone.utc), service.policy.safe_zone(prefs.timezone, settings.CHECKIN_DEFAULT_TZ)).date()


@router.get("/preferences")
async def get_preferences(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return _ok(_prefs_out(await service.get_preferences(db, current_user.id)))


@router.put("/preferences")
async def put_preferences(payload: PreferencesIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """The app sends the phone's timezone so "morning" means her morning, and the Wellness Check-ins switch."""
    if payload.timezone is not None:
        try:
            ZoneInfo(payload.timezone)
        except Exception:
            raise HTTPException(status_code=400, detail="Unknown timezone")
    if payload.preferred_hour is not None and payload.preferred_hour >= settings.CHECKIN_END_HOUR:
        raise HTTPException(status_code=400, detail="That's inside quiet hours")
    pause_until, resume = None, False
    if payload.pause_days is not None:
        if payload.pause_days == 0:
            resume = True
        else:
            pause_until = await _local_today(db, current_user.id) + timedelta(days=payload.pause_days - 1)
    prefs = await service.save_preferences(db, current_user.id, payload.enabled, payload.timezone, payload.preferred_hour, payload.remember,
                                           pause_until, resume)
    return _ok(_prefs_out(prefs))


@router.get("/memory")
async def what_loni_remembers(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Everything Loni has noted about her days: tags only, never her words. She can see it, so she can trust it."""
    prefs = await service.get_preferences(db, current_user.id)
    local_today = service.policy.local_now(datetime.now(timezone.utc), service.policy.safe_zone(prefs.timezone, settings.CHECKIN_DEFAULT_TZ)).date()
    notes = await service.memory.recent_notes(db, current_user.id, local_today, days=30)
    return _ok({"remember": prefs.remember, "notes": [
        {"day": n.day.isoformat(), "mood": n.mood, "symptoms": n.symptoms or [], "topics": n.topics or []} for n in notes],
        "facts": [_fact_out(f, local_today) for f in await facts.list_facts(db, current_user.id)]})


@router.delete("/memory")
async def forget(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Erase every note and every remembered fact. Takes effect immediately."""
    removed = await service.memory.forget_everything(db, current_user.id)
    removed += await facts.forget_all(db, current_user.id)
    await audit.record("memory.forget_all", actor=current_user.id, subject=current_user.id, removed=removed)
    return _ok({"removed": removed}, "Loni has forgotten what you shared")


# ── structured memory: she can see, add, correct, resolve and delete each item ──────────────────────

def _fact_out(f, today: date) -> dict:
    return {"id": f.id, "kind": f.kind, "key": f.key, "label": facts.label(f), "detail": f.detail,
            "event_date": f.event_date.isoformat() if f.event_date else None, "provenance": f.provenance,
            "status": f.status, "stale": facts.is_stale(f, today), "first_noted": f.first_noted.isoformat(),
            "last_noted": f.last_noted.isoformat(), "source": f.source}


class FactIn(BaseModel):
    kind: Literal["symptom", "concern", "medication", "allergy", "appointment", "condition"]
    key: str = Field(..., min_length=2, max_length=60)
    detail: Optional[str] = Field(None, max_length=80)
    event_date: Optional[date] = None


class FactEdit(BaseModel):
    key: Optional[str] = Field(None, min_length=2, max_length=60)
    detail: Optional[str] = Field(None, max_length=80)
    event_date: Optional[date] = None
    status: Optional[Literal["active", "resolved"]] = None


@router.post("/memory/facts")
async def add_fact(payload: FactIn, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """She tells Loni something directly (e.g. an allergy). Recorded as her own report."""
    today = await _local_today(db, current_user.id)
    try:
        f = await facts.add_fact(db, current_user.id, payload.kind, payload.key, today, payload.detail, payload.event_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await audit.record("memory.add", actor=current_user.id, subject=current_user.id, fact_id=f.id, kind=f.kind)
    return _ok(_fact_out(f, today))


@router.patch("/memory/facts/{fact_id}")
async def correct_fact(fact_id: int, payload: FactEdit, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Correct what Loni noted, or mark it resolved ('my headache is gone')."""
    today = await _local_today(db, current_user.id)
    try:
        f = await facts.correct_fact(db, current_user.id, fact_id, today, key=payload.key, detail=payload.detail,
                                     event_date=payload.event_date, status=payload.status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if f is None:
        raise HTTPException(status_code=404, detail="Not found")
    await audit.record("memory.correct", actor=current_user.id, subject=current_user.id, fact_id=f.id)
    return _ok(_fact_out(f, today))


@router.delete("/memory/facts/{fact_id}")
async def delete_fact(fact_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not await facts.delete_fact(db, current_user.id, fact_id):
        raise HTTPException(status_code=404, detail="Not found")
    await audit.record("memory.delete", actor=current_user.id, subject=current_user.id, fact_id=fact_id)
    return _ok({"id": fact_id}, "Loni has forgotten that")


@router.post("/{checkin_id}/opened")
async def opened(checkin_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """She tapped the notification. Counts as engagement, so she is not treated as ignoring it."""
    await service.record_opened(db, current_user.id, checkin_id)
    return _ok({"checkin_id": checkin_id})


# ── admin: see who would be messaged, or run a pass by hand ─────────────────────────────────────────

@router.get("/admin/preview")
async def preview(admin: StaffContext = Depends(require_permission("checkins.manage"))):
    """Dry run of the next pass: who is due, and how many were held back by which guard. Sends nothing."""
    mongo = get_mongo_db()
    daily = await service.run_cycle(AsyncSessionLocal, mongo, dry_run=True)
    follow = await service.run_followups(AsyncSessionLocal, mongo, dry_run=True)
    return _ok({"enabled": settings.CHECKINS_ENABLED, "daily": daily.as_dict(), "followups": follow.as_dict()})


@router.post("/admin/run")
async def run_now(confirm: bool = False, limit: Optional[int] = None, admin: StaffContext = Depends(require_permission("checkins.manage"))):
    """Send one real pass now (for external cron or a manual kick). `confirm=true` is required."""
    if not confirm:
        raise HTTPException(status_code=400, detail="Pass confirm=true to send real messages (use /admin/preview first)")
    mongo = get_mongo_db()
    daily = await service.run_cycle(AsyncSessionLocal, mongo, limit=limit)
    follow = await service.run_followups(AsyncSessionLocal, mongo)
    return _ok({"daily": daily.as_dict(), "followups": follow.as_dict()})
