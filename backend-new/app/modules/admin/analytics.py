"""
/admin/analytics, /admin/subscriptions/summary, /admin/reports/{kind}: the portal's numbers and CSV reports.

"Active users" = people who did something we record in the period: made or answered a call, requested a
ride, posted, commented or liked in the community, or wrote to support. (The apps don't send a heartbeat.)
LONI has no payment provider yet, so revenue is an estimate from plan prices, and is labelled that way.
"""
from datetime import date, datetime, time, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, case, func, literal, or_, select, union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.database import get_db
from app.modules.account.models import SupportMessage
from app.modules.admin.common import csv_response, ok, require, short_ref
from app.modules.admin.models import AccountReview, RidePayout
from app.modules.calls.models import Call, CallStatusEnum
from app.modules.community.models import CommunityComment, CommunityLike, CommunityPost
from app.modules.rides.models import Ride, RideStatusEnum
from app.modules.staff.deps import ClientInfo, StaffContext, client_info, get_current_staff
from app.modules.staff.models import Staff
from app.modules.staff.service import audit
from app.modules.subscriptions.models import Subscription
from app.modules.subscriptions.service import PLANS
from app.modules.users.models import DriverProfile, StatusEnum, User, UserTypeEnum

router = APIRouter()


def _window(days: int):
    today = datetime.now(timezone.utc).date()
    start = datetime.combine(today - timedelta(days=days - 1), time.min, tzinfo=timezone.utc)
    end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)
    return start, end, start - timedelta(days=days)


def _pct_change(now: float, before: float) -> Optional[float]:
    if not before:
        return None if not now else 100.0
    return round((now - before) / before * 100, 1)


def _activity(start: datetime, end: datetime):
    """user_id, day for every recorded action in [start, end)."""
    parts = [
        select(Call.caller_id.label("uid"), Call.created_at.label("at")).where(Call.created_at >= start, Call.created_at < end),
        select(Ride.rider_id, Ride.requested_at).where(Ride.requested_at >= start, Ride.requested_at < end),
        select(CommunityPost.author_id, CommunityPost.created_at).where(CommunityPost.created_at >= start, CommunityPost.created_at < end),
        select(CommunityComment.author_id, CommunityComment.created_at).where(CommunityComment.created_at >= start, CommunityComment.created_at < end),
        select(CommunityLike.user_id, CommunityLike.created_at).where(CommunityLike.created_at >= start, CommunityLike.created_at < end),
        select(SupportMessage.user_id, SupportMessage.created_at).where(SupportMessage.created_at >= start, SupportMessage.created_at < end,
                                                                       SupportMessage.user_id.isnot(None)),
    ]
    return union(*parts).subquery()


async def _active_users(db: AsyncSession, start: datetime, end: datetime) -> int:
    act = _activity(start, end)
    return (await db.execute(select(func.count(func.distinct(act.c.uid))))).scalar_one()


async def _scalar(db: AsyncSession, query):
    return (await db.execute(query)).scalar_one()


def _days(start: datetime, n: int) -> List[str]:
    return [(start.date() + timedelta(days=i)).isoformat() for i in range(n)]


