"""
Emergency ride dispatch models.

Mirrors the `calls` module (see app/modules/calls/models.py): a `Ride` is the
long-lived record with a status state machine, `RideEvent` is an append-only
audit log, and `RideOffer` is the per-driver dispatch fan-out (one row per
driver the ride was offered to) that also backs the driver dashboard's
"Available Emergency Requests" list and makes accept first-come-first-served.

State machine:
    SEARCHING -> DRIVER_ASSIGNED -> DRIVER_EN_ROUTE -> DRIVER_ARRIVED
              -> IN_PROGRESS -> COMPLETED
    (any pre-IN_PROGRESS state) -> CANCELLED
    SEARCHING -> NO_DRIVERS (nobody available / nobody accepted in time)
"""
import enum
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Enum, ForeignKey, JSON, Text
)
from sqlalchemy.orm import relationship as sa_relationship
from sqlalchemy.sql import func
from app.core.database import Base


class RideStatusEnum(str, enum.Enum):
    SEARCHING = 'SEARCHING'
    DRIVER_ASSIGNED = 'DRIVER_ASSIGNED'
    DRIVER_EN_ROUTE = 'DRIVER_EN_ROUTE'
    DRIVER_ARRIVED = 'DRIVER_ARRIVED'
    IN_PROGRESS = 'IN_PROGRESS'
    COMPLETED = 'COMPLETED'
    CANCELLED = 'CANCELLED'
    NO_DRIVERS = 'NO_DRIVERS'
    FAILED = 'FAILED'


class RideOfferStatusEnum(str, enum.Enum):
    OFFERED = 'OFFERED'
    ACCEPTED = 'ACCEPTED'
    DECLINED = 'DECLINED'
    EXPIRED = 'EXPIRED'


# Non-terminal statuses during which the driver's live location is streamed
# to the waiting mother.
ACTIVE_STATUSES = (
    RideStatusEnum.DRIVER_ASSIGNED,
    RideStatusEnum.DRIVER_EN_ROUTE,
    RideStatusEnum.DRIVER_ARRIVED,
    RideStatusEnum.IN_PROGRESS,
)

TERMINAL_STATUSES = (
    RideStatusEnum.COMPLETED,
    RideStatusEnum.CANCELLED,
    RideStatusEnum.NO_DRIVERS,
    RideStatusEnum.FAILED,
)


class Ride(Base):
    __tablename__ = 'rides'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    rider_id = Column(String(12), ForeignKey('users.id'), index=True, nullable=False)
    driver_id = Column(String(12), ForeignKey('users.id'), index=True, nullable=True)
    status = Column(
        Enum(RideStatusEnum, native_enum=False, length=40),
        default=RideStatusEnum.SEARCHING, nullable=False,
    )

    # Pickup (mother's location at request time)
    pickup_lat = Column(Float, nullable=False)
    pickup_lng = Column(Float, nullable=False)
    pickup_address = Column(String(500), nullable=True)

    # Dropoff (destination hospital)
    dropoff_lat = Column(Float, nullable=False)
    dropoff_lng = Column(Float, nullable=False)
    dropoff_address = Column(String(500), nullable=True)
    dropoff_name = Column(String(255), nullable=True)
    dropoff_place_id = Column(String(255), nullable=True)

    # Route from pickup -> dropoff, computed at request time (Google Directions
    # or haversine fallback). `route_polyline` is Google's encoded polyline.
    distance_meters = Column(Integer, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    route_polyline = Column(Text, nullable=True)

    fare_estimate = Column(Integer, nullable=True)   # whole Naira
    fare_final = Column(Integer, nullable=True)

    notify_contacts = Column(Boolean, default=False, nullable=False, server_default='false')

    requested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    arrived_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by = Column(String(12), nullable=True)
    cancel_reason = Column(String(255), nullable=True)

    rider_rating = Column(Integer, nullable=True)     # mother rates the driver
    rider_feedback = Column(String(1000), nullable=True)
    driver_rating = Column(Integer, nullable=True)    # driver rates the mother

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    rider = sa_relationship("User", foreign_keys=[rider_id])
    driver = sa_relationship("User", foreign_keys=[driver_id])
    events = sa_relationship("RideEvent", back_populates="ride", cascade="all, delete-orphan")
    offers = sa_relationship("RideOffer", back_populates="ride", cascade="all, delete-orphan")


class RideEvent(Base):
    __tablename__ = 'ride_events'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ride_id = Column(Integer, ForeignKey('rides.id'), index=True, nullable=False)
    event_type = Column(String(50), nullable=False)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    ride = sa_relationship("Ride", back_populates="events")


class RideOffer(Base):
    __tablename__ = 'ride_offers'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ride_id = Column(Integer, ForeignKey('rides.id'), index=True, nullable=False)
    driver_id = Column(String(12), ForeignKey('users.id'), index=True, nullable=False)
    status = Column(
        Enum(RideOfferStatusEnum, native_enum=False, length=20),
        default=RideOfferStatusEnum.OFFERED, nullable=False,
    )
    # Straight-line distance (metres) from the driver to the pickup at offer
    # time - shown on the dashboard card and used to order the list.
    distance_meters = Column(Integer, nullable=True)
    offered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    responded_at = Column(DateTime(timezone=True), nullable=True)

    ride = sa_relationship("Ride", back_populates="offers")
    driver = sa_relationship("User", foreign_keys=[driver_id])
