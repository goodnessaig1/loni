"""GET /admin/overview: the numbers on the admin portal's home screen, for the last N days vs the N days before."""
from datetime import date, datetime, time, timedelta, timezone
from typing import Dict, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.account.models import SupportMessage
from app.modules.calls.models import Call, CallStatusEnum
from app.modules.rides.models import ACTIVE_STATUSES, Ride, RideStatusEnum
from app.modules.staff.deps import StaffContext, require_permission
from app.modules.users.models import AccountStatusEnum, User, UserTypeEnum

router = APIRouter()


def _change(current: int, previous: int):
    if previous == 0:
        return None if current == 0 else 100.0
    return round((current - previous) / previous * 100, 1)


async def _count(db: AsyncSession, model, *where) -> int:
    return (await db.execute(select(func.count()).select_from(model).where(*where))).scalar_one()


async def _per_day(db: AsyncSession, column, start: datetime, *where) -> Dict[str, int]:
    day = func.date(column)
    rows = (await db.execute(select(day, func.count()).where(column >= start, *where).group_by(day))).all()
    return {str(d): n for d, n in rows}


def _window(start: datetime, end: datetime, column):
    return and_(column >= start, column < end)


@router.get("/overview")
async def overview(days: int = Query(7, ge=1, le=90), db: AsyncSession = Depends(get_db),
                   staff: StaffContext = Depends(require_permission("dashboard.view"))):
    today = datetime.now(timezone.utc).date()
    start = datetime.combine(today - timedelta(days=days - 1), time.min, tzinfo=timezone.utc)
    end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)
    prev = start - timedelta(days=days)
    mothers = User.user_type == UserTypeEnum.user
    nurse_call_done = and_(Call.kind == 'nurse', Call.status == CallStatusEnum.ENDED, Call.answered_at.isnot(None))
    completed = Ride.status == RideStatusEnum.COMPLETED

    users_now = await _count(db, User, mothers, _window(start, end, User.created_at))
    users_before = await _count(db, User, mothers, _window(prev, start, User.created_at))
    calls_now = await _count(db, Call, nurse_call_done, _window(start, end, Call.created_at))
    calls_before = await _count(db, Call, nurse_call_done, _window(prev, start, Call.created_at))
    rides_now = await _count(db, Ride, _window(start, end, Ride.requested_at))
    rides_before = await _count(db, Ride, _window(prev, start, Ride.requested_at))
    done_now = await _count(db, Ride, completed, _window(start, end, Ride.requested_at))
    done_before = await _count(db, Ride, completed, _window(prev, start, Ride.requested_at))

    async def people(kind: UserTypeEnum, status: AccountStatusEnum) -> int:
        return await _count(db, User, User.user_type == kind, User.account_status == status)

    nurses_new = await _count(db, User, User.user_type == UserTypeEnum.nurse, _window(start, end, User.created_at))
    nurses_new_before = await _count(db, User, User.user_type == UserTypeEnum.nurse, _window(prev, start, User.created_at))
    drivers_new = await _count(db, User, User.user_type == UserTypeEnum.driver, _window(start, end, User.created_at))
    drivers_new_before = await _count(db, User, User.user_type == UserTypeEnum.driver, _window(prev, start, User.created_at))

    # Daily series for the charts.
    registrations = await _per_day(db, User.created_at, start, mothers)
    calls_daily = await _per_day(db, Call.created_at, start, nurse_call_done)
    rides_requested = await _per_day(db, Ride.requested_at, start)
    rides_completed = await _per_day(db, Ride.requested_at, start, completed)
    rides_cancelled = await _per_day(db, Ride.requested_at, start, Ride.status == RideStatusEnum.CANCELLED)
    series: List[dict] = []
    for i in range(days):
        d: date = start.date() + timedelta(days=i)
        k = d.isoformat()
        series.append({
            "date": k, "registrations": registrations.get(k, 0), "nurse_calls": calls_daily.get(k, 0),
            "rides_requested": rides_requested.get(k, 0), "rides_completed": rides_completed.get(k, 0),
            "rides_cancelled": rides_cancelled.get(k, 0),
        })

    active_rides = await _count(db, Ride, Ride.status.in_(ACTIVE_STATUSES + (RideStatusEnum.SEARCHING,)))
    open_support = await _count(db, SupportMessage, SupportMessage.status == 'open')

    return {"success": True, "data": {
        "days": days,
        "range": {"from": start.date().isoformat(), "to": today.isoformat()},
        "cards": {
            "total_users": {"value": await _count(db, User, mothers), "change": _change(users_now, users_before)},
            "approved_nurses": {"value": await people(UserTypeEnum.nurse, AccountStatusEnum.active),
                                "pending": await people(UserTypeEnum.nurse, AccountStatusEnum.pending),
                                "change": _change(nurses_new, nurses_new_before)},
            "nurse_calls_completed": {"value": calls_now, "change": _change(calls_now, calls_before)},
            "ride_requests": {"value": rides_now, "change": _change(rides_now, rides_before)},
            "approved_drivers": {"value": await people(UserTypeEnum.driver, AccountStatusEnum.active),
                                 "pending": await people(UserTypeEnum.driver, AccountStatusEnum.pending),
                                 "change": _change(drivers_new, drivers_new_before)},
            "completed_rides": {"value": done_now, "change": _change(done_now, done_before),
                                "completion_rate": round(done_now / rides_now * 100, 1) if rides_now else None},
        },
        "attention": {
            "pending_nurses": await people(UserTypeEnum.nurse, AccountStatusEnum.pending),
            "pending_drivers": await people(UserTypeEnum.driver, AccountStatusEnum.pending),
            "active_rides": active_rides,
            "open_support": open_support,
        },
        "series": series,
    }}
