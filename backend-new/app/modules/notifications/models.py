from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, String, Integer, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class DeviceDB(BaseModel):
    user_id: str
    device_id: str
    device_type: str
    token: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NotificationLog(Base):
    """
    Persisted, user-visible notification history - separate from the
    ephemeral FCM push itself (which can be missed, dismissed, or arrive on
    a device that's offline). Whatever triggers a push the user should be
    able to find again later (e.g. a partner's Notification Centre) writes
    a row here alongside calling NotificationService.notify_user.
    """
    __tablename__ = 'notification_logs'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id'), index=True, nullable=False)
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    body = Column(String(1000), nullable=False)
    data = Column(JSON, nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
