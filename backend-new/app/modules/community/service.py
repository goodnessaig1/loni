"""Community business logic: feed queries, atomic counters, serialisation."""
import base64
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy import and_, case, delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.community.models import (
    CommunityComment, CommunityLike, CommunityPost, CommunityPostStats, CommunityView,
)
from app.modules.community.schemas import AuthorOut, CommentOut, PostOut
from app.modules.users.models import User

MAX_PAGE = 30
MAX_VIEWERS_SHOWN = 3


# ── serialisation ────────────────────────────────────────────────────────────

def first_name(name: Optional[str]) -> str:
    parts = (name or '').strip().split()
    return parts[0] if parts else 'Mama'


def author_out(user: Optional[User]) -> AuthorOut:
    if user is None:  # account removed: keep the post readable
        return AuthorOut(id='', name='Mama')
    return AuthorOut(id=user.id, name=first_name(user.name), profile_picture=user.profile_picture)


def encode_cursor(created_at: datetime, row_id: int) -> str:
    return base64.urlsafe_b64encode(f"{created_at.isoformat()}|{row_id}".encode()).decode()


def decode_cursor(cursor: Optional[str]) -> Optional[Tuple[datetime, int]]:
    if not cursor:
        return None
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        ts, row_id = raw.rsplit('|', 1)
        parsed = datetime.fromisoformat(ts)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed, int(row_id)
    except Exception:
        return None


async def serialize_posts(db: AsyncSession, posts: List[CommunityPost], me_id: str) -> List[PostOut]:
    """Turn posts into PostOut: batches the "did I like it" and "who viewed it" lookups (no N+1)."""
    if not posts:
        return []
    ids = [p.id for p in posts]

    liked = set((await db.execute(
        select(CommunityLike.post_id).where(CommunityLike.user_id == me_id, CommunityLike.post_id.in_(ids))
    )).scalars().all())

    # Latest N viewers per post with one window-function query.
    ranked = (
        select(
            CommunityView.post_id.label('post_id'),
            CommunityView.user_id.label('user_id'),
            func.row_number().over(
                partition_by=CommunityView.post_id,
                order_by=(CommunityView.created_at.desc(), CommunityView.id.desc()),
            ).label('rn'),
        )
        .where(CommunityView.post_id.in_(ids))
        .subquery()
    )
    rows = (await db.execute(
        select(ranked.c.post_id, User)
        .join(User, User.id == ranked.c.user_id)
        .where(ranked.c.rn <= MAX_VIEWERS_SHOWN)
        .order_by(ranked.c.post_id, ranked.c.rn)
    )).all()
    viewers: Dict[int, List[AuthorOut]] = {}
    for post_id, user in rows:
        viewers.setdefault(post_id, []).append(author_out(user))

    return [
        PostOut(
            id=p.id,
            author=author_out(p.author),
            body=p.body,
            image_url=p.image_url,
            like_count=p.like_count,
            comment_count=p.comment_count,
            view_count=p.view_count,
            recent_viewers=viewers.get(p.id, []),
            created_at=p.created_at,
            liked_by_me=p.id in liked,
            is_mine=p.author_id == me_id,
        )
        for p in posts
    ]


# ── feed ─────────────────────────────────────────────────────────────────────

def _escape_like(term: str) -> str:
    return term.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


async def list_feed(db: AsyncSession, me_id: str, cursor: Optional[str], limit: int,
                    query: Optional[str]) -> Tuple[List[PostOut], Optional[str]]:
    limit = max(1, min(limit, MAX_PAGE))
    stmt = (
        select(CommunityPost)
        .options(selectinload(CommunityPost.author))
        .where(CommunityPost.deleted_at.is_(None))
    )
    if query and query.strip():
        stmt = stmt.where(CommunityPost.body.ilike(f"%{_escape_like(query.strip())}%", escape='\\'))
    decoded = decode_cursor(cursor)
    if decoded:
        ts, row_id = decoded
        stmt = stmt.where(or_(
            CommunityPost.created_at < ts,
            and_(CommunityPost.created_at == ts, CommunityPost.id < row_id),
        ))
    stmt = stmt.order_by(CommunityPost.created_at.desc(), CommunityPost.id.desc()).limit(limit + 1)

    posts = list((await db.execute(stmt)).scalars().all())
    has_more = len(posts) > limit
    posts = posts[:limit]
    next_cursor = encode_cursor(posts[-1].created_at, posts[-1].id) if has_more and posts else None
    return await serialize_posts(db, posts, me_id), next_cursor


