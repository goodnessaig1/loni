from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.modules.users.models import User, UserTypeEnum
from app.modules.rides.schemas import (
    QuoteRequest, QuoteResponse, RideRequestBody, RideResponse,
    AvailableRidesResponse, DriverStatsResponse, RideRatingBody, CancelBody,
    LocationPing, AvailabilityBody, SimpleOk, RiderInfo, DriverInfo, LatLng,
)
from app.modules.rides.services.ride_service import RideService, _rider_info, _driver_info
from app.modules.rides.services import maps_service

router = APIRouter()


def _require_driver(user: User) -> None:
    from fastapi import HTTPException
    if user.user_type != UserTypeEnum.driver:
        raise HTTPException(status_code=403, detail="Drivers only")


def _ride_to_response(ride, *, viewer_id: str) -> dict:
    rider = getattr(ride, "rider", None)
    driver = getattr(ride, "driver", None)
    out = {
        "id": ride.id,
        "status": ride.status,
        "rider_id": ride.rider_id,
        "driver_id": ride.driver_id,
        "pickup": {"lat": ride.pickup_lat, "lng": ride.pickup_lng},
        "pickup_address": ride.pickup_address,
        "dropoff": {"lat": ride.dropoff_lat, "lng": ride.dropoff_lng},
        "dropoff_address": ride.dropoff_address,
        "dropoff_name": ride.dropoff_name,
        "distance_meters": ride.distance_meters,
        "duration_seconds": ride.duration_seconds,
        "route_polyline": ride.route_polyline,
        "fare_estimate": ride.fare_estimate,
        "fare_final": ride.fare_final,
        "notify_contacts": ride.notify_contacts,
        "requested_at": ride.requested_at,
        "assigned_at": ride.assigned_at,
        "arrived_at": ride.arrived_at,
        "started_at": ride.started_at,
        "completed_at": ride.completed_at,
        "rider": _rider_info(rider).model_dump() if rider else None,
        "driver": _driver_info(driver, getattr(driver, "driver_profile", None)).model_dump() if driver else None,
    }
    return out


# --------------------------------------------------------------------------
# Quote / hospital lookup (mother)
# --------------------------------------------------------------------------
@router.post("/quote", response_model=QuoteResponse)
async def quote(payload: QuoteRequest, current_user: User = Depends(get_current_user)):
    """Fare + route + ETA preview for the request screen. No Ride row created."""
    return await RideService.quote(payload)


@router.get("/hospitals")
async def hospitals(
    lat: float = Query(...), lng: float = Query(...),
    current_user: User = Depends(get_current_user),
):
    """Nearest hospitals to a point (Google Places passthrough)."""
    results = await maps_service.nearest_hospitals(lat, lng)
    return {"success": True, "data": {"hospitals": [h.model_dump() for h in results]}}


