"""
/admin/community: reported posts and what staff decide about them (community.moderate).

Reporters stay anonymous everywhere in the portal ("Member: identity hidden"). Removing a post soft-deletes
it, so it disappears from every feed at once and the record is kept.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.ws_manager import manager as ws_manager
from app.modules.admin.common import count, csv_response, ok, page_of, require, short_ref, since
from app.modules.community.models import (
    CommunityModeration, CommunityPost, CommunityPostStats, CommunityReport,
)
from app.modules.community.router import REPORT_REASONS, TOPIC
from app.modules.staff.deps import ClientInfo, StaffContext, client_info, get_current_staff
from app.modules.staff.models import Staff
from app.modules.staff.service import audit
from app.modules.users.models import User

router = APIRouter()

TABS = {"all": None, "new": ["new"], "under_review": ["under_review"], "escalated": ["escalated"],
        "dismissed": ["dismissed"], "removed": ["removed"]}


def _top_reason():
    """The most common reason for each post (correlated)."""
    return (select(CommunityReport.reason).where(CommunityReport.post_id == CommunityModeration.post_id)
            .group_by(CommunityReport.reason).order_by(func.count().desc(), CommunityReport.reason)
            .limit(1).correlate(CommunityModeration).scalar_subquery())


def _query(tab: str, q: Optional[str], reason: Optional[str], content: Optional[str], status: Optional[str], days: Optional[int]):
    top = _top_reason().label("top_reason")
    query = (select(CommunityModeration, CommunityPost, User.name, top)
             .join(CommunityPost, CommunityPost.id == CommunityModeration.post_id)
             .join(User, User.id == CommunityPost.author_id))
    if TABS.get(tab):
        query = query.where(CommunityModeration.status.in_(TABS[tab]))
    if status:
        query = query.where(CommunityModeration.status == status)
    if reason:
        query = query.where(CommunityModeration.post_id.in_(
            select(CommunityReport.post_id).where(CommunityReport.reason == reason)))
    if content == "image":
        query = query.where(CommunityPost.image_url.isnot(None))
    elif content == "text":
        query = query.where(CommunityPost.image_url.is_(None))
    if days:
        query = query.where(CommunityModeration.last_reported_at >= since(days))
    if q:
        like = f"%{q.strip().lower()}%"
        conditions = [func.lower(CommunityPost.body).like(like), func.lower(User.name).like(like)]
        digits = q.strip().upper().removeprefix("POST-")
        if digits.isdigit():
            conditions.append(CommunityPost.id == int(digits))
        query = query.where(or_(*conditions))
    return query


def _author(name: str) -> str:
    parts = (name or "Member").split()
    return parts[0] + (f" {parts[-1][0]}." if len(parts) > 1 else "")


def _row(mod: CommunityModeration, post: CommunityPost, author: str, top_reason: Optional[str]) -> dict:
    return {"post_id": post.id, "ref": short_ref("POST", post.id), "excerpt": (post.body or "")[:80],
            "image_url": post.image_url, "author": _author(author), "reason": top_reason,
            "reason_label": REPORT_REASONS.get(top_reason or "", "Reported"), "reports": mod.report_count,
            "last_reported_at": mod.last_reported_at, "status": mod.status}


@router.get("/community/reports")
async def list_reports(tab: str = Query("all"), q: Optional[str] = Query(None, max_length=100),
                       reason: Optional[str] = Query(None, max_length=40),
                       content: Optional[str] = Query(None, pattern="^(text|image)$"),
                       status: Optional[str] = Query(None, pattern="^(new|under_review|escalated|dismissed|removed)$"),
                       days: int = Query(30, ge=0, le=365), page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100),
                       staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    require(staff, "community.moderate")
    if tab not in TABS or (reason and reason not in REPORT_REASONS):
        raise HTTPException(status_code=400, detail="Unknown filter")
    rows, meta = await page_of(db, _query(tab, q, reason, content, status, days)
                               .order_by(CommunityModeration.last_reported_at.desc()), page, page_size)
    counts = {t: await count(db, _query(t, q, reason, content, status, days)) for t in TABS}

    # Summary cards: how many posts are in each state now, and how many changed state since yesterday.
    day_ago = since(1)
    summary = {}
    for state in ("new", "under_review", "escalated", "resolved"):
        states = ["dismissed", "removed"] if state == "resolved" else [state]
        now_n = (await db.execute(select(func.count()).select_from(CommunityModeration)
                                  .where(CommunityModeration.status.in_(states)))).scalar_one()
        stamp = CommunityModeration.first_reported_at if state == "new" else CommunityModeration.decided_at
        new_today = (await db.execute(select(func.count()).select_from(CommunityModeration)
                                      .where(CommunityModeration.status.in_(states), stamp >= day_ago))).scalar_one()
        summary[state] = {"value": now_n, "since_yesterday": new_today}
    return ok({"items": [_row(*r) for r in rows], **meta, "counts": counts, "summary": summary,
               "reasons": [{"key": k, "label": v} for k, v in REPORT_REASONS.items()],
               "can_export": staff.can("reports.export")})


@router.get("/community/posts/{post_id}")
async def report_detail(post_id: int, staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    require(staff, "community.moderate")
    mod = await db.get(CommunityModeration, post_id)
    post = await db.get(CommunityPost, post_id)
    if mod is None or post is None:
        raise HTTPException(status_code=404, detail="Report not found")
    author = await db.get(User, post.author_id)
    stats = await db.get(CommunityPostStats, post_id)
    reports = (await db.execute(select(CommunityReport).where(CommunityReport.post_id == post_id)
                                .order_by(CommunityReport.id.desc()).limit(50))).scalars().all()
    reasons = (await db.execute(select(CommunityReport.reason, func.count()).where(CommunityReport.post_id == post_id)
                                .group_by(CommunityReport.reason).order_by(func.count().desc()))).all()
    decider = await db.get(Staff, mod.decided_by) if mod.decided_by else None
    return ok({
        "post": {"id": post.id, "ref": short_ref("POST", post.id), "body": post.body, "image_url": post.image_url,
                 "created_at": post.created_at, "removed": post.deleted_at is not None,
                 "author": author.name if author else "Deleted member", "author_id": post.author_id,
                 "author_picture": author.profile_picture if author else None,
                 "content_type": "Text + Image" if post.image_url else "Text",
                 "likes": stats.like_count if stats else 0, "comments": stats.comment_count if stats else 0,
                 "views": stats.view_count if stats else 0},
        "moderation": {"status": mod.status, "report_count": mod.report_count, "first_reported_at": mod.first_reported_at,
                       "last_reported_at": mod.last_reported_at, "note": mod.note,
                       "decided_by": decider.name if decider else None, "decided_at": mod.decided_at},
        "reasons": [{"key": r, "label": REPORT_REASONS.get(r, r), "count": n} for r, n in reasons],
        "reports": [{"reason": r.reason, "reason_label": REPORT_REASONS.get(r.reason, r.reason), "note": r.note,
                     "created_at": r.created_at} for r in reports],
    })


class ModerationIn(BaseModel):
    action: str = Field(..., pattern="^(dismiss|review|remove|escalate|restore)$")
    note: Optional[str] = Field(None, max_length=1000)


ACTION_STATUS = {"dismiss": "dismissed", "review": "under_review", "remove": "removed", "escalate": "escalated",
                 "restore": "under_review"}


@router.post("/community/posts/{post_id}/action")
async def moderate(post_id: int, data: ModerationIn, staff: StaffContext = Depends(get_current_staff),
                   db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    require(staff, "community.moderate")
    mod = await db.get(CommunityModeration, post_id)
    post = await db.get(CommunityPost, post_id)
    if mod is None or post is None:
        raise HTTPException(status_code=404, detail="Report not found")
    if data.action in ("remove", "escalate") and not (data.note or "").strip():
        raise HTTPException(status_code=400, detail="Add a short note explaining this decision.")
    before = mod.status
    mod.status = ACTION_STATUS[data.action]
    mod.note = (data.note or "").strip() or mod.note
    mod.decided_by = staff.id
    mod.decided_at = datetime.now(timezone.utc)
    removed_now = data.action == "remove" and post.deleted_at is None
    if removed_now:
        post.deleted_at = datetime.now(timezone.utc)
    if data.action == "restore":
        post.deleted_at = None
    await audit(db, f"community.{mod.status}", staff.id, client, "post", str(post_id),
                {"before": before, "after": mod.status, "note": data.note})
    await db.commit()
    if removed_now:
        try:
            await ws_manager.broadcast_topic(TOPIC, "community_post_deleted", {"post_id": post_id})
        except Exception as e:  # feed clients also drop it on their next refresh
            print(f"[admin] could not broadcast removal of post {post_id}: {e}")
    return {"success": True, "message": {
        "dismiss": "Report dismissed. The post stays visible.", "review": "Kept under review.",
        "remove": "Post removed from the community.", "escalate": "Escalated to the safety team.",
        "restore": "Post restored.",
    }[data.action]}


@router.get("/community-export")
async def export_reports(tab: str = Query("all"), q: Optional[str] = Query(None, max_length=100),
                         reason: Optional[str] = Query(None, max_length=40),
                         content: Optional[str] = Query(None, pattern="^(text|image)$"),
                         status: Optional[str] = Query(None, pattern="^(new|under_review|escalated|dismissed|removed)$"),
                         days: int = Query(30, ge=0, le=365), staff: StaffContext = Depends(get_current_staff),
                         db: AsyncSession = Depends(get_db), client: ClientInfo = Depends(client_info)):
    require(staff, "community.moderate", "reports.export")
    if tab not in TABS:
        raise HTTPException(status_code=400, detail="Unknown tab")
    rows = (await db.execute(_query(tab, q, reason, content, status, days)
                             .order_by(CommunityModeration.last_reported_at.desc()).limit(10_000))).all()
    await audit(db, "community.exported", staff.id, client, "report", "community", {"rows": len(rows)})
    await db.commit()
    items = [_row(*r) for r in rows]
    return csv_response("community-reports", ["post", "author", "excerpt", "top_reason", "reports", "last_reported", "status"],
                        [[i["ref"], i["author"], i["excerpt"], i["reason_label"], i["reports"], i["last_reported_at"], i["status"]] for i in items])
