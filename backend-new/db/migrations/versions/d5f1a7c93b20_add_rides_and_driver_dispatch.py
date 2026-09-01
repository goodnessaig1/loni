"""Add emergency ride dispatch (rides, ride_events, ride_offers) + driver live-dispatch columns

Revision ID: d5f1a7c93b20
Revises: c3a8f21b6d94
Create Date: 2026-09-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5f1a7c93b20'
down_revision: Union[str, Sequence[str], None] = 'c3a8f21b6d94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_RIDE_STATUS = sa.Enum(
    'SEARCHING', 'DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED',
    'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_DRIVERS', 'FAILED',
    name='ridestatusenum', native_enum=False, length=40,
)
_OFFER_STATUS = sa.Enum(
    'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED',
    name='rideofferstatusenum', native_enum=False, length=20,
)


def upgrade() -> None:
    # --- driver_profiles: live dispatch state ---
    op.add_column('driver_profiles', sa.Column('current_lat', sa.Float(), nullable=True))
    op.add_column('driver_profiles', sa.Column('current_lng', sa.Float(), nullable=True))
    op.add_column('driver_profiles', sa.Column('heading', sa.Float(), nullable=True))
    op.add_column('driver_profiles', sa.Column('location_updated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('driver_profiles', sa.Column('is_available', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('driver_profiles', sa.Column('active_ride_id', sa.Integer(), nullable=True))
    op.add_column('driver_profiles', sa.Column('rating_avg', sa.Float(), server_default='0', nullable=False))
    op.add_column('driver_profiles', sa.Column('rating_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('driver_profiles', sa.Column('total_trips', sa.Integer(), server_default='0', nullable=False))
    op.add_column('driver_profiles', sa.Column('total_earnings', sa.Integer(), server_default='0', nullable=False))

    # --- rides ---
    op.create_table(
        'rides',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('rider_id', sa.String(length=12), nullable=False),
        sa.Column('driver_id', sa.String(length=12), nullable=True),
        sa.Column('status', _RIDE_STATUS, nullable=False),
        sa.Column('pickup_lat', sa.Float(), nullable=False),
        sa.Column('pickup_lng', sa.Float(), nullable=False),
        sa.Column('pickup_address', sa.String(length=500), nullable=True),
        sa.Column('dropoff_lat', sa.Float(), nullable=False),
        sa.Column('dropoff_lng', sa.Float(), nullable=False),
        sa.Column('dropoff_address', sa.String(length=500), nullable=True),
        sa.Column('dropoff_name', sa.String(length=255), nullable=True),
        sa.Column('dropoff_place_id', sa.String(length=255), nullable=True),
        sa.Column('distance_meters', sa.Integer(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('route_polyline', sa.Text(), nullable=True),
        sa.Column('fare_estimate', sa.Integer(), nullable=True),
        sa.Column('fare_final', sa.Integer(), nullable=True),
        sa.Column('notify_contacts', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('arrived_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_by', sa.String(length=12), nullable=True),
        sa.Column('cancel_reason', sa.String(length=255), nullable=True),
        sa.Column('rider_rating', sa.Integer(), nullable=True),
        sa.Column('rider_feedback', sa.String(length=1000), nullable=True),
        sa.Column('driver_rating', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['rider_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['driver_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_rides_id'), 'rides', ['id'], unique=False)
    op.create_index(op.f('ix_rides_rider_id'), 'rides', ['rider_id'], unique=False)
    op.create_index(op.f('ix_rides_driver_id'), 'rides', ['driver_id'], unique=False)

    # --- ride_events ---
    op.create_table(
        'ride_events',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ride_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['ride_id'], ['rides.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ride_events_id'), 'ride_events', ['id'], unique=False)
    op.create_index(op.f('ix_ride_events_ride_id'), 'ride_events', ['ride_id'], unique=False)

    # --- ride_offers ---
    op.create_table(
        'ride_offers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ride_id', sa.Integer(), nullable=False),
        sa.Column('driver_id', sa.String(length=12), nullable=False),
        sa.Column('status', _OFFER_STATUS, nullable=False),
        sa.Column('distance_meters', sa.Integer(), nullable=True),
        sa.Column('offered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['ride_id'], ['rides.id'], ),
        sa.ForeignKeyConstraint(['driver_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ride_offers_id'), 'ride_offers', ['id'], unique=False)
    op.create_index(op.f('ix_ride_offers_ride_id'), 'ride_offers', ['ride_id'], unique=False)
    op.create_index(op.f('ix_ride_offers_driver_id'), 'ride_offers', ['driver_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ride_offers_driver_id'), table_name='ride_offers')
    op.drop_index(op.f('ix_ride_offers_ride_id'), table_name='ride_offers')
    op.drop_index(op.f('ix_ride_offers_id'), table_name='ride_offers')
    op.drop_table('ride_offers')

    op.drop_index(op.f('ix_ride_events_ride_id'), table_name='ride_events')
    op.drop_index(op.f('ix_ride_events_id'), table_name='ride_events')
    op.drop_table('ride_events')

    op.drop_index(op.f('ix_rides_driver_id'), table_name='rides')
    op.drop_index(op.f('ix_rides_rider_id'), table_name='rides')
    op.drop_index(op.f('ix_rides_id'), table_name='rides')
    op.drop_table('rides')

    for col in ('total_earnings', 'total_trips', 'rating_count', 'rating_avg',
                'active_ride_id', 'is_available', 'location_updated_at',
                'heading', 'current_lng', 'current_lat'):
        op.drop_column('driver_profiles', col)
