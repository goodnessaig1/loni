"""calls: kind ('nurse' | 'ride') and ride_id so mother and driver can call each other during a ride

Revision ID: e2a6c4b8d915
Revises: d9b2f4a6c317
Create Date: 2026-10-18
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e2a6c4b8d915'
down_revision: Union[str, Sequence[str], None] = 'd9b2f4a6c317'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('calls', sa.Column('kind', sa.String(length=20), nullable=False, server_default='nurse'))
    op.add_column('calls', sa.Column('ride_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_calls_ride_id', 'calls', 'rides', ['ride_id'], ['id'])
    op.create_index('ix_calls_ride_id', 'calls', ['ride_id'])


def downgrade() -> None:
    op.drop_index('ix_calls_ride_id', table_name='calls')
    op.drop_constraint('fk_calls_ride_id', 'calls', type_='foreignkey')
    op.drop_column('calls', 'ride_id')
    op.drop_column('calls', 'kind')
