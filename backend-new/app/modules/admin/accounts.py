"""
/admin/accounts: the portal's lists of app accounts (mothers & partners, nurses, drivers), one account's
details, the decisions staff take on them (always with a reason when it's bad news) and CSV export.

Each segment has its own view/manage permission, so a verification officer can review nurses without
seeing every mother.
"""
import asyncio
import csv
import html
import io
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.core.database import get_db
from app.core.ws_manager import manager as ws_manager
from app.modules.admin.models import AccountReview
from app.modules.admin.notify import notify_admins
from app.modules.calls.models import Call, CallStatusEnum
from app.modules.notifications.service import NotificationService
from app.modules.rides.models import Ride, RideStatusEnum
from app.modules.staff.deps import ClientInfo, StaffContext, client_info, get_current_staff
from app.modules.staff.models import Staff
from app.modules.staff.service import audit
from app.modules.users.models import (
    AccountStatusEnum, EmergencyContact, EmergencyContactStatus, User, UserTypeEnum,
)

router = APIRouter()

SEGMENTS = {
    "users": {"types": [UserTypeEnum.user, UserTypeEnum.partner], "view": "users.view", "manage": "users.manage",
              "tabs": ["all", "mothers", "partners", "suspended"]},
    "nurses": {"types": [UserTypeEnum.nurse], "view": "nurses.view", "manage": "nurses.manage",
               "tabs": ["all", "pending", "approved", "rejected", "suspended"]},
    "drivers": {"types": [UserTypeEnum.driver], "view": "drivers.view", "manage": "drivers.manage",
                "tabs": ["all", "pending", "approved", "online", "offline", "rejected", "suspended"]},
}
SORTS = {
    "name_asc": lambda: func.lower(User.name).asc(),
    "name_desc": lambda: func.lower(User.name).desc(),
    "newest": lambda: User.created_at.desc(),
    "oldest": lambda: User.created_at.asc(),
}
STAGES = {"pregnant", "newMom", "ttc", "general"}


def _segment_of(user: User) -> str:
    if user.user_type == UserTypeEnum.nurse:
        return "nurses"
    if user.user_type == UserTypeEnum.driver:
        return "drivers"
    return "users"


def _require(staff: StaffContext, permission: str) -> None:
    if not staff.can(permission):
        raise HTTPException(status_code=403, detail="You don't have access to this.")


def _latest_review():
    """The most recent decision's action for each user (a correlated sub-query)."""
    return (select(AccountReview.action).where(AccountReview.user_id == User.id)
            .order_by(AccountReview.id.desc()).limit(1).correlate(User).scalar_subquery())


def _tab_filter(segment: str, tab: str):
    latest = _latest_review()
    if segment == "users":
        return {
            "all": None,
            "mothers": User.user_type == UserTypeEnum.user,
            "partners": User.user_type == UserTypeEnum.partner,
            "suspended": User.account_status == AccountStatusEnum.suspended,
        }[tab]
    rejected = and_(User.account_status == AccountStatusEnum.suspended, latest == "rejected")
    return {
        "all": None,
        "pending": User.account_status == AccountStatusEnum.pending,
        "approved": User.account_status == AccountStatusEnum.active,
        "rejected": rejected,
        "suspended": and_(User.account_status == AccountStatusEnum.suspended, or_(latest.is_(None), latest != "rejected")),
        "online": and_(User.account_status == AccountStatusEnum.active, User.is_online.is_(True)),
        "offline": and_(User.account_status == AccountStatusEnum.active, User.is_online.is_(False)),
    }[tab]


def _filters(segment: str, tab: str, q: Optional[str], status: Optional[str], stage: Optional[str]):
    cfg = SEGMENTS[segment]
    where = [User.user_type.in_(cfg["types"])]
    tab_clause = _tab_filter(segment, tab)
    if tab_clause is not None:
        where.append(tab_clause)
    if q:
        like = f"%{q.strip().lower()}%"
        where.append(or_(func.lower(User.name).like(like), func.lower(User.email).like(like),
                         User.phone.like(like), User.id == q.strip()))
    if status == "active" and segment == "users":
        where.append(User.account_status != AccountStatusEnum.suspended)
    elif status:
        where.append(User.account_status == AccountStatusEnum(status))
    if stage:
        where.append(User.status == stage)
    return where


