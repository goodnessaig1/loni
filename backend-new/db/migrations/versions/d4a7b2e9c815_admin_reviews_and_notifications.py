"""Admin portal: decisions on app accounts (with reasons) and the staff notification feed.

Revision ID: d4a7b2e9c815
Revises: c9e1f4a2b7d3
Create Date: 2026-11-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd4a7b2e9c815'
down_revision: Union[str, Sequence[str], None] = 'c9e1f4a2b7d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NOW = sa.text('now()')


def upgrade() -> None:
    op.create_table(
        'account_reviews',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(12), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('staff_id', sa.String(12), sa.ForeignKey('staff.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(30), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_index('ix_account_reviews_user', 'account_reviews', ['user_id', 'id'])
    op.create_table(
        'admin_notifications',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('category', sa.String(20), nullable=False),
        sa.Column('kind', sa.String(40), nullable=False),
        sa.Column('title', sa.String(160), nullable=False),
        sa.Column('body', sa.String(500), nullable=True),
        sa.Column('link', sa.String(255), nullable=True),
        sa.Column('permission', sa.String(40), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.create_index('ix_admin_notifications_created', 'admin_notifications', ['created_at'])
    op.create_table(
        'admin_notification_reads',
        sa.Column('notification_id', sa.Integer(), sa.ForeignKey('admin_notifications.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('staff_id', sa.String(12), sa.ForeignKey('staff.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('read_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )


def downgrade() -> None:
    op.drop_table('admin_notification_reads')
    op.drop_table('admin_notifications')
    op.drop_table('account_reviews')
