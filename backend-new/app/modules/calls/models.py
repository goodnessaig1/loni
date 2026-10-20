import enum
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Enum, ForeignKey, JSON, Index
from sqlalchemy.orm import relationship as sa_relationship
from sqlalchemy.sql import func
from app.core.database import Base

class CallStatusEnum(str, enum.Enum):
    REQUESTED = 'REQUESTED'
    RINGING = 'RINGING'
    ACCEPTED = 'ACCEPTED'
    CONNECTING = 'CONNECTING'
    CONNECTED = 'CONNECTED'
    RECONNECTING = 'RECONNECTING'
    MISSED = 'MISSED'
    REJECTED = 'REJECTED'
    CANCELLED = 'CANCELLED'
    FAILED = 'FAILED'
    TIMEOUT = 'TIMEOUT'
    ENDED = 'ENDED'

class ParticipantRoleEnum(str, enum.Enum):
    CALLER = 'CALLER'
    RECEIVER = 'RECEIVER'

class Call(Base):
    __tablename__ = 'calls'
    __table_args__ = (Index('ix_calls_caller_status', 'caller_id', 'status'), Index('ix_calls_receiver_status', 'receiver_id', 'status'), Index('ix_calls_status_updated', 'status', 'updated_at'),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    caller_id = Column(String(12), ForeignKey('users.id'), nullable=False)
    receiver_id = Column(String(12), ForeignKey('users.id'), nullable=True) # Null if calling all nurses initially
    status = Column(Enum(CallStatusEnum, native_enum=False, length=50), default=CallStatusEnum.REQUESTED, nullable=False)
    room_name = Column(String(255), unique=True, index=True, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    answered_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, default=0, nullable=False)
    rating = Column(Integer, nullable=True)
    feedback = Column(String(1000), nullable=True)
    # 'nurse' = a mother asking a LONI nurse for help; 'ride' = the mother and her driver during an emergency ride.
    kind = Column(String(20), default='nurse', server_default='nurse', nullable=False)
    ride_id = Column(Integer, ForeignKey('rides.id'), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    caller = sa_relationship("User", foreign_keys=[caller_id])
    receiver = sa_relationship("User", foreign_keys=[receiver_id])
    participants = sa_relationship("CallParticipant", back_populates="call", cascade="all, delete-orphan")
    events = sa_relationship("CallEvent", back_populates="call", cascade="all, delete-orphan")

class CallParticipant(Base):
    __tablename__ = 'call_participants'
    __table_args__ = (Index('ix_call_participants_call', 'call_id'),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    call_id = Column(Integer, ForeignKey('calls.id'), nullable=False)
    user_id = Column(String(12), ForeignKey('users.id'), nullable=False)
    role = Column(Enum(ParticipantRoleEnum, native_enum=False, length=50), nullable=False)
    joined_at = Column(DateTime(timezone=True), nullable=True)
    left_at = Column(DateTime(timezone=True), nullable=True)

    call = sa_relationship("Call", back_populates="participants")
    user = sa_relationship("User", foreign_keys=[user_id])

class CallEvent(Base):
    __tablename__ = 'call_events'
    __table_args__ = (Index('ix_call_events_call_type', 'call_id', 'event_type'),)

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    call_id = Column(Integer, ForeignKey('calls.id'), nullable=False)
    event_type = Column(String(50), nullable=False) # e.g. 'RoomStarted', 'ParticipantJoined'
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    call = sa_relationship("Call", back_populates="events")
