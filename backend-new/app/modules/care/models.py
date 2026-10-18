"""Per-mother care state. The *content* (tasks, meals, bag items, articles) is curated copy in content.py;
only what a mother ticks off is stored."""
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, Index
from sqlalchemy.sql import func

from app.core.database import Base


class CareTaskLog(Base):
    """One row = "this task was done on this day". Un-ticking deletes the row."""
    __tablename__ = 'care_task_logs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id'), nullable=False)
    task_key = Column(String(50), nullable=False)
    day = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'task_key', 'day', name='uq_care_task_user_key_day'),
        Index('ix_care_task_user_day', 'user_id', 'day'),
    )


class HospitalBagCheck(Base):
    """Items packed. Not tied to a day - the bag is packed once."""
    __tablename__ = 'hospital_bag_checks'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id'), nullable=False)
    item_key = Column(String(50), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint('user_id', 'item_key', name='uq_hospital_bag_user_item'),)
