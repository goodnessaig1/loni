"""Run a periodic job on only one API process at a time (Postgres advisory lock; always runs on SQLite)."""
from contextlib import asynccontextmanager

from sqlalchemy import text

from app.core.database import engine


@asynccontextmanager
async def leader(lock_key: int):
    """`async with leader(KEY) as ok:` - ok is False when another process holds the job right now."""
    async with engine.connect() as conn:
        pg = conn.dialect.name == "postgresql"
        ok = True
        if pg:
            ok = bool((await conn.execute(text("select pg_try_advisory_lock(:k)"), {"k": lock_key})).scalar())
        try:
            yield ok
        finally:
            if pg and ok:
                await conn.execute(text("select pg_advisory_unlock(:k)"), {"k": lock_key})
                await conn.commit()
