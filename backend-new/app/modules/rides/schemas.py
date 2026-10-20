from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime

from app.modules.rides.models import RideStatusEnum


# --------------------------------------------------------------------------
# Shared value objects
# --------------------------------------------------------------------------
class LatLng(BaseModel):
    lat: float
    lng: float


class RouteStep(BaseModel):
    instruction: str                 # plain text, HTML stripped
    maneuver: Optional[str] = None   # e.g. "turn-left", "roundabout-right"
    distance_meters: int
    duration_seconds: int
    start: LatLng
    end: LatLng
    polyline: Optional[str] = None   # encoded polyline for this step


class RouteInfo(BaseModel):
    distance_meters: int
    duration_seconds: int
    polyline: Optional[str] = None
    steps: List[RouteStep] = []
    # True when Google Directions answered; False when we fell back to a
    # straight-line estimate (no API key / API error).
    is_estimate: bool = False


class HospitalInfo(BaseModel):
    name: str
    address: Optional[str] = None
    place_id: Optional[str] = None
    location: LatLng
    distance_meters: Optional[int] = None


class RiderInfo(BaseModel):
    id: str
    name: str
    profile_picture: Optional[str] = None
    phone: Optional[str] = None
    trimester: Optional[str] = None
    pregnancy_week: Optional[str] = None


class DriverInfo(BaseModel):
    id: str
    name: str
    profile_picture: Optional[str] = None
    phone: Optional[str] = None
    rating_avg: float = 0
    rating_count: int = 0
    total_trips: int = 0
    vehicle_brand: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    plate_number: Optional[str] = None
    vehicle_type: Optional[str] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    heading: Optional[float] = None


# --------------------------------------------------------------------------
# Requests
# --------------------------------------------------------------------------
class QuoteRequest(BaseModel):
    pickup: LatLng
    pickup_address: Optional[str] = None
    dropoff: Optional[LatLng] = None
    dropoff_address: Optional[str] = None
    dropoff_name: Optional[str] = None
    dropoff_place_id: Optional[str] = None
    # If true and no dropoff given, the backend picks the nearest hospital.
    nearest_hospital: bool = False


class QuoteResponse(BaseModel):
    pickup: LatLng
    pickup_address: Optional[str] = None
    dropoff: LatLng
    dropoff_address: Optional[str] = None
    dropoff_name: Optional[str] = None
    dropoff_place_id: Optional[str] = None
    route: RouteInfo
    fare_estimate: int


class RideRequestBody(QuoteRequest):
    notify_contacts: bool = False


class LocationPing(BaseModel):
    lat: float
    lng: float
    heading: Optional[float] = None


class AvailabilityBody(BaseModel):
    is_available: bool


class RideRatingBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    feedback: Optional[str] = None


class CancelBody(BaseModel):
    reason: Optional[str] = None


class NotifyContactsBody(BaseModel):
    # 'share' = share the live trip with her partners; 'arrived' = tell them she arrived safely
    kind: str


# --------------------------------------------------------------------------
# Responses
# --------------------------------------------------------------------------
class RideResponse(BaseModel):
    id: int
    status: RideStatusEnum
    rider_id: str
    driver_id: Optional[str] = None

    pickup: Optional[LatLng] = None          # hidden from a partner she doesn't share location with
    location_shared: bool = True
    pickup_address: Optional[str] = None
    dropoff: LatLng
    dropoff_address: Optional[str] = None
    dropoff_name: Optional[str] = None

    distance_meters: Optional[int] = None
    duration_seconds: Optional[int] = None
    route_polyline: Optional[str] = None
    fare_estimate: Optional[int] = None
    fare_final: Optional[int] = None

    notify_contacts: bool = False

    requested_at: Optional[datetime] = None
    assigned_at: Optional[datetime] = None
    arrived_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    rider_rating: Optional[int] = None    # mother -> driver
    driver_rating: Optional[int] = None   # driver -> mother

    rider: Optional[RiderInfo] = None
    driver: Optional[DriverInfo] = None

    # Present on accept / start responses (the leg the driver should drive next).
    next_route: Optional[RouteInfo] = None


class OfferCard(BaseModel):
    """One row in the driver dashboard's "Available Emergency Requests"."""
    ride_id: int
    offer_id: int
    pickup_address: Optional[str] = None
    dropoff_name: Optional[str] = None
    dropoff_address: Optional[str] = None
    pickup: LatLng
    dropoff: LatLng
    distance_meters: Optional[int] = None       # driver -> pickup
    trip_distance_meters: Optional[int] = None  # pickup -> dropoff
    trip_duration_seconds: Optional[int] = None
    fare_estimate: Optional[int] = None
    rider: Optional[RiderInfo] = None
    offered_at: Optional[datetime] = None
    expires_in_seconds: int = 0


class AvailableRidesResponse(BaseModel):
    count: int
    offers: List[OfferCard] = []


class DriverStatsResponse(BaseModel):
    rating_avg: float = 0
    rating_count: int = 0
    total_earnings: int = 0
    total_trips: int = 0
    trips_today: int = 0
    earnings_today: int = 0
    is_online: bool = False
    is_available: bool = False


class RideHistoryItem(BaseModel):
    id: int
    status: RideStatusEnum
    pickup_address: Optional[str] = None
    dropoff_name: Optional[str] = None
    dropoff_address: Optional[str] = None
    fare_final: Optional[int] = None
    fare_estimate: Optional[int] = None
    distance_meters: Optional[int] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    counterpart_name: Optional[str] = None
    counterpart_photo: Optional[str] = None


class SimpleOk(BaseModel):
    success: bool = True
    message: str = "ok"
    data: Optional[Any] = None
