"""
Per-user request limits for the expensive / abusable endpoints (starting calls and rides, GPS pings,
support messages, AI messages). Fixed windows, counted in Redis when REDIS_URL is set (shared by all
processes), otherwise in this process. Exceeding a limit returns 429 with a plain message.
"""
import time
from typing import Dict, Tuple

from fastapi import Depends, HTTPException

from app.api.deps import get_current_user
from app.core.config import settings
from app.modules.users.models import User

_local: Dict[str, Tuple[int, float]] = {}
_redis = None


def _client():
    global _redis
    if _redis is None and settings.REDIS_URL:
        import redis.asyncio as aioredis
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def hit(key: str, limit: int, window: int) -> bool:
    """Count one request; False when over the limit for this window."""
    r = _client()
    if r is not None:
        try:
            k = f"rl:{key}:{int(time.time() // window)}"
            n = await r.incr(k)
            if n == 1:
                await r.expire(k, window + 1)
            return n <= limit
        except Exception:
            pass  # Redis unavailable: fall back to this process's count
    now = time.time()
    count, start = _local.get(key, (0, now))
    if now - start >= window:
        count, start = 0, now
    count += 1
    _local[key] = (count, start)
    if len(_local) > 50_000:  # keep memory bounded
        for k in [k for k, (_, s) in _local.items() if now - s >= 3600]:
            _local.pop(k, None)
    return count <= limit


def limit(name: str, max_requests: int, window_seconds: int, message: str = "Too many requests. Please wait a moment and try again."):
    """FastAPI dependency: `Depends(limit("calls.request", 10, 60))`."""
    async def _dep(current_user: User = Depends(get_current_user)) -> None:
        if not settings.RATE_LIMITS_ENABLED:
            return
        if not await hit(f"{name}:{current_user.id}", max_requests, window_seconds):
            raise HTTPException(status_code=429, detail=message)
    return _dep
