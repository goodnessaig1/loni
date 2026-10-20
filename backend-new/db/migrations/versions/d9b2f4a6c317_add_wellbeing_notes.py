"""Add wellbeing notes and the remember preference

Revision ID: d9b2f4a6c317
Revises: c4e8a1d7f903
Create Date: 2026-10-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9b2f4a6c317'
down_revision: Union[str, Sequence[str], None] = 'c4e8a1d7f903'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('checkin_preferences', sa.Column('remember', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.create_table(
        'wellbeing_notes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(length=12), nullable=False),
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('mood', sa.Integer(), nullable=True),
        sa.Column('symptoms', sa.JSON(), nullable=False),
        sa.Column('topics', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'day', name='uq_wellbeing_user_day'),
    )


def downgrade() -> None:
    op.drop_table('wellbeing_notes')
    op.drop_column('checkin_preferences', 'remember')