@router.get("/analytics")
async def analytics(days: int = Query(7, ge=1, le=90), staff: StaffContext = Depends(get_current_staff),
                    db: AsyncSession = Depends(get_db)):
    require(staff, "analytics.view")
    start, end, prev = _window(days)

    active_now = await _active_users(db, start, end)
    active_before = await _active_users(db, prev, start)

    async def ride_stats(a, b):
        rows = dict((await db.execute(select(Ride.status, func.count()).where(Ride.requested_at >= a, Ride.requested_at < b)
                                      .group_by(Ride.status))).all())
        total = sum(rows.values())
        done = rows.get(RideStatusEnum.COMPLETED, 0)
        return rows, total, done

    rides_now, total_now, done_now = await ride_stats(start, end)
    _, total_before, done_before = await ride_stats(prev, start)
    rate_now = round(done_now / total_now * 100, 1) if total_now else None
    rate_before = round(done_before / total_before * 100, 1) if total_before else None

    async def dispatch(a, b):
        rows = (await db.execute(select(Ride.requested_at, Ride.assigned_at).where(
            Ride.requested_at >= a, Ride.requested_at < b, Ride.assigned_at.isnot(None)))).all()
        secs = [(x2 - x1).total_seconds() for x1, x2 in rows if x1 and x2 and x2 >= x1]
        return round(sum(secs) / len(secs)) if secs else None

    dispatch_now, dispatch_before = await dispatch(start, end), await dispatch(prev, start)
    done_call = and_(Call.kind == 'nurse', Call.status == CallStatusEnum.ENDED, Call.answered_at.isnot(None))
    calls_now = await _scalar(db, select(func.count()).select_from(Call).where(done_call, Call.created_at >= start, Call.created_at < end))
    calls_before = await _scalar(db, select(func.count()).select_from(Call).where(done_call, Call.created_at >= prev, Call.created_at < start))
    now = datetime.now(timezone.utc)
    premium_now = await _scalar(db, select(func.count()).select_from(Subscription).where(
        Subscription.status.in_(("active", "cancelled")), Subscription.current_period_end > now))
    premium_new = await _scalar(db, select(func.count()).select_from(Subscription).where(Subscription.created_at >= start))
    premium_new_before = await _scalar(db, select(func.count()).select_from(Subscription).where(
        Subscription.created_at >= prev, Subscription.created_at < start))

    # Daily series
    keys = _days(start, days)
    reg = dict((await db.execute(select(func.date(User.created_at), func.count()).where(
        User.created_at >= start, User.user_type == UserTypeEnum.user).group_by(func.date(User.created_at)))).all())
    act = _activity(start, end)
    active_daily = dict((await db.execute(select(func.date(act.c.at), func.count(func.distinct(act.c.uid)))
                                          .group_by(func.date(act.c.at)))).all())
    call_req = dict((await db.execute(select(func.date(Call.created_at), func.count()).where(
        Call.kind == 'nurse', Call.created_at >= start).group_by(func.date(Call.created_at)))).all())
    call_done = dict((await db.execute(select(func.date(Call.created_at), func.count()).where(
        done_call, Call.created_at >= start).group_by(func.date(Call.created_at)))).all())
    series = [{"date": k, "registrations": reg.get(k, 0) or reg.get(date.fromisoformat(k), 0),
               "active_users": active_daily.get(k, 0) or active_daily.get(date.fromisoformat(k), 0),
               "call_requests": call_req.get(k, 0) or call_req.get(date.fromisoformat(k), 0),
               "calls_completed": call_done.get(k, 0) or call_done.get(date.fromisoformat(k), 0)} for k in keys]

    # Driver performance: most completed rides in the period, with completion rate of rides they accepted.
    D = aliased(User)
    perf = (await db.execute(
        select(D.id, D.name, func.count(Ride.id),
               func.sum(case((Ride.status == RideStatusEnum.COMPLETED, 1), else_=0)), DriverProfile.rating_avg)
        .join(Ride, Ride.driver_id == D.id).outerjoin(DriverProfile, DriverProfile.user_id == D.id)
        .where(Ride.requested_at >= start, Ride.requested_at < end)
        .group_by(D.id, D.name, DriverProfile.rating_avg)
        .order_by(func.sum(case((Ride.status == RideStatusEnum.COMPLETED, 1), else_=0)).desc()).limit(4))).all()
    drivers = [{"id": i, "ref": short_ref("DRV", i), "name": n, "rides": int(done or 0),
                "completion": round((done or 0) / taken * 100) if taken else 0,
                "rating": round(r, 1) if r else None} for i, n, taken, done, r in perf]

    stages = dict((await db.execute(select(User.status, func.count()).where(User.user_type == UserTypeEnum.user)
                                    .group_by(User.status))).all())
    audience = [{"label": label, "value": stages.get(key, 0)} for key, label in (
        (StatusEnum.pregnant, "Pregnant"), (StatusEnum.newMom, "Postpartum"), (StatusEnum.ttc, "Trying to conceive"),
        (StatusEnum.general, "Women's health"), (None, "Stage not set"))]

    return ok({
        "days": days,
        "cards": {
            "active_users": {"value": active_now, "change": _pct_change(active_now, active_before)},
            "ride_completion": {"value": rate_now, "change": round(rate_now - rate_before, 1) if rate_now is not None and rate_before is not None else None},
            "dispatch_seconds": {"value": dispatch_now, "change": (dispatch_now - dispatch_before) if dispatch_now and dispatch_before else None},
            "completed_calls": {"value": calls_now, "change": _pct_change(calls_now, calls_before)},
            "premium_subscribers": {"value": premium_now, "change": _pct_change(premium_new, premium_new_before)},
        },
        "series": series,
        "ride_outcomes": {"total": total_now, "completed": done_now,
                          "cancelled": rides_now.get(RideStatusEnum.CANCELLED, 0),
                          "unfulfilled": rides_now.get(RideStatusEnum.NO_DRIVERS, 0) + rides_now.get(RideStatusEnum.FAILED, 0)},
        "drivers": drivers,
        "audience": audience,
        "audience_total": sum(a["value"] for a in audience),
    })


# ── subscriptions & revenue ─────────────────────────────────────────────────────────────────

def _monthly_value(plan: str) -> int:
    return PLANS[plan].price if plan in PLANS else 0


