"""Driver onboarding: personal-info fields and submitted_at on driver_profiles

Revision ID: c3a8f21b6d94
Revises: b1d7e4a9c2f0
Create Date: 2026-08-31 16:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3a8f21b6d94'
down_revision: Union[str, Sequence[str], None] = 'b1d7e4a9c2f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('driver_profiles', sa.Column('full_name', sa.String(length=255), nullable=True))
    op.add_column('driver_profiles', sa.Column('date_of_birth', sa.String(length=50), nullable=True))
    op.add_column('driver_profiles', sa.Column('profile_photo', sa.String(length=500), nullable=True))
    op.add_column('driver_profiles', sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True))
    # Existing driver profiles were all created via the single-shot submit flow,
    # so treat them as already submitted.
    op.execute("UPDATE driver_profiles SET submitted_at = created_at WHERE submitted_at IS NULL")


def downgrade() -> None:
    op.drop_column('driver_profiles', 'submitted_at')
    op.drop_column('driver_profiles', 'profile_photo')
    op.drop_column('driver_profiles', 'date_of_birth')
    op.drop_column('driver_profiles', 'full_name')
