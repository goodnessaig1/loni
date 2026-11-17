"""LiveKit webhook ledger: each delivery is applied once, by LiveKit's event id.

Revision ID: a7c4e1f9b302
Revises: e5b8c3d1f620
Create Date: 2026-11-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a7c4e1f9b302'
down_revision: Union[str, Sequence[str], None] = 'e5b8c3d1f620'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'livekit_webhook_events',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('room_name', sa.String(255), nullable=True),
        sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('ix_livekit_webhook_events_received_at', 'livekit_webhook_events', ['received_at'])


def downgrade() -> None:
    op.drop_index('ix_livekit_webhook_events_received_at', table_name='livekit_webhook_events')
    op.drop_table('livekit_webhook_events')