@router.get("/subscriptions/summary")
async def subscriptions_summary(days: int = Query(30, ge=1, le=365), staff: StaffContext = Depends(get_current_staff),
                                db: AsyncSession = Depends(get_db)):
    require(staff, "analytics.view")
    start, end, _ = _window(days)
    now = datetime.now(timezone.utc)
    has_access = Subscription.current_period_end > now
    premium = await _scalar(db, select(func.count()).select_from(Subscription).where(
        Subscription.status.in_(("active", "cancelled")), has_access))
    trials = await _scalar(db, select(func.count()).select_from(Subscription).where(Subscription.status == "trialing", has_access))
    mothers = await _scalar(db, select(func.count()).select_from(User).where(User.user_type == UserTypeEnum.user))
    free = max(0, mothers - premium - trials)
    trials_ended = await _scalar(db, select(func.count()).select_from(Subscription).where(
        Subscription.trial_ends_at.isnot(None), Subscription.trial_ends_at >= start, Subscription.trial_ends_at < now))
    converted = await _scalar(db, select(func.count()).select_from(Subscription).where(
        Subscription.trial_ends_at.isnot(None), Subscription.trial_ends_at >= start, Subscription.trial_ends_at < now,
        Subscription.status.in_(("active", "cancelled"))))
    paying = (await db.execute(select(Subscription.plan, func.count()).where(
        Subscription.status.in_(("active", "cancelled")), has_access).group_by(Subscription.plan))).all()
    mrr = sum(_monthly_value(plan) * n for plan, n in paying)

    # New paid months per day (a conversion from trial counts on the day the trial ended).
    started = (await db.execute(select(Subscription.plan, func.coalesce(Subscription.trial_ends_at, Subscription.created_at))
                                .where(Subscription.status.in_(("active", "cancelled")),
                                       func.coalesce(Subscription.trial_ends_at, Subscription.created_at) >= start))).all()
    per_day: Dict[str, int] = {}
    for plan, at in started:
        if at is None:
            continue
        key = (at if at.tzinfo else at.replace(tzinfo=timezone.utc)).date().isoformat()
        per_day[key] = per_day.get(key, 0) + _monthly_value(plan)
    series = [{"date": k, "revenue": per_day.get(k, 0)} for k in _days(start, days)]
    return ok({
        "days": days,
        "cards": {"premium": premium, "free": free, "trials": trials,
                  "trial_conversion": round(converted / trials_ended * 100, 1) if trials_ended else None,
                  "revenue_estimate": mrr},
        "plans": [{"plan": p, "label": PLANS[p].label if p in PLANS else p, "count": n} for p, n in paying],
        "distribution": {"premium": premium, "trial": trials, "free": free},
        "series": series,
        "can_export": staff.can("reports.export"),
    })


# ── downloadable reports ────────────────────────────────────────────────────────────────────

REPORTS = {
    "user_activity": ("users.view", "User activity report"),
    "ride_operations": ("rides.view", "Ride operations report"),
    "driver_performance": ("drivers.view", "Driver performance report"),
    "payout_reconciliation": ("payments.view", "Payout reconciliation"),
    "kyc_decisions": ("kyc.review", "KYC decisions"),
    "subscription_revenue": ("analytics.view", "Subscription revenue"),
    "nurse_calls": ("calls.view", "Nurse calls"),
}


@router.get("/reports")
async def list_reports(staff: StaffContext = Depends(get_current_staff)):
    require(staff, "reports.export")
    return ok({"reports": [{"key": k, "title": t, "allowed": staff.can(p)} for k, (p, t) in REPORTS.items()]})


