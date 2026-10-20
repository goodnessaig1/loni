"""LoniPlus subscription API. Mounted at /api/v1/subscriptions."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.modules.subscriptions import service
from app.modules.subscriptions.schemas import CancelIn, StartTrialIn
from app.modules.users.models import User

router = APIRouter()


def _ok(data: dict, message: Optional[str] = None) -> dict:
    return {"success": True, "message": message, "data": data}


@router.get("/plans")
async def plans(current_user: User = Depends(get_current_user)):
    return _ok(service.plans_out().model_dump())


@router.get("/me")
async def my_subscription(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sub = await service.get_subscription(db, current_user.id)
    return _ok(service.to_out(sub).model_dump(mode="json"))


@router.post("/trial", status_code=201)
async def start_trial(payload: StartTrialIn, current_user: User = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    """Start the free trial. One per person; no card is taken here."""
    try:
        sub = await service.start_trial(db, current_user.id, payload.plan)
    except service.TrialAlreadyUsed:
        raise HTTPException(status_code=409, detail="You've already used your free trial")
    return _ok(service.to_out(sub).model_dump(mode="json"), "Your free trial has started")


@router.post("/cancel")
async def cancel(payload: CancelIn, current_user: User = Depends(get_current_user),
                 db: AsyncSession = Depends(get_db)):
    sub = await service.get_subscription(db, current_user.id)
    if not sub or not service.to_out(sub).has_access:
        raise HTTPException(status_code=404, detail="You don't have an active subscription")
    if sub.status == 'cancelled':
        return _ok(service.to_out(sub).model_dump(mode="json"), "Already cancelled")
    sub = await service.cancel(db, sub, payload.reason, payload.note)
    return _ok(service.to_out(sub).model_dump(mode="json"), "Subscription cancelled")


@router.post("/resume")
async def resume(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    sub = await service.get_subscription(db, current_user.id)
    if not sub or sub.status != 'cancelled' or not service.to_out(sub).has_access:
        raise HTTPException(status_code=409, detail="There's nothing to resume")
    sub = await service.resume(db, sub)
    return _ok(service.to_out(sub).model_dump(mode="json"), "Subscription resumed")
