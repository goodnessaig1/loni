"""otps.payload: changes applied only after the code is verified (secure partner setup)

Revision ID: a7c3e9b1d248
Revises: f4b8d2c6e017
Create Date: 2026-10-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a7c3e9b1d248'
down_revision: Union[str, Sequence[str], None] = 'f4b8d2c6e017'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('otps', sa.Column('payload', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('otps', 'payload')