# --------------------------------------------------------------------------
# Ride lifecycle (mother)
# --------------------------------------------------------------------------
@router.post("/request", response_model=RideResponse)
async def request_ride(
    body: RideRequestBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mother requests an emergency ride. Dispatches to nearby online drivers."""
    ride = await RideService.request_ride(db, current_user.id, body)
    ride = await RideService.get_ride(db, ride.id, current_user.id)
    return _ride_to_response(ride, viewer_id=current_user.id)


@router.get("/active", response_model=RideResponse | None)
async def active_ride(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The caller's in-flight ride (either role), so the app can rehydrate
    the tracker / trip screen after a restart. `null` when there is none."""
    ride = await RideService.active_ride(db, current_user.id)
    return _ride_to_response(ride, viewer_id=current_user.id) if ride else None


@router.get("/history")
async def history(
    limit: int = Query(20, le=100), offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items = await RideService.get_history(db, current_user.id, limit, offset)
    return {"success": True, "data": {"rides": items}}


# --------------------------------------------------------------------------
# Driver dashboard
# --------------------------------------------------------------------------
@router.get("/available", response_model=AvailableRidesResponse)
async def available(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_driver(current_user)
    offers = await RideService.available_offers(db, current_user.id)
    return {"count": len(offers), "offers": offers}


@router.get("/stats", response_model=DriverStatsResponse)
async def stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_driver(current_user)
    return await RideService.driver_stats(db, current_user)


@router.patch("/availability", response_model=SimpleOk)
async def set_availability(
    body: AvailabilityBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_driver(current_user)
    await RideService.set_availability(db, current_user, body.is_available)
    return SimpleOk(message=f"You are {'accepting' if body.is_available else 'not accepting'} rides",
                    data={"is_available": body.is_available})


@router.post("/location", response_model=SimpleOk)
async def post_location(
    ping: LocationPing,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Driver GPS heartbeat. Streamed to the waiting mother during an active ride."""
    _require_driver(current_user)
    await RideService.update_driver_location(db, current_user, ping.lat, ping.lng, ping.heading)
    return SimpleOk(message="location updated")


# --------------------------------------------------------------------------
# Shared: fetch one ride / driver actions
# --------------------------------------------------------------------------
@router.get("/{ride_id}", response_model=RideResponse)
async def get_ride(
    ride_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ride = await RideService.get_ride(db, ride_id, current_user.id)
    return _ride_to_response(ride, viewer_id=current_user.id)


@router.get("/{ride_id}/route")
async def get_ride_route(
    ride_id: int,
    leg: str = Query("auto", description="'pickup' (driver->pickup), 'dropoff' (pickup->hospital), or 'auto'"),
    from_lat: float | None = Query(None),
    from_lng: float | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fresh turn-by-turn route for a leg of the trip. Used by the driver's
    navigation screen on load and whenever it detects it has gone off-route
    (pass the driver's current `from_lat`/`from_lng` for the pickup leg)."""
    ride = await RideService.get_ride(db, ride_id, current_user.id)
    if leg == "auto":
        leg = "dropoff" if ride.status.value == "IN_PROGRESS" else "pickup"

    if leg == "dropoff":
        origin = (ride.pickup_lat, ride.pickup_lng)
    else:
        prof = getattr(ride.driver, "driver_profile", None)
        if from_lat is not None and from_lng is not None:
            origin = (from_lat, from_lng)
        elif prof and prof.current_lat is not None:
            origin = (prof.current_lat, prof.current_lng)
        else:
            origin = (ride.pickup_lat, ride.pickup_lng)
    dest = (ride.pickup_lat, ride.pickup_lng) if leg == "pickup" else (ride.dropoff_lat, ride.dropoff_lng)
    route = await maps_service.get_directions(origin[0], origin[1], dest[0], dest[1])
    return {"success": True, "data": {"leg": leg, "route": route.model_dump()}}


@router.post("/{ride_id}/accept", response_model=RideResponse)
async def accept(ride_id: int, current_user: User = Depends(get_current_user),
                 db: AsyncSession = Depends(get_db)):
    _require_driver(current_user)
    return await RideService.accept_ride(db, ride_id, current_user.id)


@router.post("/{ride_id}/decline", response_model=SimpleOk)
async def decline(ride_id: int, current_user: User = Depends(get_current_user),
                  db: AsyncSession = Depends(get_db)):
    _require_driver(current_user)
    await RideService.decline_ride(db, ride_id, current_user.id)
    return SimpleOk(message="declined")


@router.post("/{ride_id}/arrived", response_model=RideResponse)
async def arrived(ride_id: int, current_user: User = Depends(get_current_user),
                  db: AsyncSession = Depends(get_db)):
    _require_driver(current_user)
    return await RideService.driver_arrived(db, ride_id, current_user.id)


@router.post("/{ride_id}/start", response_model=RideResponse)
async def start(ride_id: int, current_user: User = Depends(get_current_user),
                db: AsyncSession = Depends(get_db)):
    _require_driver(current_user)
    return await RideService.start_trip(db, ride_id, current_user.id)


@router.post("/{ride_id}/complete", response_model=RideResponse)
async def complete(ride_id: int, current_user: User = Depends(get_current_user),
                   db: AsyncSession = Depends(get_db)):
    _require_driver(current_user)
    return await RideService.complete_trip(db, ride_id, current_user.id)


@router.post("/{ride_id}/cancel", response_model=RideResponse)
async def cancel(ride_id: int, body: CancelBody | None = None,
                 current_user: User = Depends(get_current_user),
                 db: AsyncSession = Depends(get_db)):
    reason = body.reason if body else None
    return await RideService.cancel_ride(db, ride_id, current_user.id, reason)


@router.post("/{ride_id}/rate", response_model=SimpleOk)
async def rate(ride_id: int, body: RideRatingBody,
               current_user: User = Depends(get_current_user),
               db: AsyncSession = Depends(get_db)):
    await RideService.rate_ride(db, ride_id, current_user.id, body.rating, body.feedback)
    return SimpleOk(message="Thanks for the feedback")
