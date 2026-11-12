"""Wellness check-in API. Mounted at /api/v1/checkins."""
from datetime import datetime, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.modules.staff.deps import StaffContext, require_permission
from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.mongo_db import get_mongo_db
from app.modules.checkins import service
from app.modules.users.models import User

router = APIRouter()


def _ok(data: dict, message: Optional[str] = None) -> dict:
    return {"success": True, "message": message, "data": data}


class PreferencesIn(BaseModel):
    enabled: Optional[bool] = None
    timezone: Optional[str] = Field(None, max_length=64)
    preferred_hour: Optional[int] = Field(None, ge=0, le=23)
    remember: Optional[bool] = None


def _prefs_out(p) -> dict:
    return {"enabled": p.enabled, "timezone": p.timezone, "preferred_hour": p.preferred_hour,
            "remember": p.remember, "quiet_from_hour": settings.CHECKIN_END_HOUR}


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
    prefs = await service.save_preferences(db, current_user.id, payload.enabled, payload.timezone, payload.preferred_hour, payload.remember)
    return _ok(_prefs_out(prefs))


@router.get("/memory")
async def what_loni_remembers(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Everything Loni has noted about her days: tags only, never her words. She can see it, so she can trust it."""
    prefs = await service.get_preferences(db, current_user.id)
    local_today = service.policy.local_now(datetime.now(timezone.utc), service.policy.safe_zone(prefs.timezone, settings.CHECKIN_DEFAULT_TZ)).date()
    notes = await service.memory.recent_notes(db, current_user.id, local_today, days=30)
    return _ok({"remember": prefs.remember, "notes": [
        {"day": n.day.isoformat(), "mood": n.mood, "symptoms": n.symptoms or [], "topics": n.topics or []} for n in notes]})


@router.delete("/memory")
async def forget(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Erase every note. Takes effect immediately."""
    removed = await service.memory.forget_everything(db, current_user.id)
    return _ok({"removed": removed}, "Loni has forgotten what you shared")


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