@router.get("/reports/{kind}")
async def download_report(kind: str, days: int = Query(30, ge=1, le=365), staff: StaffContext = Depends(get_current_staff),
                          db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    if kind not in REPORTS:
        raise HTTPException(status_code=404, detail="Unknown report")
    require(staff, "reports.export", REPORTS[kind][0])
    start, end, _ = _window(days)

    if kind == "user_activity":
        act = _activity(start, end)
        counts = dict((await db.execute(select(act.c.uid, func.count()).group_by(act.c.uid))).all())
        users = (await db.execute(select(User).where(User.user_type.in_((UserTypeEnum.user, UserTypeEnum.partner)),
                                                     or_(User.created_at >= start, User.id.in_(list(counts) or ["-"])))
                                  .order_by(User.created_at.desc()).limit(20_000))).scalars().all()
        header = ["user", "name", "type", "joined", "actions_in_period", "account_status"]
        rows = [[short_ref("USR", u.id), u.name, "Mother" if u.user_type == UserTypeEnum.user else "Partner",
                 u.created_at, counts.get(u.id, 0), u.account_status.value] for u in users]
    elif kind == "ride_operations":
        M, D = aliased(User), aliased(User)
        data = (await db.execute(select(Ride, M.name, D.name).join(M, M.id == Ride.rider_id).outerjoin(D, D.id == Ride.driver_id)
                                 .where(Ride.requested_at >= start).order_by(Ride.id.desc()).limit(20_000))).all()
        header = ["ride", "mother", "driver", "pickup", "destination", "status", "requested_at", "assigned_at", "completed_at", "fare_ngn", "rating"]
        rows = [[short_ref("RIDE", r.id), m, d, r.pickup_address, r.dropoff_name or r.dropoff_address, r.status.value,
                 r.requested_at, r.assigned_at, r.completed_at, r.fare_final or r.fare_estimate, r.rider_rating] for r, m, d in data]
    elif kind == "driver_performance":
        data = (await db.execute(
            select(User.id, User.name, User.account_status, func.count(Ride.id),
                   func.sum(case((Ride.status == RideStatusEnum.COMPLETED, 1), else_=0)), DriverProfile.rating_avg,
                   DriverProfile.total_earnings)
            .outerjoin(Ride, and_(Ride.driver_id == User.id, Ride.requested_at >= start))
            .outerjoin(DriverProfile, DriverProfile.user_id == User.id)
            .where(User.user_type == UserTypeEnum.driver)
            .group_by(User.id, User.name, User.account_status, DriverProfile.rating_avg, DriverProfile.total_earnings))).all()
        header = ["driver", "name", "status", "rides_assigned", "rides_completed", "completion_pct", "rating", "lifetime_earnings_ngn"]
        rows = [[short_ref("DRV", i), n, s.value, t, int(c or 0), round((c or 0) / t * 100) if t else "", round(r, 1) if r else "", e]
                for i, n, s, t, c, r, e in data]
    elif kind == "payout_reconciliation":
        D = aliased(User)
        data = (await db.execute(select(Ride, D.name, RidePayout).join(D, D.id == Ride.driver_id)
                                 .outerjoin(RidePayout, RidePayout.ride_id == Ride.id)
                                 .where(Ride.status == RideStatusEnum.COMPLETED,
                                        func.coalesce(Ride.completed_at, Ride.requested_at) >= start)
                                 .order_by(Ride.id.desc()).limit(20_000))).all()
        header = ["ride", "driver", "amount_ngn", "completed_at", "payout_status", "reference", "paid_at"]
        rows = [[short_ref("RIDE", r.id), d, (p.amount if p else r.fare_final or r.fare_estimate), r.completed_at,
                 "paid" if p else "pending", p.reference if p else "", p.paid_at if p else ""] for r, d, p in data]
    elif kind == "kyc_decisions":
        U = aliased(User)
        data = (await db.execute(select(AccountReview, U.name, U.user_type, Staff.name)
                                 .join(U, U.id == AccountReview.user_id).outerjoin(Staff, Staff.id == AccountReview.staff_id)
                                 .where(AccountReview.created_at >= start).order_by(AccountReview.id.desc()).limit(20_000))).all()
        header = ["date", "applicant", "type", "decision", "reason", "decided_by"]
        rows = [[r.created_at, n, t.value if t else "", r.action, r.reason, s] for r, n, t, s in data]
    elif kind == "nurse_calls":
        N = aliased(User)
        data = (await db.execute(select(Call, N.name).outerjoin(N, N.id == Call.receiver_id)
                                 .where(Call.kind == 'nurse', Call.created_at >= start).order_by(Call.id.desc()).limit(20_000))).all()
        header = ["call", "nurse", "user", "status", "requested_at", "answered_at", "duration_seconds", "rating"]
        # Mothers appear only as a reference, never by name, and nothing said on the call is stored.
        rows = [[short_ref("CALL", c.id), n or "Unassigned", short_ref("USR", c.caller_id), c.status.value, c.created_at,
                 c.answered_at, c.duration_seconds, c.rating] for c, n in data]
    else:  # subscription_revenue
        data = (await db.execute(select(Subscription).where(Subscription.created_at >= start)
                                 .order_by(Subscription.id.desc()).limit(20_000))).scalars().all()
        header = ["user", "plan", "status", "started", "trial_ends", "period_end", "monthly_value_ngn"]
        rows = [[short_ref("USR", s.user_id), s.plan, s.status, s.created_at, s.trial_ends_at, s.current_period_end,
                 _monthly_value(s.plan) if s.status != "trialing" else 0] for s in data]

    await audit(db, "report.downloaded", staff.id, client, "report", kind, {"days": days, "rows": len(rows)})
    await db.commit()
    return csv_response(kind.replace("_", "-"), header, rows)
