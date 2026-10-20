"""indexes for the hot paths at scale: busy checks, rung lists, offers, partner lookups, notifications

Revision ID: b3d5f7a9c102
Revises: a7c3e9b1d248
Create Date: 2026-10-18
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b3d5f7a9c102'
down_revision: Union[str, Sequence[str], None] = 'a7c3e9b1d248'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

INDEXES = [
    ('ix_calls_caller_status', 'calls', ['caller_id', 'status']),
    ('ix_calls_receiver_status', 'calls', ['receiver_id', 'status']),
    ('ix_calls_status_updated', 'calls', ['status', 'updated_at']),
    ('ix_call_participants_call', 'call_participants', ['call_id']),
    ('ix_call_events_call_type', 'call_events', ['call_id', 'event_type']),
    ('ix_rides_status_requested', 'rides', ['status', 'requested_at']),
    ('ix_ride_offers_ride_status', 'ride_offers', ['ride_id', 'status']),
    ('ix_users_type_online', 'users', ['user_type', 'is_online']),
    ('ix_emergency_contacts_user', 'emergency_contacts', ['user_id']),
    ('ix_emergency_contacts_contact', 'emergency_contacts', ['contact_user_id']),
    ('ix_notification_logs_user_type', 'notification_logs', ['user_id', 'type']),
]


def upgrade() -> None:
    for name, table, cols in INDEXES:
        op.create_index(name, table, cols)


def downgrade() -> None:
    for name, table, _ in reversed(INDEXES):
        op.drop_index(name, table_name=table)
