"""Add driver training progress and aptitude test tables

Revision ID: b1d7e4a9c2f0
Revises: cc0679ee7364
Create Date: 2026-08-31 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1d7e4a9c2f0'
down_revision: Union[str, Sequence[str], None] = 'cc0679ee7364'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'aptitude_questions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('options', sa.JSON(), nullable=False),
        sa.Column('answer_index', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('is_visible', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_aptitude_questions_id'), 'aptitude_questions', ['id'], unique=False)
    op.create_index(op.f('ix_aptitude_questions_key'), 'aptitude_questions', ['key'], unique=True)

    op.create_table(
        'aptitude_attempts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(length=12), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('total', sa.Integer(), nullable=False),
        sa.Column('passed', sa.Boolean(), nullable=False),
        sa.Column('breakdown', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_aptitude_attempts_id'), 'aptitude_attempts', ['id'], unique=False)
    op.create_index(op.f('ix_aptitude_attempts_user_id'), 'aptitude_attempts', ['user_id'], unique=False)

    op.create_table(
        'driver_training_progress',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(length=12), nullable=False),
        sa.Column('completed_modules', sa.JSON(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_driver_training_progress_user'),
    )
    op.create_index(op.f('ix_driver_training_progress_id'), 'driver_training_progress', ['id'], unique=False)
    op.create_index(op.f('ix_driver_training_progress_user_id'), 'driver_training_progress', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_driver_training_progress_user_id'), table_name='driver_training_progress')
    op.drop_index(op.f('ix_driver_training_progress_id'), table_name='driver_training_progress')
    op.drop_table('driver_training_progress')

    op.drop_index(op.f('ix_aptitude_attempts_user_id'), table_name='aptitude_attempts')
    op.drop_index(op.f('ix_aptitude_attempts_id'), table_name='aptitude_attempts')
    op.drop_table('aptitude_attempts')

    op.drop_index(op.f('ix_aptitude_questions_key'), table_name='aptitude_questions')
    op.drop_index(op.f('ix_aptitude_questions_id'), table_name='aptitude_questions')
    op.drop_table('aptitude_questions')
