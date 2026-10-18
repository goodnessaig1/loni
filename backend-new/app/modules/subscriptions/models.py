"""
LoniPlus subscription state, one row per user.

There is no payment provider wired in yet, so the only way in is the free trial (one per user, enforced by
the UNIQUE user_id). Access is always *computed* from the dates (see service.py) instead of being a stored
flag that a background job must flip - a trial that ends while nobody is looking simply stops granting access.
When a provider (Paystack / store billing) is added, its webhook sets `status='active'` and
`current_period_end`; nothing else here has to change.
"""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class Subscription(Base):
    __tablename__ = 'subscriptions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id'), nullable=False, unique=True)
    plan = Column(String(20), nullable=False)                      # 'monthly' | 'annual'
    status = Column(String(20), nullable=False)                    # 'trialing' | 'active' | 'cancelled'
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=False)  # access lasts until here
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_reason = Column(String(50), nullable=True)
    cancel_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
