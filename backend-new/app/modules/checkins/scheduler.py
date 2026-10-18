"""Background loop that runs the check-in cycle. Off unless CHECKINS_ENABLED; one instance at a time (Postgres advisory lock)."""
import asyncio
import logging
from typing import Optional

from sqlalchemy import text

from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.core.mongo_db import get_mongo_db
from app.modules.checkins import service

logger = logging.getLogger("checkins")
LOCK_KEY = 704_201_015  # arbitrary, unique to this job

_task: Optional[asyncio.Task] = None


async def tick() -> None:
    """One scheduler pass. The advisory lock means that if you run several API instances only one does the work;
    the unique claim row stops duplicates even if the lock were ever bypassed."""
    mongo = get_mongo_db()
    if mongo is None:
        return
    async with engine.connect() as conn:
        locked = True
        if conn.dialect.name == "postgresql":
            locked = bool((await conn.execute(text("select pg_try_advisory_lock(:k)"), {"k": LOCK_KEY})).scalar())
        if not locked:
            return
        try:
            daily = await service.run_cycle(AsyncSessionLocal, mongo)
            follow = await service.run_followups(AsyncSessionLocal, mongo)
            if daily.sent or follow.sent or daily.failed or follow.failed:
                logger.info("check-ins: daily=%s follow-ups=%s", daily.as_dict(), follow.as_dict())
        finally:
            if conn.dialect.name == "postgresql":
                await conn.execute(text("select pg_advisory_unlock(:k)"), {"k": LOCK_KEY})
                await conn.commit()


async def _loop() -> None:
    while True:
        try:
            await tick()
        except Exception:
            logger.exception("check-in tick failed")
        await asyncio.sleep(settings.CHECKIN_TICK_SECONDS)


def start_checkin_scheduler() -> None:
    global _task
    if settings.CHECKINS_ENABLED and (_task is None or _task.done()):
        _task = asyncio.create_task(_loop())
        logger.info("check-in scheduler started (every %ss)", settings.CHECKIN_TICK_SECONDS)


async def stop_checkin_scheduler() -> None:
    global _task
    if _task:
        _task.cancel()
        try:
            await _task
        except asyncio.CancelledError:
            pass
        _task = None
