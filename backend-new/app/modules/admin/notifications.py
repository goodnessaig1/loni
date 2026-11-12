"""/admin/notifications: the portal's bell. Each staff member sees only notifications their permissions cover."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.admin.models import AdminNotification, AdminNotificationRead
from app.modules.staff.deps import StaffContext, get_current_staff

router = APIRouter()


def _visible(staff: StaffContext):
    return AdminNotification.permission.in_(sorted(staff.permissions) or ["-"])


def _read_join(staff_id: str):
    return and_(AdminNotificationRead.notification_id == AdminNotification.id, AdminNotificationRead.staff_id == staff_id)


@router.get("/notifications")
async def list_notifications(tab: str = Query("all", pattern="^(all|unread|operational|system)$"),
                             page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                             staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    where = [_visible(staff)]
    if tab == "unread":
        where.append(AdminNotificationRead.staff_id.is_(None))
    elif tab in ("operational", "system"):
        where.append(AdminNotification.category == tab)
    base = select(AdminNotification, AdminNotificationRead.read_at).outerjoin(AdminNotificationRead, _read_join(staff.id)).where(*where)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (await db.execute(base.order_by(AdminNotification.id.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    unread = await _unread(db, staff)
    return {"success": True, "data": {
        "items": [{"id": n.id, "category": n.category, "kind": n.kind, "title": n.title, "body": n.body, "link": n.link,
                   "created_at": n.created_at, "read": read_at is not None} for n, read_at in rows],
        "total": total, "page": page, "pages": max(1, -(-total // page_size)), "unread": unread,
    }}


async def _unread(db: AsyncSession, staff: StaffContext) -> int:
    return (await db.execute(select(func.count()).select_from(AdminNotification)
                             .outerjoin(AdminNotificationRead, _read_join(staff.id))
                             .where(_visible(staff), AdminNotificationRead.staff_id.is_(None)))).scalar_one()


@router.get("/notifications/unread-count")
async def unread_count(staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    return {"success": True, "data": {"unread": await _unread(db, staff)}}


async def _mark(db: AsyncSession, staff_id: str, ids) -> None:
    ids = list(ids)
    if not ids:
        return
    already = set((await db.execute(select(AdminNotificationRead.notification_id).where(
        AdminNotificationRead.staff_id == staff_id, AdminNotificationRead.notification_id.in_(ids)))).scalars().all())
    for i in ids:
        if i not in already:
            db.add(AdminNotificationRead(notification_id=i, staff_id=staff_id))
    await db.commit()


@router.post("/notifications/{notification_id}/read")
async def mark_read(notification_id: int, staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    n = await db.get(AdminNotification, notification_id)
    if n is None or n.permission not in staff.permissions:
        raise HTTPException(status_code=404, detail="Notification not found")
    await _mark(db, staff.id, [notification_id])
    return {"success": True}


@router.post("/notifications/read-all")
async def mark_all_read(staff: StaffContext = Depends(get_current_staff), db: AsyncSession = Depends(get_db)):
    ids = (await db.execute(select(AdminNotification.id).outerjoin(AdminNotificationRead, _read_join(staff.id))
                            .where(_visible(staff), AdminNotificationRead.staff_id.is_(None)).limit(1000))).scalars().all()
    await _mark(db, staff.id, ids)
    return {"success": True}
