"""
Admin-portal staff: their own accounts (separate from app users), roles holding permissions,
server-side sessions, sign-in challenges (the second factor), one-time links and an audit trail.
"""
import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import relationship as sa_relationship
from sqlalchemy.sql import func

from app.core.database import Base


class StaffStatusEnum(str, enum.Enum):
    invited = 'invited'      # invite sent, password not set yet
    active = 'active'
    suspended = 'suspended'  # cannot sign in; every session revoked


class StaffRole(Base):
    __tablename__ = 'staff_roles'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(80), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    # Permission keys from staff/permissions.py; unknown keys are dropped on save.
    permissions = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Staff(Base):
    __tablename__ = 'staff'

    id = Column(String(12), primary_key=True)
    email = Column(String(255), unique=True, index=True, nullable=False)  # stored lower-case
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=True)  # null until the invite is accepted
    status = Column(Enum(StaffStatusEnum, native_enum=False, length=20), nullable=False, default=StaffStatusEnum.invited)
    # Only created by app/scripts/create_super_admin.py; holds every permission and manages staff.
    is_super_admin = Column(Boolean, nullable=False, default=False, server_default='false')
    role_id = Column(Integer, ForeignKey('staff_roles.id', ondelete='SET NULL'), nullable=True, index=True)
    phone = Column(String(30), nullable=True)
    timezone = Column(String(60), nullable=False, default='Africa/Lagos', server_default='Africa/Lagos')
    avatar_url = Column(String(500), nullable=True)

    # Authenticator-app second factor (email codes are used until this is turned on).
    totp_secret_enc = Column(Text, nullable=True)
    totp_pending_secret_enc = Column(Text, nullable=True)
    totp_enabled = Column(Boolean, nullable=False, default=False, server_default='false')
    totp_last_counter = Column(Integer, nullable=True)  # stops a code being replayed in its 30 s window

    failed_login_count = Column(Integer, nullable=False, default=0, server_default='0')
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), nullable=True)
    created_by_id = Column(String(12), ForeignKey('staff.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    role = sa_relationship("StaffRole", foreign_keys=[role_id], lazy="joined")


class StaffSession(Base):
    """One signed-in browser. The refresh token's hash lives here; revoking the row signs it out at once."""
    __tablename__ = 'staff_sessions'
    __table_args__ = (Index('ix_staff_sessions_staff_active', 'staff_id', 'revoked_at'),)

    id = Column(String(32), primary_key=True)
    staff_id = Column(String(12), ForeignKey('staff.id', ondelete='CASCADE'), nullable=False)
    refresh_token_hash = Column(String(64), nullable=False)
    # The token it replaced, honoured for a few seconds so parallel requests refreshing at once don't look like theft.
    previous_refresh_hash = Column(String(64), nullable=True)
    rotated_at = Column(DateTime(timezone=True), nullable=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_reason = Column(String(40), nullable=True)


class StaffLoginChallenge(Base):
    """The step between a correct password and a session: a second factor must be proven within minutes."""
    __tablename__ = 'staff_login_challenges'

    id = Column(String(32), primary_key=True)
    staff_id = Column(String(12), ForeignKey('staff.id', ondelete='CASCADE'), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False)  # the browser holds the token, we keep its hash
    method = Column(String(10), nullable=False)       # 'email' | 'totp'
    code_hash = Column(String(64), nullable=True)     # emailed code (HMAC), null for totp
    code_sent_at = Column(DateTime(timezone=True), nullable=True)
    attempts = Column(Integer, nullable=False, default=0, server_default='0')
    ip_address = Column(String(64), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StaffActionToken(Base):
    """Single-use links: accept an invite, reset a password."""
    __tablename__ = 'staff_action_tokens'

    id = Column(Integer, primary_key=True, autoincrement=True)
    staff_id = Column(String(12), ForeignKey('staff.id', ondelete='CASCADE'), nullable=False, index=True)
    purpose = Column(String(20), nullable=False)  # 'invite' | 'reset'
    token_hash = Column(String(64), unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class StaffAuditLog(Base):
    """Append-only record of sign-ins and every change made from the portal. Never holds secrets."""
    __tablename__ = 'staff_audit_logs'
    __table_args__ = (Index('ix_staff_audit_created', 'created_at'),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    staff_id = Column(String(12), ForeignKey('staff.id', ondelete='SET NULL'), nullable=True, index=True)
    action = Column(String(60), nullable=False, index=True)
    target_type = Column(String(40), nullable=True)
    target_id = Column(String(64), nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
