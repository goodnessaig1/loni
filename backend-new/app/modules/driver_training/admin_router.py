from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.api.deps import get_admin_user
from app.core.database import get_db
from app.modules.driver_training import service
from app.modules.driver_training.models import AptitudeAttempt, AptitudeQuestion
from app.modules.driver_training.schemas import (
    AdminQuestion,
    CreateQuestionRequest,
    ToggleVisibilityRequest,
    UpdateQuestionRequest,
)
from app.modules.driver_training.seeds import load_aptitude_questions
from app.modules.users.models import User

router = APIRouter()


def _validate_answer_index(answer_index: int, options: List[str]) -> None:
    if not (0 <= answer_index < len(options)):
        raise HTTPException(status_code=400, detail="answer_index is out of range for the given options")


@router.get("/questions", response_model=List[AdminQuestion])
async def list_questions(
    is_visible: Optional[bool] = Query(None),
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    query = select(AptitudeQuestion).order_by(AptitudeQuestion.id)
    if is_visible is not None:
        query = query.where(AptitudeQuestion.is_visible.is_(is_visible))
    if category:
        query = query.where(AptitudeQuestion.category == category)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("/questions", response_model=AdminQuestion, status_code=201)
async def create_question(
    data: CreateQuestionRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    _validate_answer_index(data.answer_index, data.options)
    existing = await db.execute(select(AptitudeQuestion).where(AptitudeQuestion.key == data.key))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A question with this key already exists")

    question = AptitudeQuestion(
        key=data.key,
        question=data.question,
        options=data.options,
        answer_index=data.answer_index,
        category=data.category,
        is_visible=data.is_visible,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


@router.patch("/questions/{question_id}", response_model=AdminQuestion)
async def update_question(
    question_id: int,
    data: UpdateQuestionRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(AptitudeQuestion).where(AptitudeQuestion.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    payload = data.model_dump(exclude_unset=True)
    options = payload.get("options", question.options)
    answer_index = payload.get("answer_index", question.answer_index)
    _validate_answer_index(answer_index, options)

    for key, value in payload.items():
        setattr(question, key, value)

    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


@router.patch("/questions/{question_id}/visibility", response_model=AdminQuestion)
async def toggle_question_visibility(
    question_id: int,
    data: ToggleVisibilityRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(AptitudeQuestion).where(AptitudeQuestion.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    question.is_visible = data.is_visible
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return question


@router.delete("/questions/{question_id}", status_code=204)
async def delete_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(AptitudeQuestion).where(AptitudeQuestion.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.delete(question)
    await db.commit()


@router.post("/questions/seed")
async def seed_questions(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Seed / refresh the bundled question bank. Safe to run any time."""
    summary = await service.seed_questions(db, load_aptitude_questions())
    return {"success": True, "message": "Question bank seeded", "data": summary}


@router.get("/attempts")
async def list_attempts(
    user_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    query = select(AptitudeAttempt).order_by(AptitudeAttempt.created_at.desc())
    if user_id:
        query = query.where(AptitudeAttempt.user_id == user_id)
    result = await db.execute(query)
    attempts = result.scalars().all()
    return {
        "success": True,
        "data": {
            "attempts": [
                {
                    "id": a.id,
                    "user_id": a.user_id,
                    "score": a.score,
                    "total": a.total,
                    "passed": a.passed,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in attempts
            ]
        },
    }
