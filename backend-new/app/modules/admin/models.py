"""Admin-portal records: decisions taken on app accounts, and the notification feed staff see."""
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class AccountReview(Base):
    """One decision on an app account (approve, request changes, reject, suspend, reactivate) and why."""
    __tablename__ = 'account_reviews'
    __table_args__ = (Index('ix_account_reviews_user', 'user_id', 'id'),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    staff_id = Column(String(12), ForeignKey('staff.id', ondelete='SET NULL'), nullable=True)
    # approved | changes_requested | rejected | suspended | reactivated
    action = Column(String(30), nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AdminNotification(Base):
    """Something staff should know about. Only staff holding `permission` see it."""
    __tablename__ = 'admin_notifications'
    __table_args__ = (Index('ix_admin_notifications_created', 'created_at'),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    category = Column(String(20), nullable=False)       # 'operational' (needs action) | 'system' (record of what happened)
    kind = Column(String(40), nullable=False)           # e.g. nurse_application, account_decision
    title = Column(String(160), nullable=False)
    body = Column(String(500), nullable=True)
    link = Column(String(255), nullable=True)           # portal path, e.g. /nurses?open=abc
    permission = Column(String(40), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AdminNotificationRead(Base):
    __tablename__ = 'admin_notification_reads'

    notification_id = Column(Integer, ForeignKey('admin_notifications.id', ondelete='CASCADE'), primary_key=True)
    staff_id = Column(String(12), ForeignKey('staff.id', ondelete='CASCADE'), primary_key=True)
    read_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RidePayout(Base):
    """What LONI owes a driver for one completed ride, and when staff confirmed it was paid.
    A completed ride with no row is still pending."""
    __tablename__ = 'ride_payouts'

    ride_id = Column(Integer, ForeignKey('rides.id', ondelete='CASCADE'), primary_key=True)
    status = Column(String(20), nullable=False, default='paid')   # paid (pending = no row yet)
    amount = Column(Integer, nullable=False)                       # whole Naira
    reference = Column(String(120), nullable=True)                 # bank / transfer reference
    verified_by = Column(String(12), ForeignKey('staff.id', ondelete='SET NULL'), nullable=True)
    paid_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
