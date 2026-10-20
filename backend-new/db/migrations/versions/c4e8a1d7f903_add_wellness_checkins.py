"""Add wellness check-ins (preferences and send log)

Revision ID: c4e8a1d7f903
Revises: b7d93e1a4c62
Create Date: 2026-10-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4e8a1d7f903'
down_revision: Union[str, Sequence[str], None] = 'b7d93e1a4c62'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'checkin_preferences',
        sa.Column('user_id', sa.String(length=12), nullable=False),
        sa.Column('enabled', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('timezone', sa.String(length=64), nullable=True),
        sa.Column('preferred_hour', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('user_id'),
    )
    op.create_table(
        'checkin_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(length=12), nullable=False),
        sa.Column('dedupe_key', sa.String(length=80), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('local_date', sa.Date(), nullable=False),
        sa.Column('category', sa.String(length=30), nullable=False),
        sa.Column('care_level', sa.String(length=20), nullable=False),
        sa.Column('template_key', sa.String(length=60), nullable=False),
        sa.Column('session_id', sa.String(length=40), nullable=True),
        sa.Column('notification_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=12), nullable=False, server_default='claimed'),
        sa.Column('sent_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('response_key', sa.String(length=20), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'dedupe_key', name='uq_checkin_user_dedupe'),
    )
    op.create_index('ix_checkin_user_date', 'checkin_logs', ['user_id', 'local_date'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_checkin_user_date', table_name='checkin_logs')
    op.drop_table('checkin_logs')
    op.drop_table('checkin_preferences')