# ── how each row reads ──────────────────────────────────────────────────────────────────────

def _weeks_since(dt: Optional[datetime]) -> Optional[int]:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max(0, int((datetime.now(timezone.utc) - dt).days // 7))


def stage_text(u: User) -> str:
    stage = u.status.value if u.status else None
    weeks = _weeks_since(u.pregnancy_start_date)
    if stage == "pregnant":
        return f"{weeks} weeks pregnant" if weeks is not None else "Pregnant"
    if stage == "newMom":
        return f"Postpartum · baby {weeks} weeks" if weeks is not None else "Postpartum"
    if stage == "ttc":
        return "Trying to conceive"
    if stage == "general":
        return "Women's health"
    return "Stage not set"


def review_state(u: User, latest: Optional[str]) -> str:
    """pending | changes_requested | approved | rejected | suspended (nurses/drivers); account status otherwise."""
    status = u.account_status.value
    if u.user_type not in (UserTypeEnum.nurse, UserTypeEnum.driver):
        # Mothers and partners never need approval (their rows stay 'pending'): only suspension matters.
        return "suspended" if status == "suspended" else "active"
    if status == "pending" and latest == "changes_requested":
        return "changes_requested"
    if status == "active":
        return "approved" if u.user_type in (UserTypeEnum.nurse, UserTypeEnum.driver) else "active"
    if status == "suspended" and latest == "rejected":
        return "rejected"
    return status


async def _row_extras(db: AsyncSession, users: List[User]) -> Dict[str, dict]:
    ids = [u.id for u in users]
    extras: Dict[str, dict] = {i: {} for i in ids}
    if not ids:
        return extras

    latest_rows = (await db.execute(
        select(AccountReview.user_id, AccountReview.action, AccountReview.reason, AccountReview.created_at)
        .where(AccountReview.user_id.in_(ids)).order_by(AccountReview.id.desc()))).all()
    for uid, action, reason, created in latest_rows:
        extras[uid].setdefault("latest_review", {"action": action, "reason": reason, "created_at": created})

    partner_ids = [u.id for u in users if u.user_type == UserTypeEnum.partner]
    if partner_ids:
        mother = aliased(User)
        rows = (await db.execute(
            select(EmergencyContact.contact_user_id, EmergencyContact.status, mother.name)
            .join(mother, mother.id == EmergencyContact.user_id)
            .where(EmergencyContact.contact_user_id.in_(partner_ids)))).all()
        for pid, st, mname in rows:
            extras[pid].setdefault("links", []).append({"name": mname, "status": st.value if st else None})

    nurse_ids = [u.id for u in users if u.user_type == UserTypeEnum.nurse]
    if nurse_ids:
        rows = (await db.execute(
            select(Call.receiver_id, func.count())
            .where(Call.receiver_id.in_(nurse_ids), Call.kind == 'nurse', Call.status == CallStatusEnum.ENDED,
                   Call.answered_at.isnot(None))
            .group_by(Call.receiver_id))).all()
        for nid, n in rows:
            extras[nid]["calls"] = n

    driver_ids = [u.id for u in users if u.user_type == UserTypeEnum.driver]
    if driver_ids:
        from app.modules.driver_training.models import AptitudeAttempt, DriverTrainingProgress
        from app.modules.driver_training.service import _module_ids
        modules = set(_module_ids())
        for uid, done in (await db.execute(select(DriverTrainingProgress.user_id, DriverTrainingProgress.completed_modules)
                                           .where(DriverTrainingProgress.user_id.in_(driver_ids)))).all():
            extras[uid]["training_pct"] = round(100 * len(modules & set(done or [])) / len(modules)) if modules else 100
        for uid, attempts, passed in (await db.execute(
                select(AptitudeAttempt.user_id, func.count(), func.max(case((AptitudeAttempt.passed.is_(True), 1), else_=0)))
                .where(AptitudeAttempt.user_id.in_(driver_ids)).group_by(AptitudeAttempt.user_id))).all():
            extras[uid]["aptitude"] = {"attempts": attempts, "passed": bool(passed)}
        for uid, n in (await db.execute(select(Ride.driver_id, func.count()).where(
                Ride.driver_id.in_(driver_ids), Ride.status == RideStatusEnum.COMPLETED).group_by(Ride.driver_id))).all():
            extras[uid]["rides"] = n
    return extras


def driver_checks(u: User, extra: dict) -> str:
    """One line on where a driver is with the pre-approval checks (training, aptitude test, vehicle, documents)."""
    from app.core.config import settings
    from app.modules.driver_training.onboarding import _documents_complete, _vehicle_complete
    p = u.driver_profile
    training = extra.get("training_pct", 0)
    apt = extra.get("aptitude") or {"attempts": 0, "passed": False}
    if training < 100:
        return f"Training {training}%"
    if not apt["passed"]:
        return f"Aptitude: {apt['attempts']} of {settings.APTITUDE_MAX_ATTEMPTS}"
    if not _vehicle_complete(p):
        return "Vehicle inspection pending"
    if not _documents_complete(p):
        return "Documents pending"
    return "All checks passed"


def _fmt_day(dt: Optional[datetime]) -> str:
    return dt.strftime("%-d %b") if dt else ""


def row_out(u: User, extra: dict) -> dict:
    latest = (extra.get("latest_review") or {}).get("action")
    state = review_state(u, latest)
    item = {
        "id": u.id, "name": u.name, "email": u.email, "phone": u.phone,
        "user_type": u.user_type.value if u.user_type else None,
        "account_status": u.account_status.value, "review_state": state,
        "profile_picture": u.profile_picture, "is_online": bool(u.is_online),
        "created_at": u.created_at, "updated_at": u.updated_at,
    }
    if u.user_type == UserTypeEnum.partner:
        links = extra.get("links") or []
        connected = [l["name"] for l in links if l["status"] == EmergencyContactStatus.connected.value]
        item["role"] = "Partner"
        item["detail"] = (f"Connected to {connected[0]}" + (f" +{len(connected) - 1}" if len(connected) > 1 else "")
                          if connected else "Invite pending" if links else "Connection revoked")
    elif u.user_type == UserTypeEnum.user:
        item["role"] = "Mother"
        item["detail"] = stage_text(u)
    elif u.user_type == UserTypeEnum.nurse:
        p = u.nurse_profile
        calls = extra.get("calls", 0)
        item["role"] = "Nurse"
        item["profile"] = (p.hospital_affiliation if p and p.hospital_affiliation else "No hospital given")
        item["credential"] = ("Not submitted" if not p or not p.verification_documents
                              else "Credential verified" if state == "approved" else "Credential review")
        if state in ("pending", "changes_requested"):
            item["activity"] = ("Changes requested" if state == "changes_requested"
                                else f"Application {_fmt_day(p.created_at)}" if p else "Profile not started")
        else:
            item["activity"] = f"{'Online' if u.is_online else 'Offline'} · {calls} calls"
        item["calls"] = calls
    elif u.user_type == UserTypeEnum.driver:
        p = u.driver_profile
        vehicle = " ".join(x for x in [p.vehicle_brand, p.vehicle_model] if x) if p else ""
        item["role"] = "Driver"
        item["profile"] = (f"{vehicle} · {p.plate_number}" if p and p.plate_number else vehicle) or "No vehicle yet"
        submitted = p is not None and p.submitted_at is not None
        item["credential"] = driver_checks(u, extra)
        rides = extra.get("rides", p.total_trips if p else 0)
        if state in ("pending", "changes_requested"):
            pct = extra.get("training_pct", 0)
            item["activity"] = ("Changes requested" if state == "changes_requested"
                                else "Training complete" if pct >= 100 else f"Training {pct}%")
        else:
            item["activity"] = (f"{'Online' if u.is_online else 'Offline'} · {rides} rides" if state == "approved"
                                else f"{rides} rides")
        item["rides"] = rides
        item["submitted"] = submitted
    return item


def _load_options():
    return (selectinload(User.nurse_profile), selectinload(User.driver_profile))


@router.get("/accounts")
async def list_accounts(
    segment: str = Query("users", pattern="^(users|nurses|drivers)$"),
    tab: str = Query("all", max_length=20),
    q: Optional[str] = Query(None, max_length=100),
    status: Optional[str] = Query(None, pattern="^(pending|active|suspended)$"),
    stage: Optional[str] = Query(None, max_length=20),
    sort: str = Query("newest", pattern="^(name_asc|name_desc|newest|oldest)$"),
    page: int = Query(1, ge=1, le=10_000),
    page_size: int = Query(10, ge=1, le=100),
    staff: StaffContext = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
):
    cfg = SEGMENTS[segment]
    _require(staff, cfg["view"])
    if tab not in cfg["tabs"]:
        raise HTTPException(status_code=400, detail="Unknown tab")
    if stage and stage not in STAGES:
        raise HTTPException(status_code=400, detail="Unknown stage")
    where = _filters(segment, tab, q, status, stage)
    total = (await db.execute(select(func.count()).select_from(User).where(*where))).scalar_one()
    users = (await db.execute(
        select(User).options(*_load_options()).where(*where)
        .order_by(SORTS[sort](), User.id).offset((page - 1) * page_size).limit(page_size))).scalars().all()
    extras = await _row_extras(db, users)

    counts = {}
    for t in cfg["tabs"]:
        clauses = _filters(segment, t, q, status, stage)
        counts[t] = (await db.execute(select(func.count()).select_from(User).where(*clauses))).scalar_one()

    return {"success": True, "data": {
        "items": [row_out(u, extras[u.id]) for u in users], "total": total, "page": page,
        "page_size": page_size, "pages": max(1, -(-total // page_size)), "counts": counts,
        "can_manage": staff.can(cfg["manage"]), "can_export": staff.can("reports.export"),
    }}


# ── one account ─────────────────────────────────────────────────────────────────────────────

DOC_LABELS = {
    "photo": "Profile photo", "license": "Nursing licence", "id": "Government ID",
    "driver_license": "Driver's licence", "government_id": "Government ID", "vehicle_papers": "Vehicle papers",
    "front_view": "Vehicle front", "back_view": "Vehicle back", "interior": "Vehicle interior", "vin": "VIN",
}


def _documents(docs: Optional[dict]) -> List[dict]:
    out = []
    for key, value in (docs or {}).items():
        if isinstance(value, str) and value.startswith("https://"):
            name = value.rsplit("/", 1)[-1].split("?")[0]
            out.append({"key": key, "label": DOC_LABELS.get(key, key.replace("_", " ").capitalize()), "url": value,
                        "file_name": name, "is_pdf": name.lower().endswith(".pdf")})
    return out


async def _get_user(db: AsyncSession, user_id: str) -> User:
    user = (await db.execute(select(User).options(*_load_options()).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return user


@router.get("/accounts/{user_id}")
async def account_detail(user_id: str, staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    user = await _get_user(db, user_id)
    seg = _segment_of(user)
    # KYC reviewers can open nurse and driver applications without the wider nurse/driver list permissions.
    if not (seg in ("nurses", "drivers") and staff.can("kyc.review")):
        _require(staff, SEGMENTS[seg]["view"])
    extras = (await _row_extras(db, [user]))[user.id]
    data = row_out(user, extras)
    data["segment"] = seg
    data["can_manage"] = staff.can(SEGMENTS[seg]["manage"])
    data["can_view_documents"] = staff.can("kyc.review")
    data["is_email_verified"] = user.is_email_verified
    data["is_phone_verified"] = user.is_phone_verified

    history = (await db.execute(
        select(AccountReview, Staff.name).outerjoin(Staff, Staff.id == AccountReview.staff_id)
        .where(AccountReview.user_id == user.id).order_by(AccountReview.id.desc()).limit(20))).all()
    data["history"] = [{"action": r.action, "reason": r.reason, "staff_name": name, "created_at": r.created_at}
                       for r, name in history]

    if user.user_type == UserTypeEnum.user:
        partner = aliased(User)
        rows = (await db.execute(select(partner.name, partner.email, EmergencyContact.relationship, EmergencyContact.status)
                                 .join(partner, partner.id == EmergencyContact.contact_user_id)
                                 .where(EmergencyContact.user_id == user.id))).all()
        data["stage"] = stage_text(user)
        data["connections"] = [{"name": n, "email": e, "relationship": rel, "status": st.value if st else None} for n, e, rel, st in rows]
    elif user.user_type == UserTypeEnum.partner:
        mother = aliased(User)
        rows = (await db.execute(select(mother.name, mother.email, EmergencyContact.relationship, EmergencyContact.status)
                                 .join(mother, mother.id == EmergencyContact.user_id)
                                 .where(EmergencyContact.contact_user_id == user.id))).all()
        data["connections"] = [{"name": n, "email": e, "relationship": rel, "status": st.value if st else None} for n, e, rel, st in rows]

    # Documents are personal data: only staff allowed to review KYC get the links.
    if user.user_type == UserTypeEnum.nurse and user.nurse_profile:
        p = user.nurse_profile
        docs = p.verification_documents or {}
        data["credentials"] = {"license_number": docs.get("licenseNumber"), "years_of_experience": p.years_of_experience,
                               "hospital": p.hospital_affiliation}
        data["documents"] = _documents(docs) if staff.can("kyc.review") else []
        data["rating"] = (await db.execute(select(func.avg(Call.rating).label("avg"), func.count(Call.rating).label("count"))
                                           .where(Call.receiver_id == user.id, Call.rating.isnot(None)))).one()._asdict()
    if user.user_type == UserTypeEnum.driver and user.driver_profile:
        p = user.driver_profile
        data["credentials"] = {"vehicle": " ".join(x for x in [p.vehicle_year, p.vehicle_brand, p.vehicle_model] if x),
                               "plate_number": p.plate_number, "vehicle_color": p.vehicle_color,
                               "submitted_at": p.submitted_at}
        docs = p.verification_documents or {}
        data["documents"] = [d for d in _documents(docs) if d["key"] in ("driver_license", "government_id", "vehicle_papers")] \
            if staff.can("kyc.review") else []
        data["vehicle_photos"] = [d for d in _documents(docs) if d["key"] in ("front_view", "back_view", "interior", "vin")] \
            if staff.can("kyc.review") else []
        data["rating"] = {"avg": p.rating_avg or None, "count": p.rating_count}
        data["driver_info"] = {"full_name": p.full_name or user.name, "date_of_birth": p.date_of_birth,
                               "phone": user.phone, "email": user.email,
                               "gender": user.gender.value if user.gender else None}
        data["vehicle_info"] = {"type": p.vehicle_type, "brand": p.vehicle_brand, "model": p.vehicle_model,
                                "year": p.vehicle_year, "color": p.vehicle_color, "plate_number": p.plate_number,
                                "air_conditioning": p.has_ac}
        data["performance"] = {"total_trips": p.total_trips, "total_earnings": p.total_earnings}
    if data.get("documents") or data.get("credentials"):
        await audit(db, "account.viewed", staff.id, None, "user", user.id, {"documents": len(data.get("documents") or [])})
        await db.commit()
    return {"success": True, "data": data}


@router.get("/accounts/{user_id}/activity")
async def account_activity(user_id: str, page: int = Query(1, ge=1), page_size: int = Query(6, ge=1, le=50),
                           staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    """Recent rides (drivers) or calls (nurses) for the details panel."""
    user = await _get_user(db, user_id)
    seg = _segment_of(user)
    _require(staff, SEGMENTS[seg]["view"])
    mother = aliased(User)
    if seg == "drivers":
        base = (select(Ride, mother.name).join(mother, mother.id == Ride.rider_id).where(Ride.driver_id == user.id))
        total = (await db.execute(select(func.count()).select_from(Ride).where(Ride.driver_id == user.id))).scalar_one()
        rows = (await db.execute(base.order_by(Ride.id.desc()).offset((page - 1) * page_size).limit(page_size))).all()
        items = [{"ref": f"RIDE-{r.id}", "title": f"{(r.pickup_address or 'Pickup').split(',')[0]} → "
                  f"{r.dropoff_name or (r.dropoff_address or 'Hospital').split(',')[0]}",
                  "subtitle": name, "status": r.status.value.lower(), "at": r.requested_at,
                  "amount": r.fare_final or r.fare_estimate} for r, name in rows]
    elif seg == "nurses":
        total = (await db.execute(select(func.count()).select_from(Call).where(Call.receiver_id == user.id))).scalar_one()
        rows = (await db.execute(select(Call).where(Call.receiver_id == user.id).order_by(Call.id.desc())
                                 .offset((page - 1) * page_size).limit(page_size))).scalars().all()
        items = [{"ref": f"CALL-{c.id}", "title": f"Call with Mother · USR-{c.caller_id[-4:].upper()}",
                  "subtitle": f"{c.duration_seconds // 60} min" if c.duration_seconds else None,
                  "status": c.status.value.lower(), "at": c.created_at, "amount": None} for c in rows]
    else:
        return {"success": True, "data": {"items": [], "total": 0, "page": 1, "pages": 1}}
    return {"success": True, "data": {"items": items, "total": total, "page": page, "pages": max(1, -(-total // page_size))}}


@router.get("/accounts/{user_id}/reviews")
async def account_reviews(user_id: str, page: int = Query(1, ge=1), page_size: int = Query(4, ge=1, le=20),
                          staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    """What mothers said after calls (nurses) or rides (drivers)."""
    user = await _get_user(db, user_id)
    seg = _segment_of(user)
    _require(staff, SEGMENTS[seg]["view"])
    author = aliased(User)
    if seg == "nurses":
        base = select(Call.rating, Call.feedback, func.coalesce(Call.ended_at, Call.created_at), author.name) \
            .join(author, author.id == Call.caller_id).where(Call.receiver_id == user.id, Call.rating.isnot(None))
        order = Call.id.desc()
        count_q = select(func.count()).select_from(Call).where(Call.receiver_id == user.id, Call.rating.isnot(None))
    elif seg == "drivers":
        base = select(Ride.rider_rating, Ride.rider_feedback, func.coalesce(Ride.completed_at, Ride.requested_at), author.name) \
            .join(author, author.id == Ride.rider_id).where(Ride.driver_id == user.id, Ride.rider_rating.isnot(None))
        order = Ride.id.desc()
        count_q = select(func.count()).select_from(Ride).where(Ride.driver_id == user.id, Ride.rider_rating.isnot(None))
    else:
        return {"success": True, "data": {"items": [], "total": 0, "page": 1, "pages": 1}}
    total = (await db.execute(count_q)).scalar_one()
    rows = (await db.execute(base.order_by(order).offset((page - 1) * page_size).limit(page_size))).all()
    return {"success": True, "data": {
        "items": [{"rating": r, "comment": c, "date": d, "author": a} for r, c, d, a in rows],
        "total": total, "page": page, "pages": max(1, -(-total // page_size)),
    }}


# ── decisions ───────────────────────────────────────────────────────────────────────────────

class DecisionIn(BaseModel):
    action: str = Field(..., pattern="^(approve|request_changes|reject|suspend|reactivate)$")
    reason: Optional[str] = Field(None, max_length=1000)


NEEDS_REASON = {"request_changes", "reject", "suspend"}
PAST = {"approve": "approved", "request_changes": "changes_requested", "reject": "rejected",
        "suspend": "suspended", "reactivate": "reactivated"}


def _user_email(user: User, subject: str, heading: str, body: str) -> None:
    from app.modules.auth.email_service import send_plain_email
    content = (f'<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1a1a">'
               f'<h2 style="color:#D62D88">{html.escape(heading)}</h2>{body}'
               f'<p style="color:#777;font-size:13px">Questions? Reply to this email or contact LONI support in the app.</p></div>')

    async def _go():
        try:
            await send_plain_email(user.email, subject, content)
        except Exception as e:  # the decision stands even if the email fails
            print(f"[admin] could not email {user.email}: {e}")
    asyncio.create_task(_go())


async def apply_decision(db: AsyncSession, staff: StaffContext, client: Optional[ClientInfo], user: User,
                         action: str, reason: Optional[str]) -> None:
    seg = _segment_of(user)
    _require(staff, SEGMENTS[seg]["manage"])
    reason = (reason or "").strip() or None
    if action in NEEDS_REASON and (not reason or len(reason) < 5):
        raise HTTPException(status_code=400, detail="Give a clear reason (at least a few words). The person will see it.")
    is_pro = user.user_type in (UserTypeEnum.nurse, UserTypeEnum.driver)
    status = user.account_status

    if action == "approve":
        if status == AccountStatusEnum.active:
            raise HTTPException(status_code=400, detail="This account is already approved.")
        if user.user_type == UserTypeEnum.nurse and not (user.nurse_profile and user.nurse_profile.verification_documents):
            raise HTTPException(status_code=400, detail="This nurse hasn't submitted their credentials yet.")
        if user.user_type == UserTypeEnum.driver and not (user.driver_profile and user.driver_profile.submitted_at):
            raise HTTPException(status_code=400, detail="This driver hasn't submitted their application yet.")
        new_status = AccountStatusEnum.active
    elif action == "request_changes":
        if not is_pro or status != AccountStatusEnum.pending:
            raise HTTPException(status_code=400, detail="Changes can only be requested on a pending application.")
        new_status = AccountStatusEnum.pending
    elif action == "reject":
        if not is_pro or status != AccountStatusEnum.pending:
            raise HTTPException(status_code=400, detail="Only a pending application can be rejected.")
        new_status = AccountStatusEnum.suspended
    elif action == "suspend":
        if status == AccountStatusEnum.suspended:
            raise HTTPException(status_code=400, detail="This account is already suspended.")
        new_status = AccountStatusEnum.suspended
    else:  # reactivate
        if status != AccountStatusEnum.suspended:
            raise HTTPException(status_code=400, detail="Only a suspended account can be reactivated.")
        new_status = AccountStatusEnum.active if (not is_pro or await _was_approved(db, user.id)) else AccountStatusEnum.pending

    old = status
    user.account_status = new_status
    db.add(AccountReview(user_id=user.id, staff_id=staff.id, action=PAST[action], reason=reason))
    await audit(db, f"account.{PAST[action]}", staff.id, client, "user", user.id,
                {"before": old.value, "after": new_status.value, "user_type": user.user_type.value if user.user_type else None,
                 "reason": reason})
    role = {"user": "Mother"}.get(user.user_type.value, user.user_type.value.capitalize()) if user.user_type else "User"
    who, by = user.name, staff.staff.name
    title, body = {
        "approve": (f"{role} approved", f"{who} was approved by {by}."),
        "request_changes": (f"Changes requested from {role.lower()}", f"{by} asked {who} to update their application."),
        "reject": (f"{role} application rejected", f"{by} rejected {who}'s application."),
        "suspend": (f"{role} suspended", f"{who} was suspended by {by}."),
        "reactivate": (f"{role} reactivated", f"{who} was reactivated by {by}."),
    }[action]
    notify_admins(db, kind="account_decision", category="system", permission=SEGMENTS[seg]["view"],
                  title=title, body=body, link=f"/{seg}?open={user.id}")
    await db.commit()
    await _tell_user(user, action, reason, old, new_status)


async def _was_approved(db: AsyncSession, user_id: str) -> bool:
    return (await db.execute(select(func.count()).select_from(AccountReview)
                             .where(AccountReview.user_id == user_id, AccountReview.action == "approved"))).scalar_one() > 0


async def _tell_user(user: User, action: str, reason: Optional[str], old, new) -> None:
    first = html.escape(user.name.split()[0] if user.name else "there")
    role = user.user_type.value if user.user_type else "user"
    why = f"<p><b>Reason:</b> {html.escape(reason)}</p>" if reason else ""
    if old != new:
        try:  # a foregrounded app reacts at once; FCM below covers the rest
            await ws_manager.send_to_user(user.id, "account_status", {"account_status": new.value, "user_type": role})
        except Exception as e:
            print(f"[admin] account_status WS to {user.id} failed: {e}")

    if action == "approve" and old == AccountStatusEnum.pending and role in ("nurse", "driver"):
        from app.modules.auth.email_service import send_account_approved_email
        asyncio.create_task(send_account_approved_email(to_email=user.email, name=first, user_type=role))
        asyncio.create_task(NotificationService.notify_user(
            user_id=user.id, title="You're approved 🎉",
            body=f"Your Loni {role} account has been verified. Tap to get started.",
            data={"type": "account_approved", "account_status": new.value, "user_type": role}))
    elif action == "request_changes":
        _user_email(user, "Action needed on your LONI application", "We need a few changes",
                    f"<p>Hi {first}, thanks for applying to LONI. Before we can approve your {role} account, please update your application in the app.</p>{why}")
        asyncio.create_task(NotificationService.notify_user(
            user_id=user.id, title="Your application needs a few changes",
            body=(reason or "Open the app to see what to update.")[:180], data={"type": "application_changes_requested"}))
    elif action == "reject":
        _user_email(user, "Your LONI application", "We couldn't approve your application",
                    f"<p>Hi {first}, after reviewing your {role} application we're unable to approve it.</p>{why}")
    elif action == "suspend":
        _user_email(user, "Your LONI account has been suspended", "Your account is suspended",
                    f"<p>Hi {first}, your LONI account has been suspended.</p>{why}")
    elif action == "reactivate":
        _user_email(user, "Your LONI account is active again", "Welcome back",
                    f"<p>Hi {first}, your LONI account has been reactivated. You can use the app as normal.</p>")


@router.post("/accounts/{user_id}/decision")
async def decide(user_id: str, data: DecisionIn, staff: StaffContext = Depends(get_current_staff),
                 db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    user = await _get_user(db, user_id)
    await apply_decision(db, staff, client, user, data.action, data.reason)
    return {"success": True, "message": {
        "approve": "Approved.", "request_changes": "Changes requested. They've been told what to fix.",
        "reject": "Application rejected.", "suspend": "Account suspended.", "reactivate": "Account reactivated.",
    }[data.action]}


# ── export ──────────────────────────────────────────────────────────────────────────────────

@router.get("/accounts-export")
async def export_accounts(
    segment: str = Query("users", pattern="^(users|nurses|drivers)$"),
    tab: str = Query("all", max_length=20),
    q: Optional[str] = Query(None, max_length=100),
    status: Optional[str] = Query(None, pattern="^(pending|active|suspended)$"),
    stage: Optional[str] = Query(None, max_length=20),
    sort: str = Query("newest", pattern="^(name_asc|name_desc|newest|oldest)$"),
    staff: StaffContext = Depends(get_current_staff),
    db: AsyncSession = Depends(get_db),
    client: ClientInfo = Depends(client_info),
):
    cfg = SEGMENTS[segment]
    _require(staff, cfg["view"])
    _require(staff, "reports.export")
    if tab not in cfg["tabs"] or (stage and stage not in STAGES):
        raise HTTPException(status_code=400, detail="Unknown filter")
    users = (await db.execute(select(User).options(*_load_options()).where(*_filters(segment, tab, q, status, stage))
                              .order_by(SORTS[sort](), User.id).limit(10_000))).scalars().all()
    extras = await _row_extras(db, users)
    rows = [row_out(u, extras[u.id]) for u in users]
    await audit(db, "accounts.exported", staff.id, client, "segment", segment, {"tab": tab, "rows": len(rows), "q": q})
    await db.commit()

    columns = ["id", "name", "email", "phone", "role", "review_state", "created_at"]
    columns += ["detail"] if segment == "users" else ["profile", "credential", "activity"]

    def _safe(v) -> str:
        s = "" if v is None else (v.isoformat() if isinstance(v, datetime) else str(v))
        # Spreadsheet formula injection: never let a cell start with = + - @
        return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(columns)
    for r in rows:
        writer.writerow([_safe(r.get(c)) for c in columns])
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="loni-{segment}-{tab}-{stamp}.csv"',
                                      "Cache-Control": "no-store"})
