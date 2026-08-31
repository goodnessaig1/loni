"""Initial schema - create base tables

Revision ID: 0000000000
Revises: 
Create Date: 2026-07-12 00:00:00.000000

This migration creates the original base tables (users, otps,
emergency_contacts, health_checks) that pre-existed on the cloud
(Neon) database and were never captured in a migration file.
fe53d227f769 was generated against that already-populated DB,
so it assumes these tables exist. This migration runs first and
creates them so a fresh local database works correctly.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0000000000'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create base tables."""

    op.create_table(
        'users',
        sa.Column('id', sa.String(length=12), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('trimester', sa.String(length=50), nullable=True),
        sa.Column('pregnancy_week', sa.String(length=50), nullable=True),
        sa.Column('pregnancy_start_date', sa.DateTime(), nullable=True),
        sa.Column('baby_age', sa.String(length=50), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('gender', sa.String(length=50), server_default='Female'),
        sa.Column('user_type', sa.String(length=50), server_default='user'),
        sa.Column('is_email_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_phone_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('profile_picture', sa.String(length=255), nullable=True),
        sa.Column('referral_code', sa.String(length=50), nullable=False),
        sa.Column('referred_by', sa.String(length=50), nullable=True),
        sa.Column('is_online', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('email', name='users_email_unique'),
        sa.UniqueConstraint('referral_code', name='users_referral_code_unique'),
    )

    op.create_table(
        'otps',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('otp', sa.String(length=6), nullable=False),
        sa.Column(
            'type',
            postgresql.ENUM('email_verification', 'phone_verification', 'reset_password', name='otp_type', create_type=True),
            nullable=False,
        ),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    )

    op.create_table(
        'emergency_contacts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(length=12), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('contact_user_id', sa.String(length=12), nullable=True),
        sa.Column('relationship', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), server_default='pending', nullable=True),
        sa.Column('location', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('updates', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('emergency', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    )

    op.create_table(
        'health_checks',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.String(length=12), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.TEXT(), nullable=False),
        sa.Column('notes', sa.TEXT(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    """Drop base tables."""
    op.drop_table('health_checks')
    op.drop_table('emergency_contacts')
    op.drop_table('otps')
    op.drop_table('users')
    # also drop the native enum type
    op.execute("DROP TYPE IF EXISTS otp_type")
