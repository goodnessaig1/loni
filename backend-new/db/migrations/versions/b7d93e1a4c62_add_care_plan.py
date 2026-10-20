"""Add care plan state (daily task logs, hospital bag)

Revision ID: b7d93e1a4c62
Revises: a1c4e7f20b93
Create Date: 2026-10-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d93e1a4c62'
down_revision: Union[str, Sequence[str], None] = 'a1c4e7f20b93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'care_task_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(length=12), nullable=False),
        sa.Column('task_key', sa.String(length=50), nullable=False),
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'task_key', 'day', name='uq_care_task_user_key_day'),
    )
    op.create_index('ix_care_task_user_day', 'care_task_logs', ['user_id', 'day'], unique=False)
    op.create_table(
        'hospital_bag_checks',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(length=12), nullable=False),
        sa.Column('item_key', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'item_key', name='uq_hospital_bag_user_item'),
    )


def downgrade() -> None:
    op.drop_table('hospital_bag_checks')
    op.drop_index('ix_care_task_user_day', table_name='care_task_logs')
    op.drop_table('care_task_logs')
