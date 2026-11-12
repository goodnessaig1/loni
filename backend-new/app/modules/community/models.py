"""
Community feed: posts, likes, comments and views.

Storage decisions
-----------------
* **Postgres (here)** holds everything relational and countable. Likes and views are join tables with a
  UNIQUE (post_id, user_id) constraint, so "one like / one view per person" is enforced by the database,
  not by application code that could race.
* **Counters are denormalised, in their own table** (`community_post_stats`, one row per post). A feed page
  must show those numbers for ~10 posts at once; counting join rows on every read would not scale. They
  live apart from the post so the constant counter writes (row versions, locks) never touch the post row
  that every feed read depends on. Likes/comments change them in the same transaction as the join row, and
  only when that insert/delete really changed something. Views are buffered and applied in batches
  (see view_buffer.py). `CommunityPost.like_count` etc. are read-only shortcuts to the stats row.
* **Images are not stored here** - only the Cloudinary URL (same provider as profile pictures).
* Posts are soft-deleted (`deleted_at`) so counts, notifications and reports that reference them stay
  consistent; every read filters `deleted_at IS NULL`.
"""
from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey, Text, Index, UniqueConstraint,
)
from sqlalchemy.orm import relationship as sa_relationship
from sqlalchemy.sql import func
from app.core.database import Base


class CommunityPost(Base):
    __tablename__ = 'community_posts'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    author_id = Column(String(12), ForeignKey('users.id'), nullable=False, index=True)
    body = Column(Text, nullable=False, default='', server_default='')
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    author = sa_relationship("User", foreign_keys=[author_id])
    stats = sa_relationship("CommunityPostStats", uselist=False, lazy='joined', cascade='all, delete-orphan')

    @property
    def like_count(self) -> int:
        return self.stats.like_count if self.stats else 0

    @property
    def comment_count(self) -> int:
        return self.stats.comment_count if self.stats else 0

    @property
    def view_count(self) -> int:
        return self.stats.view_count if self.stats else 0

    # Keyset pagination walks (created_at DESC, id DESC).
    __table_args__ = (Index('ix_community_posts_feed', 'created_at', 'id'),)


class CommunityPostStats(Base):
    """Hot counters for a post. Always created together with the post (see create_post)."""
    __tablename__ = 'community_post_stats'

    post_id = Column(Integer, ForeignKey('community_posts.id', ondelete='CASCADE'), primary_key=True)
    like_count = Column(Integer, nullable=False, default=0, server_default='0')
    comment_count = Column(Integer, nullable=False, default=0, server_default='0')
    view_count = Column(Integer, nullable=False, default=0, server_default='0')


class CommunityLike(Base):
    __tablename__ = 'community_likes'

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(Integer, ForeignKey('community_posts.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(String(12), ForeignKey('users.id'), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint('post_id', 'user_id', name='uq_community_like_post_user'),)


class CommunityComment(Base):
    __tablename__ = 'community_comments'

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(Integer, ForeignKey('community_posts.id', ondelete='CASCADE'), nullable=False)
    author_id = Column(String(12), ForeignKey('users.id'), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    author = sa_relationship("User", foreign_keys=[author_id])

    __table_args__ = (Index('ix_community_comments_post', 'post_id', 'id'),)


class CommunityView(Base):
    __tablename__ = 'community_views'

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(Integer, ForeignKey('community_posts.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(String(12), ForeignKey('users.id'), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint('post_id', 'user_id', name='uq_community_view_post_user'),
        Index('ix_community_views_recent', 'post_id', 'created_at'),
    )


class CommunityReport(Base):
    """A member flagging a post. One report per member per post; reporters are never shown to the author."""
    __tablename__ = 'community_reports'
    __table_args__ = (
        UniqueConstraint('post_id', 'reporter_id', name='uq_community_report_once'),
        Index('ix_community_reports_post', 'post_id', 'created_at'),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(Integer, ForeignKey('community_posts.id', ondelete='CASCADE'), nullable=False)
    reporter_id = Column(String(12), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    # harmful_medical_advice | misinformation | harassment | spam | inappropriate | other
    reason = Column(String(40), nullable=False)
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CommunityModeration(Base):
    """Where a reported post stands. Created on its first report; staff move it along."""
    __tablename__ = 'community_moderation'
    __table_args__ = (Index('ix_community_moderation_status', 'status', 'last_reported_at'),)

    post_id = Column(Integer, ForeignKey('community_posts.id', ondelete='CASCADE'), primary_key=True)
    # new | under_review | escalated | dismissed | removed
    status = Column(String(20), nullable=False, default='new', server_default='new')
    report_count = Column(Integer, nullable=False, default=0, server_default='0')
    first_reported_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_reported_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    note = Column(String(1000), nullable=True)
    decided_by = Column(String(12), ForeignKey('staff.id', ondelete='SET NULL'), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
