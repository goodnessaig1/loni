"""Seed the driver aptitude question bank.

Idempotent: run it any time. New questions (by `key`) are inserted, existing
ones have their text/options/answer refreshed. An admin's manual `is_visible`
choice is preserved on re-seed.

Usage:
    python -m app.scripts.seed_aptitude_questions
"""
import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

load_dotenv(
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"
    )
)

from app.core.database import AsyncSessionLocal
from app.modules.driver_training.seeds import load_aptitude_questions
from app.modules.driver_training.service import seed_questions


async def main():
    questions = load_aptitude_questions()
    async with AsyncSessionLocal() as db:
        summary = await seed_questions(db, questions)
    print(
        f"Aptitude question bank seeded: "
        f"{summary['created']} created, {summary['updated']} updated "
        f"({summary['total']} total)."
    )


if __name__ == "__main__":
    asyncio.run(main())
