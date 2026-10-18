"""Per-user app settings and messages sent to LONI support from inside the apps."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class UserSettings(Base):
    __tablename__ = 'user_settings'

    user_id = Column(String(12), ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    # {"push": true, "incoming_calls": true, ...} - only keys in service.DEFAULTS are stored.
    prefs = Column(JSON, nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class SupportMessage(Base):
    __tablename__ = 'support_messages'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    user_type = Column(String(20), nullable=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    subject = Column(String(120), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default='open', server_default='open')
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
