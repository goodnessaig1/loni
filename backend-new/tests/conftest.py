"""Shared fixtures: an in-memory SQLite database and an ASGI client that authenticates as a chosen user."""
import itertools

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user
from app.core.database import Base, get_db
from app.main import app as fastapi_app
from app.modules.notifications.service import NotificationService
from app.modules.users.models import User

import app.modules.auth.models  # noqa: F401  (register every table on Base.metadata)
import app.modules.account.models  # noqa: F401
import app.modules.calls.models  # noqa: F401
import app.modules.care.models  # noqa: F401
import app.modules.checkins.models  # noqa: F401
import app.modules.subscriptions.models  # noqa: F401
import app.modules.community.models  # noqa: F401
import app.modules.driver_training.models  # noqa: F401
import app.modules.health.models  # noqa: F401
import app.modules.notifications.models  # noqa: F401
import app.modules.rides.models  # noqa: F401
import app.modules.staff.models  # noqa: F401
import app.modules.admin.models  # noqa: F401

_ids = itertools.count(1)


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def session_factory():
    engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    await engine.dispose()


@pytest.fixture
async def make_user(session_factory):
    async def _make(name: str) -> User:
        n = next(_ids)
        async with session_factory() as s:
            user = User(id=f"u{n:010d}", name=name, email=f"u{n}@example.com", password="x", referral_code=f"REF{n}")
            s.add(user)
            await s.commit()
            return user
    return _make


@pytest.fixture(autouse=True)
def _no_redis(monkeypatch):
    """Tests never touch a real Redis (a developer's .env may set REDIS_URL): limits count in memory."""
    from app.core import ratelimit
    from app.core.config import settings
    monkeypatch.setattr(settings, "REDIS_URL", None)
    monkeypatch.setattr(ratelimit, "_redis", None)
    monkeypatch.setattr(ratelimit, "_local", {})


@pytest.fixture(autouse=True)
def _no_push(monkeypatch):
    """Pushes go through Firebase/Mongo; the tests only care that the service is asked to send one."""
    sent = []

    async def fake_notify(user_id, title, body, data=None):
        sent.append((user_id, title, body, data))

    monkeypatch.setattr(NotificationService, "notify_user", staticmethod(fake_notify))
    return sent


@pytest.fixture
async def client_for(session_factory):
    """`client = await client_for(user)` -> an httpx client whose requests are authenticated as `user`."""
    clients = []

    async def _client(user: User) -> httpx.AsyncClient:
        async def _db():
            async with session_factory() as s:
                yield s

        async def _me():
            async with session_factory() as s:
                return await s.get(User, user.id)

        # One override set per request would be ideal; tests run single-user at a time via `as_user`.
        fastapi_app.dependency_overrides[get_db] = _db
        fastapi_app.dependency_overrides[get_current_user] = _me
        c = httpx.AsyncClient(transport=httpx.ASGITransport(app=fastapi_app), base_url="http://test")
        clients.append(c)
        return c

    yield _client
    for c in clients:
        await c.aclose()
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
def as_user(client_for):
    async def _as(user: User):
        return await client_for(user)
    return _as
