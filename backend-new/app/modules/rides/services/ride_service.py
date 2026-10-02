"""
Emergency ride dispatch state machine.

Same shape as app/modules/calls/services/call_service.py:
  * `_emit()` fans every state change out over BOTH the WebSocket
    (ws_manager, instant, foregrounded app) and FCM (NotificationService,
    wakes a backgrounded/killed app). The client dedupes by (ride_id, status).
  * a timeout watchdog runs in its own DB session because the request
    session is closed by the time it fires.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, or_, and_, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.ws_manager import manager as ws_manager
from app.modules.notifications.service import NotificationService
from app.modules.notifications.models import NotificationLog
from app.modules.users.models import (
    User, UserTypeEnum, DriverProfile, EmergencyContact,
)
from app.utils.user_enrichment import enrich_user_data
from app.modules.rides.models import (
    Ride, RideEvent, RideOffer, RideStatusEnum, RideOfferStatusEnum,
    ACTIVE_STATUSES, TERMINAL_STATUSES,
)
from app.modules.rides.schemas import (
    LatLng, RiderInfo, DriverInfo, RouteInfo,
)
from app.modules.rides.services import maps_service
from app.modules.rides.services.fare import estimate_fare, haversine_meters

logger = logging.getLogger("ride_service")


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
async def _emit(user_id: str, event_type: str, title: str, body: str, data: dict):
    """WS (instant) + FCM (wake-up) fan-out for one recipient."""
    try:
        delivered = await ws_manager.send_to_user(user_id, event_type, data)
    except Exception as e:
        delivered = False
        logger.warning("ride WS emit failed user=%s: %s", user_id, e)
    logger.info("emit %s -> user=%s (ws=%s)", event_type, user_id, delivered)
    asyncio.create_task(
        NotificationService.notify_user(user_id, title, body, {"type": event_type, **data})
    )


async def _fanout_to_contacts(db: AsyncSession, ride: Ride, event_type: str, title: str, body: str,
                               data: dict, *, ws_only: bool = False, log: bool = False) -> None:
    """
    Mirror a ride event to every connected emergency contact (the partner
    app), so a mother in an emergency ride is tracked live by whoever she
    asked to be notified - not just the driver's own trip. Only fires when
    she opted in (`ride.notify_contacts`) and only to contacts with
    `emergency` alerts enabled.

    `ws_only` skips FCM entirely - used for the high-frequency location
    heartbeat, where a push per GPS tick would be noisy and wasteful for a
    recipient who isn't even looking at the app. `log` additionally
    persists a NotificationLog row (for events worth keeping in the
    partner's Notification Centre, not just live state).
    """
    if not ride.notify_contacts:
        return
    contacts = (await db.execute(
        select(EmergencyContact).where(
            EmergencyContact.user_id == ride.rider_id,
            EmergencyContact.emergency.is_(True),
        )
    )).scalars().all()
    for c in contacts:
        if ws_only:
            try:
                await ws_manager.send_to_user(c.contact_user_id, event_type, data)
            except Exception as e:
                logger.warning("contact fanout WS emit failed: %s", e)
        else:
            await _emit(c.contact_user_id, event_type, title, body, data)
        if log:
            db.add(NotificationLog(
                user_id=c.contact_user_id, type=event_type, title=title, body=body, data=data,
            ))
    if log and contacts:
        await db.commit()


def _rider_info(user: Optional[User]) -> Optional[RiderInfo]:
    if not user:
        return None
    data = enrich_user_data(user)
    return RiderInfo(
        id=data["id"],
        name=data["name"],
        profile_picture=data.get("profile_picture"),
        phone=data.get("phone"),
        trimester=data.get("trimester"),
        pregnancy_week=data.get("pregnancyWeek") or data.get("pregnancy_week"),
    )


def _driver_info(user: Optional[User], profile: Optional[DriverProfile]) -> Optional[DriverInfo]:
    if not user:
        return None
    p = profile or getattr(user, "driver_profile", None)
    return DriverInfo(
        id=user.id,
        name=user.name,
        profile_picture=user.profile_picture,
        phone=user.phone,
        rating_avg=round(float(p.rating_avg or 0), 1) if p else 0,
        rating_count=(p.rating_count or 0) if p else 0,
        total_trips=(p.total_trips or 0) if p else 0,
        vehicle_brand=p.vehicle_brand if p else None,
        vehicle_model=p.vehicle_model if p else None,
        vehicle_color=p.vehicle_color if p else None,
        plate_number=p.plate_number if p else None,
        vehicle_type=p.vehicle_type if p else None,
        current_lat=p.current_lat if p else None,
        current_lng=p.current_lng if p else None,
        heading=p.heading if p else None,
    )


async def _load_user(db: AsyncSession, user_id: str) -> Optional[User]:
    res = await db.execute(
        select(User)
        .options(selectinload(User.driver_profile), selectinload(User.nurse_profile))
        .where(User.id == user_id)
    )
    return res.scalar_one_or_none()


def _ride_payload(ride: Ride, *, rider: Optional[User] = None,
                  driver: Optional[User] = None, driver_profile: Optional[DriverProfile] = None,
                  next_route: Optional[RouteInfo] = None) -> dict:
    """The dict shipped over WS/FCM and returned by the REST endpoints."""
    out = {
        "id": ride.id,
        "ride_id": str(ride.id),  # calls-module clients expect a string id key
        "status": ride.status.value,
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
        "requested_at": ride.requested_at.isoformat() if ride.requested_at else None,
        "assigned_at": ride.assigned_at.isoformat() if ride.assigned_at else None,
        "arrived_at": ride.arrived_at.isoformat() if ride.arrived_at else None,
        "started_at": ride.started_at.isoformat() if ride.started_at else None,
        "completed_at": ride.completed_at.isoformat() if ride.completed_at else None,
        "rider_rating": ride.rider_rating,
        "driver_rating": ride.driver_rating,
    }
    ri = _rider_info(rider)
    di = _driver_info(driver, driver_profile)
    if ri:
        out["rider"] = ri.model_dump()
    if di:
        out["driver"] = di.model_dump()
    if next_route:
        out["next_route"] = next_route.model_dump()
    return out


# --------------------------------------------------------------------------
# service
# --------------------------------------------------------------------------
class RideService:

    # ---- quote / hospital lookup ----------------------------------------
    @staticmethod
    async def resolve_dropoff(payload) -> tuple[float, float, Optional[str], Optional[str], Optional[str]]:
        """Returns (lat, lng, address, name, place_id). Picks the nearest
        hospital when the caller asked for it and gave no explicit dropoff."""
        if payload.dropoff:
            return (
                payload.dropoff.lat, payload.dropoff.lng,
                payload.dropoff_address, payload.dropoff_name, payload.dropoff_place_id,
            )
        if payload.nearest_hospital:
            hospitals = await maps_service.nearest_hospitals(payload.pickup.lat, payload.pickup.lng, limit=1)
            if hospitals:
                h = hospitals[0]
                return h.location.lat, h.location.lng, h.address, h.name, h.place_id
            # Dev / no-Google-key fallback so the flow still works end to end:
            # a synthetic destination ~2 km north-east of the pickup.
            logger.warning("No hospital results for (%s, %s) - using synthetic fallback destination",
                           payload.pickup.lat, payload.pickup.lng)
            return (
                payload.pickup.lat + 0.018, payload.pickup.lng + 0.006,
                None, "Nearest hospital", None,
            )
        raise HTTPException(status_code=400, detail="A destination hospital is required")

    @staticmethod
    async def quote(payload) -> dict:
        d_lat, d_lng, d_addr, d_name, d_place = await RideService.resolve_dropoff(payload)
        route = await maps_service.get_directions(
            payload.pickup.lat, payload.pickup.lng, d_lat, d_lng
        )
        fare = estimate_fare(route.distance_meters, route.duration_seconds)
        return {
            "pickup": {"lat": payload.pickup.lat, "lng": payload.pickup.lng},
            "pickup_address": payload.pickup_address,
            "dropoff": {"lat": d_lat, "lng": d_lng},
            "dropoff_address": d_addr,
            "dropoff_name": d_name,
            "dropoff_place_id": d_place,
            "route": route.model_dump(),
            "fare_estimate": fare,
        }

    # ---- request + dispatch -------------------------------------------
    @staticmethod
    async def request_ride(db: AsyncSession, rider_id: str, body) -> Ride:
        rider = await _load_user(db, rider_id)
        if not rider:
            raise HTTPException(status_code=404, detail="Rider not found")

        # One active ride per mother at a time.
        existing = await db.execute(
            select(Ride).where(
                Ride.rider_id == rider_id,
                Ride.status.notin_(list(TERMINAL_STATUSES)),
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=409, detail="You already have an active ride request")

        d_lat, d_lng, d_addr, d_name, d_place = await RideService.resolve_dropoff(body)
        pickup_addr = body.pickup_address or await maps_service.reverse_geocode(
            body.pickup.lat, body.pickup.lng
        )
        route = await maps_service.get_directions(body.pickup.lat, body.pickup.lng, d_lat, d_lng)
        fare = estimate_fare(route.distance_meters, route.duration_seconds)

        ride = Ride(
            rider_id=rider_id,
            status=RideStatusEnum.SEARCHING,
            pickup_lat=body.pickup.lat,
            pickup_lng=body.pickup.lng,
            pickup_address=pickup_addr,
            dropoff_lat=d_lat,
            dropoff_lng=d_lng,
            dropoff_address=d_addr,
            dropoff_name=d_name,
            dropoff_place_id=d_place,
            distance_meters=route.distance_meters,
            duration_seconds=route.duration_seconds,
            route_polyline=route.polyline,
            fare_estimate=fare,
            notify_contacts=bool(body.notify_contacts),
        )
        db.add(ride)
        await db.flush()
        db.add(RideEvent(ride_id=ride.id, event_type="RideRequested", payload={"fare_estimate": fare}))
        await db.commit()
        await db.refresh(ride)

        offered = await RideService._dispatch(db, ride, settings.RIDE_SEARCH_RADIUS_KM)
        if offered == 0:
            await RideService._mark_no_drivers(db, ride.id)
        else:
            asyncio.create_task(RideService._offer_timeout_watchdog(ride.id))

        if ride.notify_contacts:
            asyncio.create_task(RideService._alert_contacts(rider_id, ride.id))

        await db.refresh(ride)
        return ride

    @staticmethod
    async def _candidate_drivers(db: AsyncSession, ride: Ride, radius_km: float,
                                 exclude: set[str]) -> list[tuple[User, DriverProfile, Optional[int]]]:
        res = await db.execute(
            select(User, DriverProfile)
            .join(DriverProfile, DriverProfile.user_id == User.id)
            .where(
                User.user_type == UserTypeEnum.driver,
                User.account_status == "active",
                User.is_online.is_(True),
                DriverProfile.is_available.is_(True),
                DriverProfile.active_ride_id.is_(None),
            )
        )
        eligible: list[tuple[User, DriverProfile, Optional[int]]] = []
        within: list[tuple[User, DriverProfile, Optional[int]]] = []
        for user, profile in res.all():
            if user.id in exclude:
                continue
            if profile.current_lat is None or profile.current_lng is None:
                # Online but no GPS fix yet - offer anyway, can't rank by distance.
                eligible.append((user, profile, None))
                within.append((user, profile, None))
                continue
            dist = haversine_meters(
                ride.pickup_lat, ride.pickup_lng, profile.current_lat, profile.current_lng
            )
            eligible.append((user, profile, dist))
            if dist <= radius_km * 1000:
                within.append((user, profile, dist))

        # Prefer drivers inside the radius; but if none qualify (common in
        # dev when emulators default to far-apart locations, and a valid
        # "nobody nearby but here's the closest" case in prod), fall back to
        # every eligible driver, nearest first. NO_DRIVERS then means there
        # is genuinely nobody online.
        chosen = within if within else eligible
        chosen.sort(key=lambda t: (t[2] is None, t[2] or 0))
        return chosen

    @staticmethod
    async def _dispatch(db: AsyncSession, ride: Ride, radius_km: float) -> int:
        """Create a RideOffer per nearby driver and emit `ride_request` to each.
        Returns the number of drivers offered this round."""
        already = await db.execute(select(RideOffer.driver_id).where(RideOffer.ride_id == ride.id))
        exclude = {r for r in already.scalars().all()}

        online_total = (await db.execute(
            select(func.count(User.id))
            .join(DriverProfile, DriverProfile.user_id == User.id)
            .where(
                User.user_type == UserTypeEnum.driver,
                User.is_online.is_(True),
                DriverProfile.is_available.is_(True),
                DriverProfile.active_ride_id.is_(None),
            )
        )).scalar() or 0

        candidates = await RideService._candidate_drivers(db, ride, radius_km, exclude)
        logger.info(
            "dispatch ride=%s: %s online+available driver(s) total, offering to %s (excl. %s already offered)",
            ride.id, online_total, len(candidates), len(exclude),
        )
        if not candidates:
            return 0

        rider = await _load_user(db, ride.rider_id)
        ri = _rider_info(rider)
        for user, profile, dist in candidates:
            db.add(RideOffer(
                ride_id=ride.id, driver_id=user.id,
                status=RideOfferStatusEnum.OFFERED, distance_meters=dist,
            ))
        await db.commit()

        payload = {
            "ride_id": str(ride.id),
            "id": ride.id,
            "status": ride.status.value,
            "pickup": {"lat": ride.pickup_lat, "lng": ride.pickup_lng},
            "pickup_address": ride.pickup_address,
            "dropoff": {"lat": ride.dropoff_lat, "lng": ride.dropoff_lng},
            "dropoff_name": ride.dropoff_name,
            "dropoff_address": ride.dropoff_address,
            "trip_distance_meters": ride.distance_meters,
            "trip_duration_seconds": ride.duration_seconds,
            "fare_estimate": ride.fare_estimate,
            "rider": ri.model_dump() if ri else None,
            "expires_in_seconds": settings.RIDE_OFFER_TIMEOUT_SECONDS,
        }
        for user, profile, dist in candidates:
            body_txt = f"{ride.pickup_address or 'A mother'} -> {ride.dropoff_name or 'hospital'}"
            away = f" - {round(dist / 1000, 1)}km away" if dist is not None else ""
            asyncio.create_task(_emit(
                user.id, "ride_request", "Emergency Transport Request",
                f"{body_txt}{away}", {**payload, "driver_distance_meters": dist},
            ))
        return len(candidates)

    @staticmethod
    async def _mark_no_drivers(db: AsyncSession, ride_id: int):
        res = await db.execute(select(Ride).where(Ride.id == ride_id).with_for_update())
        ride = res.scalar_one_or_none()
        if not ride or ride.status != RideStatusEnum.SEARCHING:
            return
        ride.status = RideStatusEnum.NO_DRIVERS
        db.add(RideEvent(ride_id=ride.id, event_type="RideNoDrivers"))
        await db.commit()
        await _emit(
            ride.rider_id, "ride_no_drivers", "No drivers available",
            "We couldn't reach a driver right now. Please try again or call a nurse.",
            {"ride_id": str(ride.id), "id": ride.id, "status": ride.status.value},
        )

    @staticmethod
    async def _offer_timeout_watchdog(ride_id: int):
        # Two rounds: after the first timeout we re-offer (drivers who were
        # already offered stay offered, plus any new ones). Only after the
        # second timeout with still nobody eligible do we give up.
        for round_no in range(2):
            await asyncio.sleep(settings.RIDE_OFFER_TIMEOUT_SECONDS)
            async with AsyncSessionLocal() as db:
                res = await db.execute(select(Ride).where(Ride.id == ride_id).with_for_update())
                ride = res.scalar_one_or_none()
                if not ride or ride.status != RideStatusEnum.SEARCHING:
                    return  # accepted / cancelled - done

                # Any drivers offered and not yet resolved? keep waiting on them.
                pending = (await db.execute(
                    select(func.count(RideOffer.id)).where(
                        RideOffer.ride_id == ride_id,
                        RideOffer.status == RideOfferStatusEnum.OFFERED,
                    )
                )).scalar() or 0

                # Re-dispatch to pick up anyone who came online since.
                new_offered = await RideService._dispatch(db, ride, settings.RIDE_SEARCH_RADIUS_MAX_KM)

                if pending == 0 and new_offered == 0 and round_no == 1:
                    await RideService._mark_no_drivers(db, ride_id)
                    return

    @staticmethod
    async def _alert_contacts(rider_id: str, ride_id: int):
        async with AsyncSessionLocal() as db:
            rider = await _load_user(db, rider_id)
            ride = (await db.execute(select(Ride).where(Ride.id == ride_id))).scalar_one_or_none()
            if not rider or not ride:
                return
            data = {
                "ride_id": str(ride.id),
                "id": ride.id,
                "status": ride.status.value,
                "rider_name": rider.name,
                "pickup_address": ride.pickup_address,
                "dropoff_name": ride.dropoff_name,
                "requested_at": ride.requested_at.isoformat() if ride.requested_at else None,
            }
            await _fanout_to_contacts(
                db, ride, "ride_contact_alert", "Emergency alert",
                f"{rider.name} may need your help.", data, log=True,
            )

    # ---- driver: available offers ------------------------------------
    @staticmethod
    async def available_offers(db: AsyncSession, driver_id: str) -> list[dict]:
        res = await db.execute(
            select(RideOffer, Ride)
            .join(Ride, Ride.id == RideOffer.ride_id)
            .where(
                RideOffer.driver_id == driver_id,
                RideOffer.status == RideOfferStatusEnum.OFFERED,
                Ride.status == RideStatusEnum.SEARCHING,
            )
            .order_by(RideOffer.distance_meters.asc().nulls_last())
        )
        rows = res.all()
        out = []
        for offer, ride in rows:
            rider = await _load_user(db, ride.rider_id)
            ri = _rider_info(rider)
            age = (datetime.now(timezone.utc) - offer.offered_at).total_seconds() if offer.offered_at else 0
            out.append({
                "ride_id": ride.id,
                "offer_id": offer.id,
                "pickup_address": ride.pickup_address,
                "dropoff_name": ride.dropoff_name,
                "dropoff_address": ride.dropoff_address,
                "pickup": {"lat": ride.pickup_lat, "lng": ride.pickup_lng},
                "dropoff": {"lat": ride.dropoff_lat, "lng": ride.dropoff_lng},
                "distance_meters": offer.distance_meters,
                "trip_distance_meters": ride.distance_meters,
                "trip_duration_seconds": ride.duration_seconds,
                "fare_estimate": ride.fare_estimate,
                "rider": ri.model_dump() if ri else None,
                "offered_at": offer.offered_at.isoformat() if offer.offered_at else None,
                "expires_in_seconds": max(0, int(settings.RIDE_OFFER_TIMEOUT_SECONDS - age)),
            })
        return out

    # ---- accept / decline -------------------------------------------
    @staticmethod
    async def accept_ride(db: AsyncSession, ride_id: int, driver_id: str) -> dict:
        res = await db.execute(select(Ride).where(Ride.id == ride_id).with_for_update())
        ride = res.scalar_one_or_none()
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")
        if ride.status != RideStatusEnum.SEARCHING or ride.driver_id:
            raise HTTPException(status_code=409, detail="This ride has already been taken or cancelled")

        driver = await _load_user(db, driver_id)
        if not driver or driver.user_type != UserTypeEnum.driver:
            raise HTTPException(status_code=403, detail="Only drivers can accept rides")
        profile = driver.driver_profile
        if not profile or profile.active_ride_id:
            raise HTTPException(status_code=409, detail="Finish your current trip first")

        ride.driver_id = driver_id
        ride.status = RideStatusEnum.DRIVER_ASSIGNED
        ride.assigned_at = datetime.now(timezone.utc)
        profile.active_ride_id = ride.id
        profile.is_available = False

        # Resolve offers: this driver ACCEPTED, everyone else EXPIRED.
        offers = (await db.execute(select(RideOffer).where(RideOffer.ride_id == ride.id))).scalars().all()
        for o in offers:
            if o.driver_id == driver_id:
                o.status = RideOfferStatusEnum.ACCEPTED
            elif o.status == RideOfferStatusEnum.OFFERED:
                o.status = RideOfferStatusEnum.EXPIRED
            o.responded_at = o.responded_at or datetime.now(timezone.utc)

        db.add(RideEvent(ride_id=ride.id, event_type="RideAccepted", payload={"driver_id": driver_id}))
        await db.commit()
        await db.refresh(ride)

        rider = await _load_user(db, ride.rider_id)
        # route driver -> pickup
        to_pickup = None
        if profile.current_lat is not None:
            to_pickup = await maps_service.get_directions(
                profile.current_lat, profile.current_lng, ride.pickup_lat, ride.pickup_lng
            )

        payload = _ride_payload(ride, rider=rider, driver=driver, driver_profile=profile,
                                next_route=to_pickup)
        await _emit(
            ride.rider_id, "ride_accepted", "Driver on the way",
            f"{driver.name} accepted your request and is heading to you.", payload,
        )
        # Tell the other offered drivers to clear the request.
        for o in offers:
            if o.driver_id != driver_id:
                asyncio.create_task(_emit(
                    o.driver_id, "ride_taken", "Request taken",
                    "Another driver accepted that request.",
                    {"ride_id": str(ride.id), "id": ride.id, "status": ride.status.value},
                ))
        return payload

    @staticmethod
    async def decline_ride(db: AsyncSession, ride_id: int, driver_id: str) -> None:
        res = await db.execute(
            select(RideOffer).where(RideOffer.ride_id == ride_id, RideOffer.driver_id == driver_id)
        )
        offer = res.scalar_one_or_none()
        if offer and offer.status == RideOfferStatusEnum.OFFERED:
            offer.status = RideOfferStatusEnum.DECLINED
            offer.responded_at = datetime.now(timezone.utc)
            await db.commit()

    # ---- trip lifecycle --------------------------------------------
    @staticmethod
    async def _transition(db: AsyncSession, ride_id: int, driver_id: str,
                          expect: tuple, new: RideStatusEnum, ts_field: str,
                          event: str) -> Ride:
        res = await db.execute(select(Ride).where(Ride.id == ride_id).with_for_update())
        ride = res.scalar_one_or_none()
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")
        if ride.driver_id != driver_id:
            raise HTTPException(status_code=403, detail="Not your ride")
        if ride.status not in expect:
            raise HTTPException(status_code=409, detail=f"Ride is {ride.status.value}, cannot {event}")
        ride.status = new
        setattr(ride, ts_field, datetime.now(timezone.utc))
        db.add(RideEvent(ride_id=ride.id, event_type=event))
        await db.commit()
        await db.refresh(ride)
        return ride

    @staticmethod
    async def driver_arrived(db: AsyncSession, ride_id: int, driver_id: str) -> dict:
        ride = await RideService._transition(
            db, ride_id, driver_id,
            (RideStatusEnum.DRIVER_ASSIGNED, RideStatusEnum.DRIVER_EN_ROUTE),
            RideStatusEnum.DRIVER_ARRIVED, "arrived_at", "DriverArrived",
        )
        rider = await _load_user(db, ride.rider_id)
        driver = await _load_user(db, driver_id)
        payload = _ride_payload(ride, rider=rider, driver=driver)
        await _emit(ride.rider_id, "ride_driver_arrived", "Your driver has arrived",
                    "Your driver is waiting outside.", payload)
        await _fanout_to_contacts(
            db, ride, "ride_driver_arrived", "Driver has arrived",
            f"{driver.name if driver else 'The driver'} is waiting for {rider.name if rider else 'her'}.", payload,
        )
        return payload

    @staticmethod
    async def start_trip(db: AsyncSession, ride_id: int, driver_id: str) -> dict:
        ride = await RideService._transition(
            db, ride_id, driver_id,
            (RideStatusEnum.DRIVER_ARRIVED, RideStatusEnum.DRIVER_ASSIGNED),
            RideStatusEnum.IN_PROGRESS, "started_at", "TripStarted",
        )
        rider = await _load_user(db, ride.rider_id)
        driver = await _load_user(db, driver_id)
        to_dest = await maps_service.get_directions(
            ride.pickup_lat, ride.pickup_lng, ride.dropoff_lat, ride.dropoff_lng
        )
        payload = _ride_payload(ride, rider=rider, driver=driver, next_route=to_dest)
        await _emit(ride.rider_id, "ride_started", "On the way to hospital",
                    f"Heading to {ride.dropoff_name or 'the hospital'}.", payload)
        await _fanout_to_contacts(
            db, ride, "ride_started", "On the way to the hospital",
            f"{rider.name if rider else 'She'} is heading to {ride.dropoff_name or 'the hospital'}.", payload,
        )
        return payload

    @staticmethod
    async def complete_trip(db: AsyncSession, ride_id: int, driver_id: str) -> dict:
        res = await db.execute(select(Ride).where(Ride.id == ride_id).with_for_update())
        ride = res.scalar_one_or_none()
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")
        if ride.driver_id != driver_id:
            raise HTTPException(status_code=403, detail="Not your ride")
        if ride.status in TERMINAL_STATUSES:
            return _ride_payload(ride)
        if ride.status != RideStatusEnum.IN_PROGRESS:
            raise HTTPException(status_code=409, detail=f"Ride is {ride.status.value}, cannot complete")

        ride.status = RideStatusEnum.COMPLETED
        ride.completed_at = datetime.now(timezone.utc)
        ride.fare_final = ride.fare_estimate
        db.add(RideEvent(ride_id=ride.id, event_type="TripCompleted", payload={"fare": ride.fare_final}))

        driver = await _load_user(db, driver_id)
        profile = driver.driver_profile if driver else None
        if profile:
            profile.active_ride_id = None
            profile.is_available = True
            profile.total_trips = (profile.total_trips or 0) + 1
            profile.total_earnings = (profile.total_earnings or 0) + (ride.fare_final or 0)
        await db.commit()
        await db.refresh(ride)

        rider = await _load_user(db, ride.rider_id)
        payload = _ride_payload(ride, rider=rider, driver=driver, driver_profile=profile)
        await _emit(ride.rider_id, "ride_completed", "You've arrived",
                    f"Trip complete. Fare: ₦{ride.fare_final:,}", payload)
        await _fanout_to_contacts(
            db, ride, "ride_completed", "Trip completed",
            f"{rider.name if rider else 'She'} has arrived safely.", payload, log=True,
        )
        return payload

    @staticmethod
    async def cancel_ride(db: AsyncSession, ride_id: int, user_id: str, reason: Optional[str]) -> dict:
        res = await db.execute(select(Ride).where(Ride.id == ride_id).with_for_update())
        ride = res.scalar_one_or_none()
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")
        if user_id not in (ride.rider_id, ride.driver_id):
            raise HTTPException(status_code=403, detail="Not your ride")
        if ride.status in TERMINAL_STATUSES:
            return _ride_payload(ride)
        if ride.status == RideStatusEnum.IN_PROGRESS:
            raise HTTPException(status_code=409, detail="A trip in progress can't be cancelled")

        ride.status = RideStatusEnum.CANCELLED
        ride.cancelled_at = datetime.now(timezone.utc)
        ride.cancelled_by = user_id
        ride.cancel_reason = reason
        db.add(RideEvent(ride_id=ride.id, event_type="RideCancelled",
                         payload={"by": user_id, "reason": reason}))

        # free the driver
        if ride.driver_id:
            drv = await _load_user(db, ride.driver_id)
            if drv and drv.driver_profile and drv.driver_profile.active_ride_id == ride.id:
                drv.driver_profile.active_ride_id = None
                drv.driver_profile.is_available = True
        # expire outstanding offers
        for o in (await db.execute(select(RideOffer).where(RideOffer.ride_id == ride.id))).scalars().all():
            if o.status == RideOfferStatusEnum.OFFERED:
                o.status = RideOfferStatusEnum.EXPIRED
        await db.commit()
        await db.refresh(ride)

        other = ride.driver_id if user_id == ride.rider_id else ride.rider_id
        payload = _ride_payload(ride)
        if other:
            await _emit(other, "ride_cancelled", "Ride cancelled",
                        "The ride was cancelled." + (f" ({reason})" if reason else ""), payload)
        await _fanout_to_contacts(
            db, ride, "ride_cancelled", "Ride cancelled",
            "The emergency ride was cancelled.", payload, log=True,
        )
        return payload

    # ---- driver location heartbeat --------------------------------
    @staticmethod
    async def update_driver_location(db: AsyncSession, driver: User,
                                     lat: float, lng: float, heading: Optional[float]) -> None:
        profile = driver.driver_profile
        if not profile:
            raise HTTPException(status_code=403, detail="Not a driver")
        profile.current_lat = lat
        profile.current_lng = lng
        profile.heading = heading
        profile.location_updated_at = datetime.now(timezone.utc)
        await db.commit()

        if not profile.active_ride_id:
            return
        ride = (await db.execute(select(Ride).where(Ride.id == profile.active_ride_id))).scalar_one_or_none()
        if ride and ride.status in ACTIVE_STATUSES:
            location_data = {
                "ride_id": str(ride.id),
                "id": ride.id,
                "lat": lat, "lng": lng, "heading": heading,
                "ts": datetime.now(timezone.utc).isoformat(),
            }
            # WS only - high frequency, no FCM.
            try:
                await ws_manager.send_to_user(ride.rider_id, "ride_driver_location", location_data)
            except Exception as e:
                logger.warning("driver location WS emit failed: %s", e)
            await _fanout_to_contacts(db, ride, "ride_driver_location", "", "", location_data, ws_only=True)

    # ---- rating / history / stats --------------------------------
    @staticmethod
    async def rate_ride(db: AsyncSession, ride_id: int, user_id: str,
                        rating: int, feedback: Optional[str]) -> None:
        res = await db.execute(select(Ride).where(Ride.id == ride_id).with_for_update())
        ride = res.scalar_one_or_none()
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")
        if user_id not in (ride.rider_id, ride.driver_id):
            raise HTTPException(status_code=403, detail="Not your ride")

        if user_id == ride.rider_id:
            ride.rider_rating = rating
            ride.rider_feedback = feedback
            if ride.driver_id:
                drv = await _load_user(db, ride.driver_id)
                p = drv.driver_profile if drv else None
                if p:
                    total = (p.rating_avg or 0) * (p.rating_count or 0) + rating
                    p.rating_count = (p.rating_count or 0) + 1
                    p.rating_avg = round(total / p.rating_count, 2)
        else:
            ride.driver_rating = rating
        await db.commit()

    @staticmethod
    async def get_ride(db: AsyncSession, ride_id: int, user_id: str) -> Ride:
        res = await db.execute(
            select(Ride)
            .options(
                selectinload(Ride.rider).selectinload(User.driver_profile),
                selectinload(Ride.rider).selectinload(User.nurse_profile),
                selectinload(Ride.driver).selectinload(User.driver_profile),
                selectinload(Ride.driver).selectinload(User.nurse_profile),
            )
            .where(Ride.id == ride_id)
        )
        ride = res.scalar_one_or_none()
        if not ride:
            raise HTTPException(status_code=404, detail="Ride not found")
        if user_id not in (ride.rider_id, ride.driver_id):
            if not (ride.notify_contacts and await RideService._is_connected_partner(db, ride.rider_id, user_id)):
                raise HTTPException(status_code=403, detail="Not your ride")
        return ride

    @staticmethod
    async def _is_connected_partner(db: AsyncSession, rider_id: str, viewer_id: str) -> bool:
        """True when `viewer_id` is an emergency contact of `rider_id` with
        emergency alerts enabled - lets a connected partner track a ride the
        mother chose to notify contacts about (see `_alert_contacts`)."""
        res = await db.execute(
            select(EmergencyContact.id).where(
                EmergencyContact.user_id == rider_id,
                EmergencyContact.contact_user_id == viewer_id,
                EmergencyContact.emergency.is_(True),
            )
        )
        return res.scalar_one_or_none() is not None

    @staticmethod
    async def active_ride(db: AsyncSession, user_id: str) -> Optional[Ride]:
        res = await db.execute(
            select(Ride)
            .options(
                selectinload(Ride.rider).selectinload(User.driver_profile),
                selectinload(Ride.rider).selectinload(User.nurse_profile),
                selectinload(Ride.driver).selectinload(User.driver_profile),
                selectinload(Ride.driver).selectinload(User.nurse_profile),
            )
            .where(
                or_(Ride.rider_id == user_id, Ride.driver_id == user_id),
                Ride.status.notin_(list(TERMINAL_STATUSES)),
            )
            .order_by(desc(Ride.created_at))
        )
        return res.scalars().first()

    @staticmethod
    async def get_history(db: AsyncSession, user_id: str, limit: int, offset: int) -> list[dict]:
        res = await db.execute(
            select(Ride)
            .options(
                selectinload(Ride.rider),
                selectinload(Ride.driver),
            )
            .where(or_(Ride.rider_id == user_id, Ride.driver_id == user_id))
            .order_by(desc(Ride.created_at))
            .limit(limit).offset(offset)
        )
        out = []
        for ride in res.scalars().all():
            counterpart = ride.driver if user_id == ride.rider_id else ride.rider
            out.append({
                "id": ride.id,
                "status": ride.status.value,
                "pickup_address": ride.pickup_address,
                "dropoff_name": ride.dropoff_name,
                "dropoff_address": ride.dropoff_address,
                "fare_final": ride.fare_final,
                "fare_estimate": ride.fare_estimate,
                "distance_meters": ride.distance_meters,
                "created_at": ride.created_at.isoformat() if ride.created_at else None,
                "completed_at": ride.completed_at.isoformat() if ride.completed_at else None,
                "counterpart_name": counterpart.name if counterpart else None,
                "counterpart_photo": counterpart.profile_picture if counterpart else None,
            })
        return out

    @staticmethod
    async def driver_stats(db: AsyncSession, driver: User) -> dict:
        p = driver.driver_profile
        start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today = await db.execute(
            select(func.count(Ride.id), func.coalesce(func.sum(Ride.fare_final), 0))
            .where(
                Ride.driver_id == driver.id,
                Ride.status == RideStatusEnum.COMPLETED,
                Ride.completed_at >= start_of_day,
            )
        )
        trips_today, earnings_today = today.one()
        return {
            "rating_avg": round(float(p.rating_avg or 0), 1) if p else 0,
            "rating_count": (p.rating_count or 0) if p else 0,
            "total_earnings": (p.total_earnings or 0) if p else 0,
            "total_trips": (p.total_trips or 0) if p else 0,
            "trips_today": int(trips_today or 0),
            "earnings_today": int(earnings_today or 0),
            "is_online": bool(driver.is_online),
            "is_available": bool(p.is_available) if p else False,
        }

    @staticmethod
    async def set_availability(db: AsyncSession, driver: User, is_available: bool) -> None:
        if not driver.driver_profile:
            raise HTTPException(status_code=403, detail="Not a driver")
        driver.driver_profile.is_available = is_available
        await db.commit()
