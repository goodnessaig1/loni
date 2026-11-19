"""
LONI's curated knowledge base: the only documents the AI may quote as reference material.

Lifecycle: draft -> approved -> retired. Only APPROVED documents that have a named reviewer and have not passed their
`expires_on` date are ever retrieved. Any edit to a document sends it back to draft and bumps its version, so nothing
reaches mothers without a fresh review. Loni never writes here itself (no self-learning).
"""
from sqlalchemy import JSON, Column, Date, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class KnowledgeDoc(Base):
    __tablename__ = 'knowledge_docs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)                     # plain-language summary written/checked by a clinician
    source = Column(String(200), nullable=False)            # e.g. "WHO recommendations on antenatal care (2016)"
    source_url = Column(String(500), nullable=True)
    published_on = Column(Date, nullable=True)              # date of the source document
    version = Column(Integer, nullable=False, default=1)
    status = Column(String(12), nullable=False, default='draft')   # draft | approved | retired
    reviewer = Column(String(120), nullable=True)           # who approved this version (name + role)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    expires_on = Column(Date, nullable=True)                # must be re-reviewed by this date; not served after it
    stages = Column(JSON, nullable=False, default=list)     # any of: pregnancy, postpartum, general, ttc ([] = everyone)
    week_from = Column(Integer, nullable=True)              # pregnancy/postpartum week range this applies to
    week_to = Column(Integer, nullable=True)
    tags = Column(JSON, nullable=False, default=list)       # search words, e.g. ["sleep", "insomnia"]
    created_by = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