async def get_post(db: AsyncSession, post_id: int) -> Optional[CommunityPost]:
    return (await db.execute(
        select(CommunityPost)
        .options(selectinload(CommunityPost.author))
        .where(CommunityPost.id == post_id, CommunityPost.deleted_at.is_(None))
        .execution_options(populate_existing=True)  # counters change underneath cached rows
    )).scalar_one_or_none()


# ── likes ────────────────────────────────────────────────────────────────────

async def set_like(db: AsyncSession, post: CommunityPost, user_id: str, liked: bool) -> Tuple[bool, int]:
    """Idempotent like/unlike. The counter only moves when a join row was really added/removed."""
    if liked:
        try:
            async with db.begin_nested():
                db.add(CommunityLike(post_id=post.id, user_id=user_id))
                await db.flush()
            changed = True
        except IntegrityError:  # already liked (or a concurrent double-tap won the race)
            changed = False
        if changed:
            await db.execute(update(CommunityPostStats).where(CommunityPostStats.post_id == post.id)
                             .values(like_count=CommunityPostStats.like_count + 1))
    else:
        result = await db.execute(delete(CommunityLike).where(
            CommunityLike.post_id == post.id, CommunityLike.user_id == user_id))
        if result.rowcount:
            await db.execute(update(CommunityPostStats).where(CommunityPostStats.post_id == post.id)
                             .values(like_count=case((CommunityPostStats.like_count > 0, CommunityPostStats.like_count - 1), else_=0)))
    await db.commit()
    count = (await db.execute(select(CommunityPostStats.like_count)
                              .where(CommunityPostStats.post_id == post.id))).scalar_one()
    return liked, count


# ── comments ─────────────────────────────────────────────────────────────────

async def add_comment(db: AsyncSession, post: CommunityPost, user: User, body: str) -> CommunityComment:
    comment = CommunityComment(post_id=post.id, author_id=user.id, body=body)
    db.add(comment)
    await db.flush()
    await db.execute(update(CommunityPostStats).where(CommunityPostStats.post_id == post.id)
                     .values(comment_count=CommunityPostStats.comment_count + 1))
    await db.commit()
    await db.refresh(comment)
    return comment


async def list_comments(db: AsyncSession, post_id: int, me_id: str, cursor: Optional[str],
                        limit: int) -> Tuple[List[CommentOut], Optional[str]]:
    """Oldest first (a conversation reads top to bottom); the cursor is the last comment id seen."""
    limit = max(1, min(limit, MAX_PAGE))
    stmt = (
        select(CommunityComment)
        .options(selectinload(CommunityComment.author))
        .where(CommunityComment.post_id == post_id)
        .order_by(CommunityComment.id.asc())
        .limit(limit + 1)
    )
    if cursor and cursor.isdigit():
        stmt = stmt.where(CommunityComment.id > int(cursor))
    rows = list((await db.execute(stmt)).scalars().all())
    has_more = len(rows) > limit
    rows = rows[:limit]
    items = [comment_out(c, me_id) for c in rows]
    return items, (str(rows[-1].id) if has_more and rows else None)


def comment_out(c: CommunityComment, me_id: str, author: Optional[User] = None) -> CommentOut:
    """`author` can be passed when the relationship isn't loaded (e.g. right after inserting the row)."""
    return CommentOut(id=c.id, post_id=c.post_id, author=author_out(author or c.author), body=c.body,
                      created_at=c.created_at, is_mine=c.author_id == me_id)


# ── abuse limits ─────────────────────────────────────────────────────────────

async def count_recent(db: AsyncSession, model, owner_col, user_id: str, minutes: int) -> int:
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    return (await db.execute(
        select(func.count()).select_from(model).where(owner_col == user_id, model.created_at >= since)
    )).scalar_one()
