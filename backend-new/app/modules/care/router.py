"""LoniPlus care plan API. Mounted at /api/v1/care. Every route needs an active trial/subscription."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.care import content, service
from app.modules.subscriptions.deps import require_plus
from app.modules.users.models import User

router = APIRouter(dependencies=[Depends(require_plus)])


class DoneIn(BaseModel):
    done: bool


class CheckedIn(BaseModel):
    checked: bool


def _ok(data: dict, message: Optional[str] = None) -> dict:
    return {"success": True, "message": message, "data": data}


@router.get("/overview")
async def overview(day: Optional[date] = None, user: User = Depends(require_plus), db: AsyncSession = Depends(get_db)):
    """Everything the premium home needs in one round trip."""
    d = service.resolve_day(day)
    today = await service.today_plan(db, user, d)
    report = await service.weekly_report(db, user, d)
    bag = await service.hospital_bag(db, user.id)
    return _ok({
        "stage": today["stage"], "week": today["week"],
        "today": {"done": today["done"], "total": today["total"]},
        "report": {"headline": report["headline"], "completion_pct": report["completion_pct"]},
        "bag": {"done": bag["done"], "total": bag["total"]},
        "recent": await service.recent_activity(db, user.id),
    })


@router.get("/today")
async def today(day: Optional[date] = None, user: User = Depends(require_plus), db: AsyncSession = Depends(get_db)):
    return _ok(await service.today_plan(db, user, service.resolve_day(day)))


@router.put("/today/{task_key}")
async def set_task(task_key: str, payload: DoneIn, day: Optional[date] = None,
                   user: User = Depends(require_plus), db: AsyncSession = Depends(get_db)):
    d = service.resolve_day(day)
    if not await service.set_task(db, user, task_key, d, payload.done):
        raise HTTPException(status_code=404, detail="That task isn't in your plan")
    return _ok(await service.today_plan(db, user, d))


@router.get("/nutrition")
async def nutrition(user: User = Depends(require_plus)):
    kind, week = service.stage_of(user)
    return _ok({"stage": kind, "week": week, **content.NUTRITION[kind]})


@router.get("/weekly-report")
async def weekly_report(day: Optional[date] = None, user: User = Depends(require_plus),
                        db: AsyncSession = Depends(get_db)):
    return _ok(await service.weekly_report(db, user, service.resolve_day(day)))


@router.get("/hospital-bag")
async def hospital_bag(user: User = Depends(require_plus), db: AsyncSession = Depends(get_db)):
    return _ok(await service.hospital_bag(db, user.id))


@router.put("/hospital-bag/{item_key}")
async def set_bag_item(item_key: str, payload: CheckedIn, user: User = Depends(require_plus),
                       db: AsyncSession = Depends(get_db)):
    if not await service.set_bag_item(db, user.id, item_key, payload.checked):
        raise HTTPException(status_code=404, detail="Unknown item")
    return _ok(await service.hospital_bag(db, user.id))


@router.get("/labour-prep")
async def labour_prep(user: User = Depends(require_plus)):
    topics = [{k: t[k] for k in ("slug", "title", "summary")} for t in content.LABOUR_TOPICS]
    return _ok({"topics": topics, "disclaimer": content.LABOUR_DISCLAIMER})


@router.get("/labour-prep/{slug}")
async def labour_topic(slug: str, user: User = Depends(require_plus)):
    topic = content.labour_topic(slug)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return _ok({**topic, "disclaimer": content.LABOUR_DISCLAIMER})
