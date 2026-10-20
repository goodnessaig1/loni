"""
Community feed API. Mounted at /api/v1/community.

REST is the source of truth; the shared `/calls/ws` socket carries live updates to clients that
subscribed to the "community" topic (new posts, counter changes, new comments, deletions) so the feed
never has to be polled. A comment also notifies the post's author (Notification Centre row + push).
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.ws_manager import manager as ws_manager
from app.modules.community import service
from app.modules.community.models import CommunityComment, CommunityPost, CommunityPostStats
from app.modules.community.view_buffer import flush_once, run_flusher, view_buffer
from app.modules.community.schemas import (
    CommentsOut, CreateCommentIn, CreatePostIn, FeedOut, LikeOut, PostOut, RecordViewsIn, StatsOut,
)
from app.modules.notifications.models import NotificationLog
from app.modules.notifications.service import NotificationService
from app.modules.users.models import User

logger = logging.getLogger("community")
router = APIRouter()

TOPIC = "community"
MAX_IMAGE_BYTES = 8 * 1024 * 1024
POSTS_PER_HOUR = 10
COMMENTS_PER_10_MIN = 30

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
)


def _ok(data: dict, message: Optional[str] = None) -> dict:
    return {"success": True, "message": message, "data": data}


def _is_own_cloudinary_url(url: str) -> bool:
    """Only accept images we uploaded ourselves - never an arbitrary hot-linked URL."""
    cloud = settings.CLOUDINARY_CLOUD_NAME
    return bool(cloud) and url.startswith(f"https://res.cloudinary.com/{cloud}/")


async def _broadcast_stats(db: AsyncSession, post_id: int) -> None:
    post = await service.get_post(db, post_id)
    if not post:
        return
    stats = StatsOut(post_id=post.id, like_count=post.like_count,
                     comment_count=post.comment_count, view_count=post.view_count)
    await ws_manager.broadcast_topic(TOPIC, "community_post_stats", stats.model_dump())


@router.get("/posts")
async def feed(
    cursor: Optional[str] = None,
    limit: int = Query(10, ge=1, le=service.MAX_PAGE),
    q: Optional[str] = Query(None, max_length=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, next_cursor = await service.list_feed(db, current_user.id, cursor, limit, q)
    return _ok(FeedOut(items=items, next_cursor=next_cursor).model_dump(mode="json"))


@router.post("/images")
async def upload_image(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if not (image.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Please choose an image file")
    image.file.seek(0, 2)
    size = image.file.tell()
    image.file.seek(0)
    if size > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="That image is too large (max 8 MB)")
    result = await asyncio.to_thread(
        cloudinary.uploader.upload,
        image.file,
        folder="loni/community",
        # Cap the stored size and let Cloudinary pick the format/quality: smaller feed, faster loads.
        transformation=[{"width": 1600, "height": 1600, "crop": "limit", "quality": "auto", "fetch_format": "auto"}],
    )
    return _ok({"url": result.get("secure_url")}, "Image uploaded")


@router.post("/posts", status_code=201)
async def create_post(
    payload: CreatePostIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not payload.body and not payload.image_url:
        raise HTTPException(status_code=400, detail="Write something or add an image first")
    if payload.image_url and not _is_own_cloudinary_url(payload.image_url):
        raise HTTPException(status_code=400, detail="Invalid image")
    if await service.count_recent(db, CommunityPost, CommunityPost.author_id, current_user.id, 60) >= POSTS_PER_HOUR:
        raise HTTPException(status_code=429, detail="You're posting a lot - please try again a little later")

    # created_at is set here (microsecond precision) rather than by the DB default so keyset pagination
    # on (created_at, id) has a stable, exactly comparable key on every database.
    post = CommunityPost(author_id=current_user.id, body=payload.body, image_url=payload.image_url,
                         created_at=datetime.now(timezone.utc), stats=CommunityPostStats())
    db.add(post)
    await db.commit()
    post = await service.get_post(db, post.id)
    out = (await service.serialize_posts(db, [post], current_user.id))[0]

    # Everyone else on the feed gets it live (the author already has it from this response).
    broadcast = out.model_dump(mode="json", exclude={"liked_by_me", "is_mine"})
    await ws_manager.broadcast_topic(TOPIC, "community_post_created", broadcast, exclude={current_user.id})
    return _ok(out.model_dump(mode="json"), "Posted")


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await service.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")
    post.deleted_at = func.now()  # type: ignore[assignment]
    await db.commit()
    await ws_manager.broadcast_topic(TOPIC, "community_post_deleted", {"post_id": post_id})
    return _ok({"post_id": post_id}, "Post deleted")


async def _like(post_id: int, liked: bool, current_user: User, db: AsyncSession) -> dict:
    post = await service.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    is_liked, count = await service.set_like(db, post, current_user.id, liked)
    await _broadcast_stats(db, post_id)
    return _ok(LikeOut(liked=is_liked, like_count=count).model_dump())


@router.post("/posts/{post_id}/like")
async def like_post(post_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Idempotent: liking twice leaves it liked. Returns the authoritative state and count."""
    return await _like(post_id, True, current_user, db)


