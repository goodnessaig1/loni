"""Add connected_at to emergency_contacts

Revision ID: f3c8a0d12e56
Revises: d5f1a7c93b20
Create Date: 2026-10-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3c8a0d12e56'
down_revision: Union[str, Sequence[str], None] = 'd5f1a7c93b20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('emergency_contacts', sa.Column('connected_at', sa.DateTime(timezone=True), nullable=True))
    # Backfill existing already-connected rows so "Connected since" isn't
    # blank for contacts that connected before this column existed.
    op.execute(
        "UPDATE emergency_contacts SET connected_at = created_at WHERE status = 'connected' AND connected_at IS NULL"
    )


def downgrade() -> None:
    op.drop_column('emergency_contacts', 'connected_at')
