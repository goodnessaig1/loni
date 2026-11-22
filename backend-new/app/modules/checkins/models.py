"""
Proactive wellness check-ins: what each mother has opted into, and a log of every check-in we sent.

The log is also the duplicate guard. `dedupe_key` is UNIQUE per user ("daily:2026-10-15", "followup:<event id>"),
and a check-in is only sent by the process that managed to INSERT that row. So two scheduler instances, a retry,
or a restart in the middle of a run can never send the same hello twice, whatever the application code does.
"""
from sqlalchemy import JSON, Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class CheckinPreference(Base):
    __tablename__ = 'checkin_preferences'

    user_id = Column(String(12), ForeignKey('users.id'), primary_key=True)
    enabled = Column(Boolean, nullable=False, default=True, server_default='1')
    timezone = Column(String(64), nullable=True)          # IANA name, e.g. "Africa/Lagos"; null = deployment default
    preferred_hour = Column(Integer, nullable=True)       # local hour she is first eligible; null = deployment default
    remember = Column(Boolean, nullable=False, default=True, server_default='1')   # may Loni keep short notes of what she shares
    paused_until = Column(Date, nullable=True)            # check-ins paused through this local date (she asked for a break)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class CheckinLog(Base):
    __tablename__ = 'checkin_logs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id'), nullable=False)
    dedupe_key = Column(String(80), nullable=False)
    kind = Column(String(20), nullable=False)             # 'daily' | 'followup'
    local_date = Column(Date, nullable=False)             # her calendar day when it was sent
    category = Column(String(30), nullable=False)         # preg_t1 ... pp_early ... general
    care_level = Column(String(20), nullable=False)       # standard | enhanced | intensive
    template_key = Column(String(60), nullable=False)
    session_id = Column(String(40), nullable=True)        # the AI chat the notification opens
    notification_id = Column(Integer, nullable=True)      # notification_logs.id (the Notification Centre row)
    status = Column(String(12), nullable=False, default='claimed')   # claimed -> sent | failed
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)
    response_key = Column(String(20), nullable=True)      # good | rough | question | concerning | other

    __table_args__ = (
        UniqueConstraint('user_id', 'dedupe_key', name='uq_checkin_user_dedupe'),
        Index('ix_checkin_user_date', 'user_id', 'local_date'),
    )


class WellbeingNote(Base):
    """What Loni has learned about her day, kept as a few tags - never her actual words.

    One row per user per day (merged as the day goes on). It lets the next hello and the next chat pick up where the last
    one left off ("how's the headache?") and lets Loni notice a run of low days. She can see it and delete it at any time,
    and switch it off (`CheckinPreference.remember`)."""
    __tablename__ = 'wellbeing_notes'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id'), nullable=False)
    day = Column(Date, nullable=False)
    mood = Column(Integer, nullable=True)                 # 1 (very low) .. 5 (great)
    symptoms = Column(JSON, nullable=False, default=list)  # canonical names from a fixed list, e.g. ["headache"]
    topics = Column(JSON, nullable=False, default=list)    # e.g. ["sleep", "contraception"]
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint('user_id', 'day', name='uq_wellbeing_user_day'),)


class MemoryFact(Base):
    """One thing Loni knows about her, with where it came from. Structured on purpose: a fixed `kind`, a short canonical
    `key` from fixed lists (or a sanitised short phrase for allergies / preferred name), never a copy of her message.

    provenance: user_reported (she said it) | clinician_confirmed (a nurse/doctor confirmed it) | ai_inferred (Loni guessed).
    "Stale" is not stored: it is worked out at read time from `last_noted` so an old symptom is never presented as current.
    She can list, correct, resolve and delete every fact."""
    __tablename__ = 'memory_facts'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(12), ForeignKey('users.id'), nullable=False, index=True)
    kind = Column(String(20), nullable=False)             # symptom | concern | medication | allergy | appointment | condition | preference
    key = Column(String(60), nullable=False)              # e.g. "headache", "fear_of_childbirth", "folic acid", "antenatal visit"
    detail = Column(String(80), nullable=True)            # e.g. preferred name
    event_date = Column(Date, nullable=True)              # appointments: the day it is / was
    provenance = Column(String(24), nullable=False, default='user_reported')
    status = Column(String(12), nullable=False, default='active')   # active | resolved
    source = Column(String(12), nullable=False, default='chat')     # chat | user (edited in the app) | clinician
    first_noted = Column(Date, nullable=False)
    last_noted = Column(Date, nullable=False)
    followed_up_at = Column(DateTime(timezone=True), nullable=True)  # when a check-in last asked about it
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint('user_id', 'kind', 'key', name='uq_memory_fact_user_kind_key'),)
