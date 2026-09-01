from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from sqlalchemy.future import select

from app.modules.driver_training import service
from app.modules.driver_training.onboarding import build_status
from app.modules.driver_training.schemas import (
    AptitudeStatus,
    CompleteModuleRequest,
    ModulesResponse,
    OnboardingStatus,
    PublicQuestion,
    QuestionsResponse,
    SubmitAttemptRequest,
    SubmitAttemptResponse,
    TrainingProgress,
)
from app.modules.users.models import DriverProfile, User, UserTypeEnum

router = APIRouter()

_GATE_RESPONSES = {403: {"description": "A required earlier step is not complete, or the role can't take driver training"}}

# Driver training happens during onboarding, before `user_type` is switched to
# `driver` (that only occurs when the driver profile is submitted). So we only
# block roles that clearly should never take the driver assessment.
_BLOCKED_ROLES = {UserTypeEnum.nurse, UserTypeEnum.partner}


def _require_driver(user: User) -> None:
    if user.user_type in _BLOCKED_ROLES:
        raise HTTPException(status_code=403, detail="This account type cannot take driver training")


def _progress_payload(progress) -> TrainingProgress:
    module_ids = [m["id"] for m in service.get_modules()]
    completed = [mid for mid in module_ids if mid in (progress.completed_modules or [])] if progress else []
    return TrainingProgress(
        completed_modules=completed,
        total_modules=len(module_ids),
        completed=service.training_completed(progress),
    )


@router.post("/start", response_model=OnboardingStatus)
async def start_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Commit to becoming a driver. Flips `user_type` to `driver` (so every later
    sign-in resumes the driver flow) and creates the empty progress/profile rows.
    Idempotent.
    """
    _require_driver(current_user)

    if current_user.user_type == UserTypeEnum.user:
        current_user.user_type = UserTypeEnum.driver
        db.add(current_user)

    await service.get_or_create_progress(db, current_user.id)

    profile = (
        await db.execute(select(DriverProfile).where(DriverProfile.user_id == current_user.id))
    ).scalar_one_or_none()
    if profile is None:
        db.add(DriverProfile(user_id=current_user.id, verification_documents={}))

    await db.commit()
    return await build_status(db, current_user)


@router.get("/onboarding", response_model=OnboardingStatus, responses=_GATE_RESPONSES)
async def onboarding_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Full driver-signup state machine. The mobile app calls this on launch to
    decide which onboarding screen to show; the same object is also returned
    inline on `GET /users/me` as `driver_onboarding`.
    """
    _require_driver(current_user)
    return await build_status(db, current_user)


@router.get("/modules", response_model=ModulesResponse, responses=_GATE_RESPONSES)
async def list_modules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The 5 pre-trip training modules (static content) plus this driver's progress."""
    _require_driver(current_user)
    progress = await service.get_or_create_progress(db, current_user.id)
    await db.commit()
    return ModulesResponse(
        modules=service.get_modules(),
        progress=_progress_payload(progress),
    )


@router.post("/modules/complete", response_model=TrainingProgress, responses=_GATE_RESPONSES)
async def complete_module(
    data: CompleteModuleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark one training module as read. Idempotent; returns updated progress."""
    _require_driver(current_user)
    progress = await service.complete_module(db, current_user.id, data.module_id)
    return _progress_payload(progress)


@router.get("/aptitude/status", response_model=AptitudeStatus, responses=_GATE_RESPONSES)
async def aptitude_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Attempts used/remaining, pass threshold, and whether the driver has passed."""
    _require_driver(current_user)
    return await service.get_status(db, current_user.id)


@router.get(
    "/aptitude/questions",
    response_model=QuestionsResponse,
    responses={
        **_GATE_RESPONSES,
        400: {"description": "The driver has already passed"},
        503: {"description": "Not enough visible questions in the bank yet"},
    },
)
async def aptitude_questions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    A fresh random set of `question_count` questions for a new attempt.
    **The correct answer is never included.** Fails if the driver has no
    attempts left or has already passed.
    """
    _require_driver(current_user)
    questions, status = await service.get_questions(db, current_user.id)
    return QuestionsResponse(
        questions=[
            PublicQuestion(id=q.id, question=q.question, options=q.options, category=q.category)
            for q in questions
        ],
        status=status,
    )


@router.post(
    "/aptitude/submit",
    response_model=SubmitAttemptResponse,
    responses={
        **_GATE_RESPONSES,
        400: {"description": "Already passed, or the payload references unknown questions"},
    },
)
async def submit_aptitude(
    data: SubmitAttemptRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Grade one attempt server-side and record it. Counts against the driver's
    3 attempts. `breakdown` says which answers were right (not what the right
    answer was).
    """
    _require_driver(current_user)
    score, total, passed, breakdown, status = await service.submit_attempt(
        db, current_user.id, data.answers
    )
    return SubmitAttemptResponse(
        score=score,
        total=total,
        passed=passed,
        breakdown=breakdown,
        status=status,
    )
