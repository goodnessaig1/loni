"""Bring the database up to the latest Alembic migration when the app starts, so a deploy can't run new code on an old schema."""
import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.core.database import engine

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "db" / "migrations"
MIGRATION_LOCK_KEY = 73520419


def alembic_config() -> Config:
    # Built here rather than read from alembic.ini: that file is gitignored, so deploys don't have it.
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR).replace("%", "%%"))
    # env.py would otherwise replace the logging setup of the running server.
    config.attributes["configure_logger"] = False
    return config


def _upgrade_to_head() -> None:
    command.upgrade(alembic_config(), "head")


async def run_migrations() -> None:
    """Waits for its turn: with several workers one migrates, the rest then find nothing to do. Raises if a migration fails."""
    print("Checking database migrations...")
    async with engine.connect() as conn:
        pg = conn.dialect.name == "postgresql"
        if pg:
            await conn.execute(text("select pg_advisory_lock(:k)"), {"k": MIGRATION_LOCK_KEY})
            await conn.commit()
        try:
            # In a thread because env.py starts its own event loop.
            await asyncio.to_thread(_upgrade_to_head)
        finally:
            if pg:
                await conn.execute(text("select pg_advisory_unlock(:k)"), {"k": MIGRATION_LOCK_KEY})
                await conn.commit()
    print("Database migrations are up to date.")
