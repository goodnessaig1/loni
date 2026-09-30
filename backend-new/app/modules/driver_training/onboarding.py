"""
Driver onboarding state machine.

Single source of truth for "where is this driver in the signup funnel". The
mobile app calls `GET /driver-training/onboarding` (and reads the same block off
`/users/me`) to decide which screen to show on every launch, so a half-finished
driver always resumes exactly where they left off.

Step order:
    training -> aptitude -> personal -> vehicle -> documents -> under_review -> approved
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.driver_training.models import AptitudeAttempt, DriverTrainingProgress
from app.modules.driver_training.service import training_completed
from app.modules.users.models import AccountStatusEnum, DriverProfile, User

STEP_ORDER = ["training", "aptitude", "personal", "vehicle", "documents"]

STEP_LABELS = {
    "training": "Driver training",
    "aptitude": "Aptitude test",
    "personal": "Personal information",
    "vehicle": "Vehicle information",
    "documents": "Document upload",
}

_REQUIRED_VEHICLE_FIELDS = (
    "vehicle_type",
    "has_ac",
    "vehicle_brand",
    "vehicle_year",
    "vehicle_model",
    "plate_number",
    "vehicle_color",
)
_REQUIRED_VEHICLE_PHOTOS = ("front_view", "back_view", "vin", "interior")
_REQUIRED_DOCUMENTS = ("driver_license", "government_id", "vehicle_papers")


def _personal_complete(profile: Optional[DriverProfile]) -> bool:
    return bool(
        profile
        and profile.full_name
        and profile.date_of_birth
        and profile.profile_photo
    )


def _vehicle_complete(profile: Optional[DriverProfile]) -> bool:
    if not profile:
        return False
    for field in _REQUIRED_VEHICLE_FIELDS:
        if getattr(profile, field) in (None, ""):
            return False
    docs = profile.verification_documents or {}
    return all(docs.get(k) for k in _REQUIRED_VEHICLE_PHOTOS)


def _documents_complete(profile: Optional[DriverProfile]) -> bool:
    if not profile:
        return False
    docs = profile.verification_documents or {}
    return all(docs.get(k) for k in _REQUIRED_DOCUMENTS)


async def build_status(db: AsyncSession, user: User) -> dict:
    progress = (
        await db.execute(
            select(DriverTrainingProgress).where(DriverTrainingProgress.user_id == user.id)
        )
    ).scalar_one_or_none()

    attempts = (
        await db.execute(
            select(AptitudeAttempt).where(AptitudeAttempt.user_id == user.id)
        )
    ).scalars().all()

    profile = (
        await db.execute(select(DriverProfile).where(DriverProfile.user_id == user.id))
    ).scalar_one_or_none()

    complete = {
        "training": training_completed(progress),
        "aptitude": any(a.passed for a in attempts),
        "personal": _personal_complete(profile),
        "vehicle": _vehicle_complete(profile),
        "documents": _documents_complete(profile),
    }

    submitted = bool(profile and profile.submitted_at)
    account_active = user.account_status == AccountStatusEnum.active
    all_steps_done = all(complete[s] for s in STEP_ORDER)

    if account_active:
        current_step = "approved"
    elif submitted:
        current_step = "under_review"
    else:
        current_step = next((s for s in STEP_ORDER if not complete[s]), "documents")

    return {
        "current_step": current_step,
        "steps": [
            {"key": s, "label": STEP_LABELS[s], "complete": complete[s]}
            for s in STEP_ORDER
        ],
        "can_submit": all_steps_done and not submitted,
        "submitted": submitted,
        "account_status": user.account_status.value if user.account_status else "pending",
    }


def require_step(status: dict, step: str) -> None:
    """Raise 403 unless every step *before* `step` is complete."""
    from fastapi import HTTPException

    done = {s["key"]: s["complete"] for s in status["steps"]}
    idx = STEP_ORDER.index(step)
    for prior in STEP_ORDER[:idx]:
        if not done.get(prior):
            raise HTTPException(
                status_code=403,
                detail=f"Complete the '{STEP_LABELS[prior]}' step first",
            )
