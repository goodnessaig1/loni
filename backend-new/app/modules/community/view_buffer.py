"""
Write-behind buffer for post views.

Views are by far the highest-volume event in the feed (every post that scrolls past counts), and each one
used to cost a row insert plus an UPDATE on the post's counter row inside the request. Now the endpoint
only drops (post, user) pairs into memory and returns; a background task applies them every few seconds:

* one eligibility query for all queued posts,
* one multi-row ``INSERT .. ON CONFLICT DO NOTHING RETURNING`` into ``community_views`` (the UNIQUE
  constraint still guarantees one view per person per post),
* one ``UPDATE`` per *post* that adds the number of rows really inserted - a post viewed by 500 people in
  the window is a single counter write, not 500 contended ones.

It is safe with several workers (each has its own buffer; the database dedupes) and a crash loses at most
one interval of views, which is acceptable for a view counter. If traffic outgrows one process, swap the
in-memory set for a Redis set/stream behind the same ``add`` / ``drain`` interface.
"""
import asyncio
import logging
from collections import Counter
from typing import Awaitable, Callable, Dict, Iterable, List, Optional, Set, Tuple

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.community.models import CommunityPost, CommunityPostStats, CommunityView

logger = logging.getLogger("community.views")

FLUSH_INTERVAL_SECONDS = 3.0
FLUSH_EARLY_AT = 1000      # wake the flusher before the interval once this many pairs are waiting
MAX_PENDING = 50_000       # hard cap: views are best-effort, memory must not be
INSERT_CHUNK = 1000

Pair = Tuple[int, str]


class ViewBuffer:
    def __init__(self) -> None:
        self._pending: Set[Pair] = set()
        self.wake = asyncio.Event()

    def __len__(self) -> int:
        return len(self._pending)

    def add(self, user_id: str, post_ids: Iterable[int]) -> int:
        """Queue views; duplicates collapse. Returns how many new pairs were accepted."""
        before = len(self._pending)
        for pid in post_ids:
            if len(self._pending) >= MAX_PENDING:
                logger.warning("view buffer full, dropping views")
                break
            self._pending.add((pid, user_id))
        if len(self._pending) >= FLUSH_EARLY_AT:
            self.wake.set()
        return len(self._pending) - before

    def drain(self) -> List[Pair]:
        pairs = list(self._pending)
        self._pending.clear()
        return pairs


view_buffer = ViewBuffer()


async def apply_views(db: AsyncSession, pairs: List[Pair]) -> Dict[int, int]:
    """Persist queued views. Own posts, deleted posts and already-counted views are skipped.
    Returns {post_id: newly counted views}."""
    if not pairs:
        return {}
    post_ids = list({pid for pid, _ in pairs})
    authors = dict((await db.execute(
        select(CommunityPost.id, CommunityPost.author_id)
        .where(CommunityPost.id.in_(post_ids), CommunityPost.deleted_at.is_(None))
    )).all())
    rows = [{"post_id": pid, "user_id": uid} for pid, uid in pairs if pid in authors and authors[pid] != uid]
    if not rows:
        return {}

    insert = pg_insert if db.get_bind().dialect.name == "postgresql" else sqlite_insert
    gained: Counter = Counter()
    for i in range(0, len(rows), INSERT_CHUNK):
        stmt = (
            insert(CommunityView).values(rows[i:i + INSERT_CHUNK])
            .on_conflict_do_nothing(index_elements=["post_id", "user_id"])
            .returning(CommunityView.post_id)
        )
        gained.update(r[0] for r in (await db.execute(stmt)).all())

    for pid in sorted(gained):  # stable order -> no lock-order deadlocks between workers
        await db.execute(update(CommunityPostStats).where(CommunityPostStats.post_id == pid)
                         .values(view_count=CommunityPostStats.view_count + gained[pid]))
    await db.commit()
    return dict(gained)


Changed = Callable[[List[int]], Awaitable[None]]


async def flush_once(session_factory, buffer: ViewBuffer = view_buffer, on_changed: Optional[Changed] = None) -> Dict[int, int]:
    pairs = buffer.drain()
    if not pairs:
        return {}
    try:
        async with session_factory() as db:
            gained = await apply_views(db, pairs)
    except Exception:
        logger.exception("applying %d buffered views failed; re-queueing", len(pairs))
        for pid, uid in pairs:
            buffer.add(uid, [pid])
        return {}
    if gained and on_changed:
        try:
            await on_changed(sorted(gained))
        except Exception:
            logger.exception("view stats broadcast failed")
    return gained


async def run_flusher(session_factory, buffer: ViewBuffer = view_buffer, on_changed: Optional[Changed] = None,
                      interval: float = FLUSH_INTERVAL_SECONDS) -> None:
    """Background loop; cancel it on shutdown and call `flush_once` a final time."""
    while True:
        try:
            await asyncio.wait_for(buffer.wake.wait(), timeout=interval)
        except asyncio.TimeoutError:
            pass
        buffer.wake.clear()
        await flush_once(session_factory, buffer, on_changed)
