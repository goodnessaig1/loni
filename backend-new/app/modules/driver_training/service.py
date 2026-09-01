import random
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.driver_training.models import (
    AptitudeAttempt,
    AptitudeQuestion,
    DriverTrainingProgress,
)
from app.modules.driver_training.schemas import AptitudeStatus
from app.modules.driver_training.seeds import load_training_modules


# ---------------------------------------------------------------------------
# Training modules
# ---------------------------------------------------------------------------
def get_modules() -> list:
    return load_training_modules()


def _module_ids() -> List[str]:
    return [m["id"] for m in load_training_modules()]


async def get_or_create_progress(db: AsyncSession, user_id: str) -> DriverTrainingProgress:
    result = await db.execute(
        select(DriverTrainingProgress).where(DriverTrainingProgress.user_id == user_id)
    )
    progress = result.scalar_one_or_none()
    if progress is None:
        progress = DriverTrainingProgress(user_id=user_id, completed_modules=[])
        db.add(progress)
        await db.flush()
    return progress


async def complete_module(db: AsyncSession, user_id: str, module_id: str) -> DriverTrainingProgress:
    valid_ids = _module_ids()
    if module_id not in valid_ids:
        raise HTTPException(status_code=404, detail="Unknown training module")

    progress = await get_or_create_progress(db, user_id)
    completed = list(progress.completed_modules or [])
    if module_id not in completed:
        completed.append(module_id)
    # Keep stored order aligned with module order.
    progress.completed_modules = [mid for mid in valid_ids if mid in completed]

    if set(valid_ids).issubset(set(progress.completed_modules)) and progress.completed_at is None:
        progress.completed_at = datetime.now(timezone.utc)

    db.add(progress)
    await db.commit()
    await db.refresh(progress)
    return progress


def training_completed(progress: Optional[DriverTrainingProgress]) -> bool:
    if progress is None:
        return False
    return set(_module_ids()).issubset(set(progress.completed_modules or []))


# ---------------------------------------------------------------------------
# Aptitude test
# ---------------------------------------------------------------------------
async def _visible_questions(db: AsyncSession) -> List[AptitudeQuestion]:
    result = await db.execute(
        select(AptitudeQuestion).where(AptitudeQuestion.is_visible.is_(True))
    )
    return list(result.scalars().all())


async def get_status(db: AsyncSession, user_id: str) -> AptitudeStatus:
    result = await db.execute(
        select(AptitudeAttempt).where(AptitudeAttempt.user_id == user_id)
    )
    attempts = list(result.scalars().all())

    attempts_used = len(attempts)
    passed = any(a.passed for a in attempts)
    best_score = max((a.score for a in attempts), default=None)
    attempts_remaining = max(0, settings.APTITUDE_MAX_ATTEMPTS - attempts_used)
    can_attempt = (not passed) and attempts_remaining > 0

    return AptitudeStatus(
        attempts_used=attempts_used,
        attempts_remaining=attempts_remaining,
        max_attempts=settings.APTITUDE_MAX_ATTEMPTS,
        question_count=settings.APTITUDE_QUESTION_COUNT,
        pass_score=settings.APTITUDE_PASS_SCORE,
        passed=passed,
        best_score=best_score,
        can_attempt=can_attempt,
    )


async def get_questions(db: AsyncSession, user_id: str):
    status = await get_status(db, user_id)
    if not status.can_attempt:
        if status.passed:
            raise HTTPException(status_code=400, detail="You have already passed the aptitude test")
        raise HTTPException(status_code=403, detail="No attempts remaining for the aptitude test")

    questions = await _visible_questions(db)
    if len(questions) < settings.APTITUDE_QUESTION_COUNT:
        raise HTTPException(
            status_code=503,
            detail="The aptitude test is not available yet. Please try again later.",
        )

    selected = random.sample(questions, settings.APTITUDE_QUESTION_COUNT)
    random.shuffle(selected)
    return selected, status


async def submit_attempt(db: AsyncSession, user_id: str, answers):
    status = await get_status(db, user_id)
    if not status.can_attempt:
        if status.passed:
            raise HTTPException(status_code=400, detail="You have already passed the aptitude test")
        raise HTTPException(status_code=403, detail="No attempts remaining for the aptitude test")

    answer_map = {a.question_id: a.selected_index for a in answers}
    if not answer_map:
        raise HTTPException(status_code=400, detail="No answers submitted")

    result = await db.execute(
        select(AptitudeQuestion).where(AptitudeQuestion.id.in_(list(answer_map.keys())))
    )
    questions = {q.id: q for q in result.scalars().all()}

    unknown = set(answer_map.keys()) - set(questions.keys())
    if unknown:
        raise HTTPException(status_code=400, detail="Submission contains unknown questions")

    total = len(answer_map)
    breakdown = []
    score = 0
    for qid, selected_index in answer_map.items():
        question = questions[qid]
        is_correct = selected_index == question.answer_index
        if is_correct:
            score += 1
        breakdown.append(
            {"question_id": qid, "selected_index": selected_index, "correct": is_correct}
        )

    passed = score >= settings.APTITUDE_PASS_SCORE

    attempt = AptitudeAttempt(
        user_id=user_id,
        score=score,
        total=total,
        passed=passed,
        breakdown=breakdown,
    )
    db.add(attempt)
    await db.commit()

    new_status = await get_status(db, user_id)
    return score, total, passed, breakdown, new_status


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------
async def seed_questions(db: AsyncSession, questions: list) -> dict:
    """Idempotent upsert of the bundled question bank, keyed on `key`."""
    created = 0
    updated = 0
    for item in questions:
        if not (0 <= item["answer_index"] < len(item["options"])):
            raise ValueError(f"answer_index out of range for question '{item['key']}'")

        result = await db.execute(
            select(AptitudeQuestion).where(AptitudeQuestion.key == item["key"])
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.question = item["question"]
            existing.options = item["options"]
            existing.answer_index = item["answer_index"]
            existing.category = item.get("category")
            # Do not clobber an admin's manual visibility choice on re-seed.
            updated += 1
        else:
            db.add(
                AptitudeQuestion(
                    key=item["key"],
                    question=item["question"],
                    options=item["options"],
                    answer_index=item["answer_index"],
                    category=item.get("category"),
                    is_visible=item.get("is_visible", True),
                )
            )
            created += 1
    await db.commit()
    return {"created": created, "updated": updated, "total": created + updated}
