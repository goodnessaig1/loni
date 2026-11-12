"""Admin portal operations: community reports + moderation, ride payouts, staff profile fields, support status.

Revision ID: e5b8c3d1f620
Revises: d4a7b2e9c815
Create Date: 2026-11-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e5b8c3d1f620'
down_revision: Union[str, Sequence[str], None] = 'd4a7b2e9c815'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NOW = sa.text('now()')


def upgrade() -> None:
    op.create_table(
        'community_reports',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('community_posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reporter_id', sa.String(12), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reason', sa.String(40), nullable=False),
        sa.Column('note', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.UniqueConstraint('post_id', 'reporter_id', name='uq_community_report_once'),
    )
    op.create_index('ix_community_reports_post', 'community_reports', ['post_id', 'created_at'])
    op.create_table(
        'community_moderation',
        sa.Column('post_id', sa.Integer(), sa.ForeignKey('community_posts.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('status', sa.String(20), server_default='new', nullable=False),
        sa.Column('report_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('first_reported_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column('last_reported_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column('note', sa.String(1000), nullable=True),
        sa.Column('decided_by', sa.String(12), sa.ForeignKey('staff.id', ondelete='SET NULL'), nullable=True),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_community_moderation_status', 'community_moderation', ['status', 'last_reported_at'])
    op.create_table(
        'ride_payouts',
        sa.Column('ride_id', sa.Integer(), sa.ForeignKey('rides.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('reference', sa.String(120), nullable=True),
        sa.Column('verified_by', sa.String(12), sa.ForeignKey('staff.id', ondelete='SET NULL'), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), server_default=NOW, nullable=False),
    )
    op.add_column('staff', sa.Column('phone', sa.String(30), nullable=True))
    op.add_column('staff', sa.Column('timezone', sa.String(60), server_default='Africa/Lagos', nullable=False))
    op.add_column('staff', sa.Column('avatar_url', sa.String(500), nullable=True))
    op.add_column('support_messages', sa.Column('resolved_by', sa.String(12), sa.ForeignKey('staff.id', ondelete='SET NULL'), nullable=True))
    op.add_column('support_messages', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('support_messages', 'updated_at')
    op.drop_column('support_messages', 'resolved_by')
    op.drop_column('staff', 'avatar_url')
    op.drop_column('staff', 'timezone')
    op.drop_column('staff', 'phone')
    op.drop_table('ride_payouts')
    op.drop_table('community_moderation')
    op.drop_table('community_reports')
