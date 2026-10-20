"""user_settings (saved app settings per user) and support_messages (in-app contact support)

Revision ID: f4b8d2c6e017
Revises: e2a6c4b8d915
Create Date: 2026-10-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f4b8d2c6e017'
down_revision: Union[str, Sequence[str], None] = 'e2a6c4b8d915'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_settings',
        sa.Column('user_id', sa.String(length=12), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('prefs', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        'support_messages',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(length=12), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('user_type', sa.String(length=20), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('subject', sa.String(length=120), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='open'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_support_messages_user_id', 'support_messages', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_support_messages_user_id', table_name='support_messages')
    op.drop_table('support_messages')
    op.drop_table('user_settings')
