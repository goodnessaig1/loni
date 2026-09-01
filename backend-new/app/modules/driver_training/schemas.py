from typing import List, Optional, Any
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Driver-facing schemas (NEVER include the correct answer)
# ---------------------------------------------------------------------------
class PublicQuestion(BaseModel):
    id: int
    question: str
    options: List[str]
    category: Optional[str] = None


class AptitudeStatus(BaseModel):
    attempts_used: int
    attempts_remaining: int
    max_attempts: int
    question_count: int
    pass_score: int
    passed: bool
    best_score: Optional[int] = None
    can_attempt: bool


class QuestionsResponse(BaseModel):
    questions: List[PublicQuestion]
    status: AptitudeStatus


class SubmittedAnswer(BaseModel):
    question_id: int
    selected_index: int


class SubmitAttemptRequest(BaseModel):
    answers: List[SubmittedAnswer] = Field(..., min_length=1)


class AttemptResultItem(BaseModel):
    question_id: int
    selected_index: Optional[int]
    correct: bool


class SubmitAttemptResponse(BaseModel):
    score: int
    total: int
    passed: bool
    breakdown: List[AttemptResultItem]
    status: AptitudeStatus


class CompleteModuleRequest(BaseModel):
    module_id: str


class TrainingProgress(BaseModel):
    completed_modules: List[str]
    total_modules: int
    completed: bool


class ModulesResponse(BaseModel):
    modules: List[Any]
    progress: TrainingProgress


class OnboardingStep(BaseModel):
    key: str
    label: str
    complete: bool


class OnboardingStatus(BaseModel):
    current_step: str
    steps: List[OnboardingStep]
    can_submit: bool
    submitted: bool
    account_status: str


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
    key: str = Field(..., min_length=1, max_length=100)
    question: str = Field(..., min_length=1)
    options: List[str] = Field(..., min_length=2)
    answer_index: int = Field(..., ge=0)
    category: Optional[str] = None
    is_visible: bool = True


class UpdateQuestionRequest(BaseModel):
    question: Optional[str] = Field(None, min_length=1)
    options: Optional[List[str]] = Field(None, min_length=2)
    answer_index: Optional[int] = Field(None, ge=0)
    category: Optional[str] = None
    is_visible: Optional[bool] = None


class ToggleVisibilityRequest(BaseModel):
    is_visible: bool
