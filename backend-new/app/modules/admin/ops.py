"""
Operations screens of the admin portal:

  /admin/rides           emergency rides, with route, driver and timeline          rides.view
  /admin/calls           nurse calls - never the conversation, only who/when/how long   calls.view
  /admin/payouts         what drivers are owed for completed rides; mark as paid    payments.view / payments.manage
  /admin/support         support messages and incidents; move them along           support.manage
  /admin/kyc             nurse + driver credential submissions in one queue        kyc.review
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select, true
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.core.database import get_db
from app.modules.account.models import SupportMessage
from app.modules.admin.common import csv_response, count, ok, page_of, require, short_ref, since
from app.modules.admin.models import AccountReview, RidePayout
from app.modules.calls.models import Call, CallEvent, CallStatusEnum
from app.modules.rides.models import Ride, RideEvent, RideStatusEnum
from app.modules.staff.deps import ClientInfo, StaffContext, client_info, get_current_staff
from app.modules.staff.models import Staff
from app.modules.staff.service import audit
from app.modules.users.models import AccountStatusEnum, DriverProfile, NurseProfile, User, UserTypeEnum

router = APIRouter()

Mother = aliased(User)
Driver = aliased(User)
Nurse = aliased(User)


# ── emergency rides ─────────────────────────────────────────────────────────────────────────

RIDE_TABS = {
    "all": None,
    "requested": [RideStatusEnum.SEARCHING],
    "accepted": [RideStatusEnum.DRIVER_ASSIGNED],
    "en_route": [RideStatusEnum.DRIVER_EN_ROUTE, RideStatusEnum.DRIVER_ARRIVED],
    "in_transit": [RideStatusEnum.IN_PROGRESS],
    "completed": [RideStatusEnum.COMPLETED],
    "cancelled": [RideStatusEnum.CANCELLED, RideStatusEnum.NO_DRIVERS, RideStatusEnum.FAILED],
}
RIDE_STATE = {
    RideStatusEnum.SEARCHING: "requested", RideStatusEnum.DRIVER_ASSIGNED: "accepted",
    RideStatusEnum.DRIVER_EN_ROUTE: "en_route", RideStatusEnum.DRIVER_ARRIVED: "en_route",
    RideStatusEnum.IN_PROGRESS: "in_transit", RideStatusEnum.COMPLETED: "completed",
    RideStatusEnum.CANCELLED: "cancelled", RideStatusEnum.NO_DRIVERS: "no_drivers", RideStatusEnum.FAILED: "failed",
}


def _place(address: Optional[str], name: Optional[str] = None) -> str:
    if name:
        return name
    return (address or "Unknown").split(",")[0].strip() or "Unknown"


def _ride_row(r: Ride, mother: Optional[str], driver: Optional[str]) -> dict:
    return {
        "id": r.id, "ref": short_ref("RIDE", r.id), "mother": mother, "mother_id": r.rider_id,
        "driver": driver, "driver_id": r.driver_id,
        "route": f"{_place(r.pickup_address)} → {_place(r.dropoff_address, r.dropoff_name)}",
        "status": RIDE_STATE.get(r.status, r.status.value.lower()),
        "requested_at": r.requested_at, "fare": r.fare_final or r.fare_estimate,
    }


def _ride_query(tab: str, q: Optional[str]):
    query = (select(Ride, Mother.name, Driver.name).join(Mother, Mother.id == Ride.rider_id)
             .outerjoin(Driver, Driver.id == Ride.driver_id))
    if RIDE_TABS.get(tab):
        query = query.where(Ride.status.in_(RIDE_TABS[tab]))
    if q:
        like = f"%{q.strip().lower()}%"
        conditions = [func.lower(Mother.name).like(like), func.lower(Driver.name).like(like),
                      func.lower(Ride.dropoff_name).like(like), func.lower(Ride.pickup_address).like(like)]
        digits = q.strip().upper().removeprefix("RIDE-")
        if digits.isdigit():
            conditions.append(Ride.id == int(digits))
        query = query.where(or_(*conditions))
    return query


@router.get("/rides")
async def list_rides(tab: str = Query("all"), q: Optional[str] = Query(None, max_length=100),
                     sort: str = Query("newest", pattern="^(newest|oldest|name_asc|name_desc)$"),
                     page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
                     staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    require(staff, "rides.view")
    if tab not in RIDE_TABS:
        raise HTTPException(status_code=400, detail="Unknown tab")
    order = {"newest": Ride.requested_at.desc(), "oldest": Ride.requested_at.asc(),
             "name_asc": func.lower(Mother.name).asc(), "name_desc": func.lower(Mother.name).desc()}[sort]
    rows, meta = await page_of(db, _ride_query(tab, q).order_by(order, Ride.id.desc()), page, page_size)
    counts = {t: await count(db, _ride_query(t, q)) for t in RIDE_TABS}
    return ok({"items": [_ride_row(r, m, d) for r, m, d in rows], **meta, "counts": counts,
               "can_export": staff.can("reports.export")})


@router.get("/rides/{ride_id}")
async def ride_detail(ride_id: int, staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    require(staff, "rides.view")
    row = (await db.execute(_ride_query("all", None).where(Ride.id == ride_id))).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ride not found")
    r, mother, driver = row
    events = (await db.execute(select(RideEvent.event_type, RideEvent.created_at).where(RideEvent.ride_id == ride_id)
                               .order_by(RideEvent.id))).all()
    payout = await db.get(RidePayout, ride_id)
    data = _ride_row(r, mother, driver)
    data.update({
        "pickup": r.pickup_address, "destination": r.dropoff_name or r.dropoff_address,
        "distance_km": round(r.distance_meters / 1000, 1) if r.distance_meters else None,
        "eta_minutes": round(r.duration_seconds / 60) if r.duration_seconds else None,
        "assigned_at": r.assigned_at, "arrived_at": r.arrived_at, "started_at": r.started_at,
        "completed_at": r.completed_at, "cancelled_at": r.cancelled_at, "cancel_reason": r.cancel_reason,
        "contacts_notified": r.notify_contacts, "rating": r.rider_rating, "feedback": r.rider_feedback,
        "payout": {"status": "paid" if payout else ("pending" if r.status == RideStatusEnum.COMPLETED else None),
                   "reference": payout.reference if payout else None, "paid_at": payout.paid_at if payout else None},
        "timeline": [{"event": e.replace("_", " ").capitalize(), "at": t} for e, t in events],
    })
    return ok(data)


# ── nurse calls ─────────────────────────────────────────────────────────────────────────────

LIVE = [CallStatusEnum.REQUESTED, CallStatusEnum.RINGING, CallStatusEnum.ACCEPTED, CallStatusEnum.CONNECTING,
        CallStatusEnum.CONNECTED, CallStatusEnum.RECONNECTING]
DONE = and_(Call.status == CallStatusEnum.ENDED, Call.answered_at.isnot(None))


def _call_state(c: Call) -> str:
    if c.status in LIVE:
        return "in_progress"
    if c.status == CallStatusEnum.ENDED and c.answered_at is not None:
        return "completed"
    return "failed"


CALL_TABS = {"all": None, "in_progress": Call.status.in_(LIVE), "completed": DONE,
             "failed": and_(Call.status.notin_(LIVE), or_(Call.status != CallStatusEnum.ENDED, Call.answered_at.is_(None)))}


def _call_query(tab: str, q: Optional[str]):
    query = select(Call, Nurse.name).outerjoin(Nurse, Nurse.id == Call.receiver_id).where(Call.kind == 'nurse')
    if CALL_TABS.get(tab) is not None:
        query = query.where(CALL_TABS[tab])
    if q:
        like = f"%{q.strip().lower()}%"
        query = query.where(or_(func.lower(Nurse.name).like(like), Call.caller_id.like(f"%{q.strip()}%")))
    return query


def _call_row(c: Call, nurse: Optional[str]) -> dict:
    # The mother is shown only as a reference: staff reviewing operations don't need her name.
    return {"id": c.id, "ref": short_ref("CALL", c.id), "nurse": nurse or "Unassigned", "nurse_id": c.receiver_id,
            "user_ref": f"Mother · {short_ref('USR', c.caller_id)}", "status": _call_state(c),
            "duration_seconds": c.duration_seconds if _call_state(c) == "completed" else None,
            "requested_at": c.created_at, "rating": c.rating}


@router.get("/calls")
async def list_calls(tab: str = Query("all"), q: Optional[str] = Query(None, max_length=100),
                     sort: str = Query("newest", pattern="^(newest|oldest|name_asc|name_desc)$"),
                     page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
                     staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    require(staff, "calls.view")
    if tab not in CALL_TABS:
        raise HTTPException(status_code=400, detail="Unknown tab")
    order = {"newest": Call.created_at.desc(), "oldest": Call.created_at.asc(),
             "name_asc": func.lower(Nurse.name).asc(), "name_desc": func.lower(Nurse.name).desc()}[sort]
    rows, meta = await page_of(db, _call_query(tab, q).order_by(order, Call.id.desc()), page, page_size)
    counts = {t: await count(db, _call_query(t, q)) for t in CALL_TABS}
    return ok({"items": [_call_row(c, n) for c, n in rows], **meta, "counts": counts,
               "can_export": staff.can("reports.export")})


@router.get("/calls/{call_id}")
async def call_detail(call_id: int, staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    require(staff, "calls.view")
    row = (await db.execute(_call_query("all", None).where(Call.id == call_id))).first()
    if not row:
        raise HTTPException(status_code=404, detail="Call not found")
    c, nurse = row
    events = (await db.execute(select(CallEvent.event_type, CallEvent.created_at).where(CallEvent.call_id == call_id)
                               .order_by(CallEvent.id))).all()
    data = _call_row(c, nurse)
    data.update({"answered_at": c.answered_at, "ended_at": c.ended_at, "raw_status": c.status.value,
                 "feedback": c.feedback, "timeline": [{"event": e, "at": t} for e, t in events]})
    return ok(data)


# ── payouts ─────────────────────────────────────────────────────────────────────────────────

AMOUNT = func.coalesce(Ride.fare_final, Ride.fare_estimate, 0)


def _payout_query(tab: str, q: Optional[str], days: Optional[int]):
    query = (select(Ride, Driver.name, RidePayout).join(Driver, Driver.id == Ride.driver_id)
             .outerjoin(RidePayout, RidePayout.ride_id == Ride.id)
             .where(Ride.status == RideStatusEnum.COMPLETED))
    if days:
        query = query.where(func.coalesce(Ride.completed_at, Ride.requested_at) >= since(days))
    if tab == "pending":
        query = query.where(RidePayout.ride_id.is_(None))
    elif tab == "paid":
        query = query.where(RidePayout.ride_id.isnot(None))
    if q:
        like = f"%{q.strip().lower()}%"
        query = query.where(or_(func.lower(Driver.name).like(like), func.lower(Ride.dropoff_name).like(like)))
    return query


def _payout_row(r: Ride, driver: str, payout: Optional[RidePayout]) -> dict:
    return {"ride_id": r.id, "ref": short_ref("RIDE", r.id), "driver": driver, "driver_id": r.driver_id,
            "ride": f"Dropped at {_place(r.dropoff_address, r.dropoff_name)}",
            "amount": payout.amount if payout else (r.fare_final or r.fare_estimate or 0),
            "date": r.completed_at or r.requested_at, "status": "paid" if payout else "pending",
            "reference": payout.reference if payout else None, "paid_at": payout.paid_at if payout else None}


async def _sum(db: AsyncSession, query) -> int:
    sub = query.subquery()
    return int((await db.execute(select(func.coalesce(func.sum(func.coalesce(sub.c.fare_final, sub.c.fare_estimate, 0)), 0)))).scalar_one())


@router.get("/payouts")
async def list_payouts(tab: str = Query("all", pattern="^(all|pending|paid)$"), q: Optional[str] = Query(None, max_length=100),
                       days: int = Query(30, ge=0, le=365), page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
                       staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    require(staff, "payments.view")
    rows, meta = await page_of(db, _payout_query(tab, q, days).order_by(Ride.completed_at.desc(), Ride.id.desc()), page, page_size)
    base = select(Ride).join(Driver, Driver.id == Ride.driver_id).outerjoin(RidePayout, RidePayout.ride_id == Ride.id) \
        .where(Ride.status == RideStatusEnum.COMPLETED)
    if days:
        base = base.where(func.coalesce(Ride.completed_at, Ride.requested_at) >= since(days))
    summary = {
        "eligible": await _sum(db, base),
        "pending": await _sum(db, base.where(RidePayout.ride_id.is_(None))),
        "paid": await _sum(db, base.where(RidePayout.ride_id.isnot(None))),
    }
    counts = {t: await count(db, _payout_query(t, q, days)) for t in ("all", "pending", "paid")}
    return ok({"items": [_payout_row(*r) for r in rows], **meta, "counts": counts, "summary": summary,
               "can_manage": staff.can("payments.manage"), "can_export": staff.can("reports.export")})


class VerifyIn(BaseModel):
    reference: Optional[str] = Field(None, max_length=120)


@router.post("/payouts/{ride_id}/verify")
async def verify_payout(ride_id: int, data: VerifyIn, staff: StaffContext = Depends(get_current_staff),
                        db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    """Record that the driver has been paid for this ride (the transfer itself happens outside LONI)."""
    require(staff, "payments.manage")
    ride = await db.get(Ride, ride_id)
    if ride is None or ride.status != RideStatusEnum.COMPLETED or not ride.driver_id:
        raise HTTPException(status_code=404, detail="Completed ride not found")
    if await db.get(RidePayout, ride_id):
        raise HTTPException(status_code=409, detail="This payout is already marked as paid.")
    amount = ride.fare_final or ride.fare_estimate or 0
    db.add(RidePayout(ride_id=ride_id, status="paid", amount=amount,
                      reference=(data.reference or "").strip() or None, verified_by=staff.id))
    await audit(db, "payout.verified", staff.id, client, "ride", str(ride_id), {"amount": amount, "reference": data.reference})
    await db.commit()
    return {"success": True, "message": "Payment verified."}


@router.get("/payouts-export")
async def export_payouts(tab: str = Query("all", pattern="^(all|pending|paid)$"), q: Optional[str] = Query(None, max_length=100),
                         days: int = Query(30, ge=0, le=365), staff: StaffContext = Depends(get_current_staff),
                         db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    require(staff, "payments.view", "reports.export")
    rows = (await db.execute(_payout_query(tab, q, days).order_by(Ride.completed_at.desc()).limit(10_000))).all()
    await audit(db, "payouts.exported", staff.id, client, "report", "payouts", {"rows": len(rows), "tab": tab})
    await db.commit()
    items = [_payout_row(*r) for r in rows]
    return csv_response("payouts", ["ride", "driver", "ride_summary", "amount_ngn", "date", "status", "reference", "paid_at"],
                        [[i["ref"], i["driver"], i["ride"], i["amount"], i["date"], i["status"], i["reference"], i["paid_at"]] for i in items])


# ── support & incidents ─────────────────────────────────────────────────────────────────────

SUPPORT_TABS = {"all": None, "open": "open", "in_progress": "in_progress", "resolved": "resolved"}


def _support_query(tab: str, q: Optional[str], category: Optional[str], status: Optional[str], days: Optional[int]):
    query = select(SupportMessage)
    if SUPPORT_TABS.get(tab):
        query = query.where(SupportMessage.status == SUPPORT_TABS[tab])
    if status:
        query = query.where(SupportMessage.status == status)
    if category:
        query = query.where(SupportMessage.subject == category)
    if days:
        query = query.where(SupportMessage.created_at >= since(days))
    if q:
        like = f"%{q.strip().lower()}%"
        conditions = [func.lower(SupportMessage.name).like(like), func.lower(SupportMessage.message).like(like),
                      func.lower(SupportMessage.email).like(like)]
        digits = q.strip().upper().removeprefix("INC-")
        if digits.isdigit():
            conditions.append(SupportMessage.id == int(digits))
        query = query.where(or_(*conditions))
    return query


def _support_row(m: SupportMessage) -> dict:
    return {"id": m.id, "ref": short_ref("INC", m.id), "category": m.subject, "description": m.message[:140],
            "reporter": m.name, "reporter_type": {"user": "Mother"}.get(m.user_type or "", (m.user_type or "user").capitalize()),
            "status": m.status, "created_at": m.created_at}


@router.get("/support")
async def list_support(tab: str = Query("all"), q: Optional[str] = Query(None, max_length=100),
                       category: Optional[str] = Query(None, max_length=120),
                       status: Optional[str] = Query(None, pattern="^(open|in_progress|resolved)$"),
                       days: int = Query(30, ge=0, le=365), page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
                       staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    require(staff, "support.manage")
    if tab not in SUPPORT_TABS:
        raise HTTPException(status_code=400, detail="Unknown tab")
    rows, meta = await page_of(db, _support_query(tab, q, category, status, days).order_by(SupportMessage.id.desc()), page, page_size)
    counts = {t: await count(db, _support_query(t, q, category, status, days)) for t in SUPPORT_TABS}
    from app.modules.account.router import SUBJECTS
    return ok({"items": [_support_row(m) for (m,) in rows], **meta, "counts": counts, "categories": list(SUBJECTS),
               "can_export": staff.can("reports.export")})


@router.get("/support/{message_id}")
async def support_detail(message_id: int, staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    require(staff, "support.manage")
    m = await db.get(SupportMessage, message_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Message not found")
    resolver = await db.get(Staff, m.resolved_by) if m.resolved_by else None
    return ok({**_support_row(m), "message": m.message, "email": m.email, "user_id": m.user_id,
               "updated_at": m.updated_at, "resolved_by": resolver.name if resolver else None})


class SupportStatusIn(BaseModel):
    status: str = Field(..., pattern="^(open|in_progress|resolved)$")


@router.post("/support/{message_id}/status")
async def set_support_status(message_id: int, data: SupportStatusIn, staff: StaffContext = Depends(get_current_staff),
                             db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    require(staff, "support.manage")
    m = await db.get(SupportMessage, message_id)
    if m is None:
        raise HTTPException(status_code=404, detail="Message not found")
    before = m.status
    m.status = data.status
    m.updated_at = datetime.now(timezone.utc)
    m.resolved_by = staff.id if data.status == "resolved" else None
    await audit(db, "support.status_changed", staff.id, client, "support", str(m.id), {"before": before, "after": data.status})
    await db.commit()
    return {"success": True, "message": {"resolved": "Marked as resolved.", "in_progress": "Kept in progress.", "open": "Reopened."}[data.status]}


@router.get("/support-export")
async def export_support(tab: str = Query("all"), q: Optional[str] = Query(None, max_length=100),
                         category: Optional[str] = Query(None, max_length=120),
                         status: Optional[str] = Query(None, pattern="^(open|in_progress|resolved)$"),
                         days: int = Query(30, ge=0, le=365), staff: StaffContext = Depends(get_current_staff),
                         db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    require(staff, "support.manage", "reports.export")
    if tab not in SUPPORT_TABS:
        raise HTTPException(status_code=400, detail="Unknown tab")
    rows = (await db.execute(_support_query(tab, q, category, status, days).order_by(SupportMessage.id.desc()).limit(10_000))).scalars().all()
    await audit(db, "support.exported", staff.id, client, "report", "support", {"rows": len(rows)})
    await db.commit()
    return csv_response("support", ["id", "category", "description", "reported_by", "type", "email", "status", "date"],
                        [[short_ref("INC", m.id), m.subject, m.message, m.name, m.user_type, m.email, m.status, m.created_at] for m in rows])


# ── KYC queue ───────────────────────────────────────────────────────────────────────────────

NURSE_DOCS = ("photo", "license", "id", "licenseNumber")
DRIVER_DOCS = ("driver_license", "government_id", "vehicle_papers", "front_view", "back_view")


def _latest():
    return (select(AccountReview.action).where(AccountReview.user_id == User.id)
            .order_by(AccountReview.id.desc()).limit(1).correlate(User).scalar_subquery())


def _kyc_query(tab: str, q: Optional[str], kind: Optional[str]):
    submitted = or_(and_(User.user_type == UserTypeEnum.nurse, NurseProfile.verification_documents.isnot(None)),
                    and_(User.user_type == UserTypeEnum.driver, DriverProfile.submitted_at.isnot(None)))
    query = (select(User).outerjoin(NurseProfile, NurseProfile.user_id == User.id)
             .outerjoin(DriverProfile, DriverProfile.user_id == User.id).where(submitted))
    latest = _latest()
    pending = User.account_status == AccountStatusEnum.pending
    query = query.where({
        "all": true(),
        "pending": and_(pending, or_(latest.is_(None), latest != "changes_requested")),
        "approved": User.account_status == AccountStatusEnum.active,
        "rejected": and_(User.account_status == AccountStatusEnum.suspended, latest == "rejected"),
        "resubmission": and_(pending, latest == "changes_requested"),
    }[tab])
    if kind in ("nurse", "driver"):
        query = query.where(User.user_type == UserTypeEnum(kind))
    if q:
        like = f"%{q.strip().lower()}%"
        query = query.where(or_(func.lower(User.name).like(like), func.lower(User.email).like(like)))
    return query


@router.get("/kyc")
async def kyc_queue(tab: str = Query("all", pattern="^(all|pending|approved|rejected|resubmission)$"),
                    q: Optional[str] = Query(None, max_length=100), kind: Optional[str] = Query(None, pattern="^(nurse|driver)$"),
                    sort: str = Query("newest", pattern="^(newest|oldest|name_asc|name_desc)$"),
                    page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
                    staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    require(staff, "kyc.review")
    order = {"newest": User.updated_at.desc(), "oldest": User.updated_at.asc(),
             "name_asc": func.lower(User.name).asc(), "name_desc": func.lower(User.name).desc()}[sort]
    query = _kyc_query(tab, q, kind).options(selectinload(User.nurse_profile), selectinload(User.driver_profile))
    rows, meta = await page_of(db, query.order_by(order, User.id), page, page_size)
    users = [u for (u,) in rows]
    reviews = {}
    if users:
        for uid, action, created in (await db.execute(
                select(AccountReview.user_id, AccountReview.action, AccountReview.created_at)
                .where(AccountReview.user_id.in_([u.id for u in users])).order_by(AccountReview.id.desc()))).all():
            reviews.setdefault(uid, (action, created))
    items = []
    for u in users:
        nurse = u.user_type == UserTypeEnum.nurse
        p = u.nurse_profile if nurse else u.driver_profile
        docs = (p.verification_documents or {}) if p else {}
        expected = NURSE_DOCS if nurse else DRIVER_DOCS
        have = sum(1 for k in expected if docs.get(k))
        latest = reviews.get(u.id)
        state = ("approved" if u.account_status == AccountStatusEnum.active
                 else "rejected" if latest and latest[0] == "rejected" and u.account_status == AccountStatusEnum.suspended
                 else "resubmission" if latest and latest[0] == "changes_requested" and u.account_status == AccountStatusEnum.pending
                 else "suspended" if u.account_status == AccountStatusEnum.suspended else "pending")
        submitted_at = (p.created_at if nurse else p.submitted_at) if p else None
        items.append({
            "id": u.id, "name": u.name, "kind": "nurse" if nurse else "driver",
            "applicant_type": f"{'Nurse' if nurse else 'Driver'} · {short_ref('NRS' if nurse else 'DRV', u.id)}",
            "documents": f"{have} of {len(expected)} documents", "status": state, "profile_picture": u.profile_picture,
            "last_updated": ({"label": "Reviewed", "at": latest[1]} if latest else {"label": "Submitted", "at": submitted_at}),
        })
    counts = {t: await count(db, _kyc_query(t, q, kind)) for t in ("all", "pending", "approved", "rejected", "resubmission")}
    return ok({"items": items, **meta, "counts": counts, "can_export": staff.can("reports.export")})
