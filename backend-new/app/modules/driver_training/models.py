from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, ForeignKey, JSON, Text, UniqueConstraint
)
from sqlalchemy.sql import func
from app.core.database import Base


class AptitudeQuestion(Base):
    """
    The "well" of driver aptitude questions. A random subset of the visible
    questions is served to each driver when they take the test.

    The correct answer (`answer_index`) is NEVER exposed through any
    driver-facing endpoint - only admin endpoints and the internal grader
    read it.
    """
    __tablename__ = 'aptitude_questions'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    # Stable human-readable identifier used for idempotent seeding / upserts.
    key = Column(String(100), unique=True, index=True, nullable=False)
    question = Column(Text, nullable=False)
    # List[str] - the answer options shown to the driver, in order.
    options = Column(JSON, nullable=False)
    # Index into `options` of the correct answer.
    answer_index = Column(Integer, nullable=False)
    # Optional grouping (e.g. "understanding", "safety", "pickup").
    category = Column(String(100), nullable=True)
    # Everything is visible by default. Admin can toggle a question off in
    # future without deleting it - hidden questions are never served or graded.
    is_visible = Column(Boolean, default=True, server_default='true', nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class AptitudeAttempt(Base):
    """One graded submission of the aptitude test by a driver."""
    __tablename__ = 'aptitude_attempts'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id'), index=True, nullable=False)
    score = Column(Integer, nullable=False)
    total = Column(Integer, nullable=False)
    passed = Column(Boolean, nullable=False)
    # Snapshot of the attempt: [{question_id, selected_index, correct}]
    breakdown = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DriverTrainingProgress(Base):
    """Per-driver progress through the training modules."""
    __tablename__ = 'driver_training_progress'
    __table_args__ = (UniqueConstraint('user_id', name='uq_driver_training_progress_user'),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id'), index=True, nullable=False)
    # List[str] of completed module ids.
    completed_modules = Column(JSON, default=list, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
