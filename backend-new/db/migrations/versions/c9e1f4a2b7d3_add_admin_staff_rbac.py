"""Admin portal: staff accounts, roles (RBAC), sessions, sign-in challenges, one-time links, audit log.

Revision ID: c9e1f4a2b7d3
Revises: b3d5f7a9c102
Create Date: 2026-11-07
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c9e1f4a2b7d3'
down_revision: Union[str, Sequence[str], None] = 'b3d5f7a9c102'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NOW = sa.text('now()')


def upgrade() -> None:
    op.create_table(
        'staff_roles',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(80), nullable=False, unique=True),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('permissions', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_table(
        'staff',
        sa.Column('id', sa.String(12), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('is_super_admin', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('staff_roles.id', ondelete='SET NULL'), nullable=True),
        sa.Column('totp_secret_enc', sa.Text(), nullable=True),
        sa.Column('totp_pending_secret_enc', sa.Text(), nullable=True),
        sa.Column('totp_enabled', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('totp_last_counter', sa.Integer(), nullable=True),
        sa.Column('failed_login_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_id', sa.String(12), sa.ForeignKey('staff.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_index('ix_staff_email', 'staff', ['email'], unique=True)
    op.create_index('ix_staff_role_id', 'staff', ['role_id'])

    op.create_table(
        'staff_sessions',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('staff_id', sa.String(12), sa.ForeignKey('staff.id', ondelete='CASCADE'), nullable=False),
        sa.Column('refresh_token_hash', sa.String(64), nullable=False),
        sa.Column('previous_refresh_hash', sa.String(64), nullable=True),
        sa.Column('rotated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('user_agent', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_reason', sa.String(40), nullable=True),
    )
    op.create_index('ix_staff_sessions_staff_active', 'staff_sessions', ['staff_id', 'revoked_at'])

    op.create_table(
        'staff_login_challenges',
        sa.Column('id', sa.String(32), primary_key=True),
        sa.Column('staff_id', sa.String(12), sa.ForeignKey('staff.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(64), nullable=False),
        sa.Column('method', sa.String(10), nullable=False),
        sa.Column('code_hash', sa.String(64), nullable=True),
        sa.Column('code_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('attempts', sa.Integer(), server_default='0', nullable=False),
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_index('ix_staff_login_challenges_staff_id', 'staff_login_challenges', ['staff_id'])

    op.create_table(
        'staff_action_tokens',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('staff_id', sa.String(12), sa.ForeignKey('staff.id', ondelete='CASCADE'), nullable=False),
        sa.Column('purpose', sa.String(20), nullable=False),
        sa.Column('token_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_index('ix_staff_action_tokens_staff_id', 'staff_action_tokens', ['staff_id'])

    op.create_table(
        'staff_audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('staff_id', sa.String(12), sa.ForeignKey('staff.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(60), nullable=False),
        sa.Column('target_type', sa.String(40), nullable=True),
        sa.Column('target_id', sa.String(64), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('user_agent', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_index('ix_staff_audit_created', 'staff_audit_logs', ['created_at'])
    op.create_index('ix_staff_audit_logs_staff_id', 'staff_audit_logs', ['staff_id'])
    op.create_index('ix_staff_audit_logs_action', 'staff_audit_logs', ['action'])


def downgrade() -> None:
    op.drop_table('staff_audit_logs')
    op.drop_table('staff_action_tokens')
    op.drop_table('staff_login_challenges')
    op.drop_table('staff_sessions')
    op.drop_table('staff')
    op.drop_table('staff_roles')
