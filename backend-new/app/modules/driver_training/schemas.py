from typing import List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Driver-facing schemas (NEVER include the correct answer)
# ---------------------------------------------------------------------------
class PublicQuestion(BaseModel):
    """A single aptitude question as shown to the driver - no correct answer."""

    id: int = Field(description="Question id - echo this back in the submit payload")
    question: str
    options: List[str] = Field(description="Answer choices in display order")
    category: Optional[str] = None


class AptitudeStatus(BaseModel):
    attempts_used: int = Field(description="Graded attempts this driver has already made")
    attempts_remaining: int
    max_attempts: int = Field(description="Total attempts allowed (config: APTITUDE_MAX_ATTEMPTS)")
    question_count: int = Field(description="Questions served per attempt (config: APTITUDE_QUESTION_COUNT)")
    pass_score: int = Field(description="Minimum correct answers to pass (config: APTITUDE_PASS_SCORE)")
    passed: bool
    best_score: Optional[int] = Field(default=None, description="Highest score across all attempts")
    can_attempt: bool = Field(description="False once the driver has passed or run out of attempts")


class QuestionsResponse(BaseModel):
    questions: List[PublicQuestion]
    status: AptitudeStatus


class SubmittedAnswer(BaseModel):
    question_id: int
    selected_index: int = Field(description="0-based index into that question's `options`")


class SubmitAttemptRequest(BaseModel):
    answers: List[SubmittedAnswer] = Field(..., min_length=1)


class AttemptResultItem(BaseModel):
    question_id: int
    selected_index: Optional[int]
    correct: bool = Field(description="Whether the choice was right - the correct index is never returned")


class SubmitAttemptResponse(BaseModel):
    score: int
    total: int
    passed: bool
    breakdown: List[AttemptResultItem]
    status: AptitudeStatus


class CompleteModuleRequest(BaseModel):
    module_id: str = Field(description="`id` of the module from GET /driver-training/modules")


class TrainingProgress(BaseModel):
    completed_modules: List[str] = Field(description="Module ids the driver has finished, in order")
    total_modules: int
    completed: bool = Field(description="True once every module is complete")


class TrainingModuleSection(BaseModel):
    title: str
    body: Optional[str] = None
    bullets: Optional[List[str]] = None
    note: Optional[str] = None


class TrainingModule(BaseModel):
    id: str
    order: int
    title: str
    subtitle: str
    icon: str = Field(description="Asset key the app maps to a bundled image")
    hero: str = Field(description="Asset key for the module's hero image")
    layout: str = Field(description='"checklist" (tappable checkpoints) or "reading" (static sections)')
    sections: List[TrainingModuleSection]


class ModulesResponse(BaseModel):
    modules: List[TrainingModule]
    progress: TrainingProgress


class OnboardingStep(BaseModel):
    key: str = Field(description="training | aptitude | personal | vehicle | documents")
    label: str
    complete: bool


class OnboardingStatus(BaseModel):
    """The driver signup state machine - drives which screen the app shows."""

    current_step: str = Field(
        description="training | aptitude | personal | vehicle | documents | under_review | approved"
    )
    steps: List[OnboardingStep]
    can_submit: bool = Field(description="True when every step is done and the application has not been submitted")
    submitted: bool
    account_status: str = Field(description="pending | active | suspended")


# ---------------------------------------------------------------------------
# Admin schemas (include the correct answer)
# ---------------------------------------------------------------------------
class AdminQuestion(BaseModel):
    id: int
    key: str
    question: str
    options: List[str]
    answer_index: int
    category: Optional[str] = None
    is_visible: bool

    model_config = {"from_attributes": True}


class CreateQuestionRequest(BaseModel):
    key: str = Field(..., min_length=1, max_length=100, description="Stable unique id, used for idempotent seeding")
    question: str = Field(..., min_length=1)
    options: List[str] = Field(..., min_length=2)
    answer_index: int = Field(..., ge=0, description="0-based index of the correct option")
    category: Optional[str] = None
    is_visible: bool = True


class UpdateQuestionRequest(BaseModel):
    question: Optional[str] = Field(None, min_length=1)
    options: Optional[List[str]] = Field(None, min_length=2)
    answer_index: Optional[int] = Field(None, ge=0)
    category: Optional[str] = None
    is_visible: Optional[bool] = None


class ToggleVisibilityRequest(BaseModel):
    is_visible: bool = Field(description="Hidden questions are never served to drivers or graded")
