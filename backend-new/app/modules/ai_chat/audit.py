"""Audit trail for LONI AI tools (memory edits, nurse handoffs, knowledge-base changes).

Who did what to which record, never the health content itself. Stored in Mongo `ai_audit_log` next to
`ai_safety_events`. Auditing must never break the action it records, so failures are logged and swallowed.
"""
import logging
import uuid
from datetime import datetime, timezone

from app.core.mongo_db import get_mongo_db

logger = logging.getLogger("ai_audit")


async def record(action: str, *, actor: str, subject: str | None = None, **ids) -> None:
    db = get_mongo_db()
    if db is None:
        logger.info("audit (no mongo): %s actor=%s subject=%s %s", action, actor, subject, ids)
        return
    try:
        await db["ai_audit_log"].insert_one({"id": str(uuid.uuid4()), "action": action, "actor": actor, "subject": subject,
                                             "ids": {k: v for k, v in ids.items() if isinstance(v, (str, int, float, bool)) or v is None},
                                             "at": datetime.now(timezone.utc)})
    except Exception:
        logger.exception("could not write audit entry %s", action)
