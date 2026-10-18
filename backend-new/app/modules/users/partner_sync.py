"""
Keeps a mother and her support partners in step.

Every change one side makes that the other should see goes through `tell()`: a live WebSocket event
(the open app refreshes at once), a push (wakes a closed app), and - for things worth keeping - a row
in the recipient's Notification Centre. Pregnancy/recovery milestones are delivered by
`send_due_updates()`, called when the partner opens the dashboard, when the mother's stage changes,
when she turns updates on, and by an hourly sweep, so a partner hears even if nobody opens the app.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.ws_manager import manager as ws_manager
from app.modules.notifications.models import NotificationLog
from app.modules.notifications.service import NotificationService
from app.modules.users.models import EmergencyContact, EmergencyContactStatus, User
from app.utils.partner_content import get_latest_updates

logger = logging.getLogger("partner_sync")

SWEEP_SECONDS = 3600
_sweeper: Optional[asyncio.Task] = None


async def tell(db: Optional[AsyncSession], user_id: str, event: str, title: str, body: str,
               data: Optional[dict] = None, *, log: bool = True, push: bool = True) -> None:
    """Live event + push + (optionally) a Notification Centre row. Logs are committed by the caller."""
    payload = dict(data or {})
    if log and db is not None:
        db.add(NotificationLog(user_id=user_id, type=event, title=title, body=body, data=payload))
    try:
        await ws_manager.send_to_user(user_id, event, payload)
    except Exception as e:  # a dead socket must not break the request
        logger.warning("partner_sync ws %s -> %s failed: %s", event, user_id, e)
    if push:
        asyncio.create_task(NotificationService.notify_user(user_id, title, body, {"type": event, **payload}))


def current_week(mother: User) -> Optional[int]:
    start = mother.pregnancy_start_date
    if not start:
        return None
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    return max(int((datetime.now(timezone.utc) - start).total_seconds() // (7 * 86400)), 0)


async def send_due_updates(db: AsyncSession, mother: User, only_partner: Optional[str] = None) -> int:
    """Tell each connected partner she shares updates with about her latest milestone, once per
    (stage, week). Returns how many partners were told. Commits."""
    status = mother.status.value if mother.status else None
    week = current_week(mother)
    if status not in ("pregnant", "newMom") or week is None:
        return 0
    latest = (get_latest_updates(status, week, limit=1) or [None])[0]
    if not latest:
        return 0

    conds = [
        EmergencyContact.user_id == mother.id,
        EmergencyContact.status == EmergencyContactStatus.connected,
        EmergencyContact.updates.is_(True),
    ]
    if only_partner:
        conds.append(EmergencyContact.contact_user_id == only_partner)
    contacts = (await db.execute(select(EmergencyContact).where(*conds))).scalars().all()

    told = 0
    for c in contacts:
        logged = (await db.execute(select(NotificationLog.data).where(
            NotificationLog.user_id == c.contact_user_id, NotificationLog.type == "pregnancy_update",
        ))).scalars().all()
        if any((d or {}).get("week") == latest["week"] and (d or {}).get("stage", status) == status for d in logged):
            continue
        title = "New pregnancy update" if status == "pregnant" else "New recovery update"
        body = f"{mother.name} reached week {latest['week']}: {latest['title']}."
        await tell(db, c.contact_user_id, "pregnancy_update", title, body,
                   {"week": latest["week"], "title": latest["title"], "stage": status})
        told += 1
    await db.commit()
    return told


async def sweep(db: AsyncSession) -> int:
    """Deliver due milestones for every mother who shares updates with a connected partner."""
    mother_ids = (await db.execute(select(EmergencyContact.user_id).where(
        EmergencyContact.status == EmergencyContactStatus.connected,
        EmergencyContact.updates.is_(True),
    ).distinct())).scalars().all()
    total = 0
    for mid in mother_ids:
        mother = await db.get(User, mid)
        if mother:
            total += await send_due_updates(db, mother)
    return total


async def _loop():
    from app.core.database import AsyncSessionLocal
    while True:
        try:
            from app.core.leader import leader
            async with leader(7_340_022) as ok:      # one process at a time
                if ok:
                    async with AsyncSessionLocal() as db:
                        n = await sweep(db)
                        if n:
                            logger.info("partner updates sweep: told %s partner(s)", n)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("partner updates sweep failed: %s", e)
        await asyncio.sleep(SWEEP_SECONDS)


def start_partner_sweeper() -> None:
    global _sweeper
    if _sweeper is None:
        _sweeper = asyncio.create_task(_loop())


async def stop_partner_sweeper() -> None:
    global _sweeper
    if _sweeper:
        _sweeper.cancel()
        try:
            await _sweeper
        except (asyncio.CancelledError, Exception):
            pass
        _sweeper = None


async def partners_of(db: AsyncSession, mother_id: str, *, connected_only: bool = True) -> list[EmergencyContact]:
    q = select(EmergencyContact).where(EmergencyContact.user_id == mother_id).options(selectinload(EmergencyContact.contact_user))
    if connected_only:
        q = q.where(EmergencyContact.status == EmergencyContactStatus.connected)
    return list((await db.execute(q)).scalars().all())