@router.delete("/posts/{post_id}/like")
async def unlike_post(post_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _like(post_id, False, current_user, db)


@router.get("/posts/{post_id}/comments")
async def comments(
    post_id: int,
    cursor: Optional[str] = None,
    limit: int = Query(20, ge=1, le=service.MAX_PAGE),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await service.get_post(db, post_id):
        raise HTTPException(status_code=404, detail="Post not found")
    items, next_cursor = await service.list_comments(db, post_id, current_user.id, cursor, limit)
    return _ok(CommentsOut(items=items, next_cursor=next_cursor).model_dump(mode="json"))


@router.post("/posts/{post_id}/comments", status_code=201)
async def create_comment(
    post_id: int,
    payload: CreateCommentIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await service.get_post(db, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if await service.count_recent(db, CommunityComment, CommunityComment.author_id, current_user.id, 10) >= COMMENTS_PER_10_MIN:
        raise HTTPException(status_code=429, detail="Slow down a little - you're commenting very quickly")

    comment = await service.add_comment(db, post, current_user, payload.body)
    out = service.comment_out(comment, current_user.id, author=current_user)

    await ws_manager.broadcast_topic(
        TOPIC, "community_comment_created",
        {**out.model_dump(mode="json", exclude={"is_mine"})},
    )
    await _broadcast_stats(db, post_id)

    # Tell the author (unless they commented on their own post).
    if post.author_id != current_user.id:
        title = f"{service.first_name(current_user.name)} commented on your post"
        snippet = payload.body if len(payload.body) <= 90 else payload.body[:87] + "..."
        data = {"type": "community_comment", "post_id": post_id, "comment_id": comment.id}
        db.add(NotificationLog(user_id=post.author_id, type="community_comment", title=title, body=snippet, data=data))
        await db.commit()
        try:
            await ws_manager.send_to_user(post.author_id, "community_comment", {**data, "title": title, "body": snippet})
            await NotificationService.notify_user(post.author_id, title, snippet, data)
        except Exception as e:  # a failed push must never fail the comment itself
            logger.warning("community comment notification failed: %s", e)
    return _ok(out.model_dump(mode="json"), "Comment added")


@router.post("/views")
async def record_views(
    payload: RecordViewsIn,
    current_user: User = Depends(get_current_user),
):
    """Batch of post ids the user has had on screen. Queued and counted within a few seconds (see
    view_buffer.py): one view per person per post, own posts don't count."""
    queued = view_buffer.add(current_user.id, payload.post_ids)
    return _ok({"queued": queued})


async def _broadcast_view_stats(post_ids: list) -> None:
    async with AsyncSessionLocal() as db:
        for pid in post_ids:
            await _broadcast_stats(db, pid)


_flusher: Optional[asyncio.Task] = None


def start_view_flusher() -> None:
    """Called from app startup: applies buffered views to the database every few seconds."""
    global _flusher
    if _flusher is None or _flusher.done():
        _flusher = asyncio.create_task(run_flusher(AsyncSessionLocal, on_changed=_broadcast_view_stats))


async def stop_view_flusher() -> None:
    """Called from app shutdown: stop the loop, then write whatever is still buffered."""
    global _flusher
    if _flusher:
        _flusher.cancel()
        try:
            await _flusher
        except asyncio.CancelledError:
            pass
        _flusher = None
    await flush_once(AsyncSessionLocal, on_changed=_broadcast_view_stats)
