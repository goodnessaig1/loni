"""Raise a notification in the admin portal. Added to the caller's session, so it commits with the change it describes."""
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.models import AdminNotification


def notify_admins(db: AsyncSession, *, kind: str, title: str, permission: str, body: Optional[str] = None,
                  link: Optional[str] = None, category: str = "operational") -> None:
    db.add(AdminNotification(kind=kind, title=title[:160], body=(body or "")[:500] or None, link=link,
                             permission=permission, category=category))
