"""LONI AI: structured memory with provenance, check-in pause, curated knowledge base

Revision ID: f2c6a9d4e811
Revises: a7c4e1f9b302
Create Date: 2026-11-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f2c6a9d4e811'
down_revision: Union[str, Sequence[str], None] = 'a7c4e1f9b302'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('checkin_preferences', sa.Column('paused_until', sa.Date(), nullable=True))
    op.create_table(
        'memory_facts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(12), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('key', sa.String(60), nullable=False),
        sa.Column('detail', sa.String(80), nullable=True),
        sa.Column('event_date', sa.Date(), nullable=True),
        sa.Column('provenance', sa.String(24), nullable=False, server_default='user_reported'),
        sa.Column('status', sa.String(12), nullable=False, server_default='active'),
        sa.Column('source', sa.String(12), nullable=False, server_default='chat'),
        sa.Column('first_noted', sa.Date(), nullable=False),
        sa.Column('last_noted', sa.Date(), nullable=False),
        sa.Column('followed_up_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('user_id', 'kind', 'key', name='uq_memory_fact_user_kind_key'),
    )
    op.create_index('ix_memory_facts_user_id', 'memory_facts', ['user_id'])
    op.create_table(
        'knowledge_docs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('source', sa.String(200), nullable=False),
        sa.Column('source_url', sa.String(500), nullable=True),
        sa.Column('published_on', sa.Date(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('status', sa.String(12), nullable=False, server_default='draft'),
        sa.Column('reviewer', sa.String(120), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_on', sa.Date(), nullable=True),
        sa.Column('stages', sa.JSON(), nullable=False),
        sa.Column('week_from', sa.Integer(), nullable=True),
        sa.Column('week_to', sa.Integer(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=False),
        sa.Column('created_by', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_knowledge_docs_status', 'knowledge_docs', ['status'])


def downgrade() -> None:
    op.drop_index('ix_knowledge_docs_status', table_name='knowledge_docs')
    op.drop_table('knowledge_docs')
    op.drop_index('ix_memory_facts_user_id', table_name='memory_facts')
    op.drop_table('memory_facts')
    op.drop_column('checkin_preferences', 'paused_until')
