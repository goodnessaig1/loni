"""
Google Maps integration for the ride module - Directions, Places (nearest
hospital) and Geocoding.

Every function is defensive: on a missing API key, an HTTP error, a non-OK
Google status, or a parse failure it returns a sensible fallback (haversine
route with no polyline, empty hospital list, echoed address) and NEVER
raises into a request handler. The `is_estimate` flag on RouteInfo tells the
caller whether the numbers came from Google or from the straight-line
fallback.
"""
import logging
import re
from typing import Optional

import httpx

from app.core.config import settings
from app.modules.rides.schemas import RouteInfo, RouteStep, LatLng, HospitalInfo
from app.modules.rides.services.fare import haversine_meters

logger = logging.getLogger("rides.maps")

_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"
_PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

# Rough average city speed (m/s) for the no-API-key duration fallback (~28 km/h).
_FALLBACK_SPEED_MPS = 7.8
_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    return _TAG_RE.sub("", text or "").replace("&nbsp;", " ").strip()


def _fallback_route(o_lat: float, o_lng: float, d_lat: float, d_lng: float) -> RouteInfo:
    dist = haversine_meters(o_lat, o_lng, d_lat, d_lng)
    # Inflate straight-line a little to approximate real road distance.
    dist = int(dist * 1.35)
    return RouteInfo(
        distance_meters=dist,
        duration_seconds=int(dist / _FALLBACK_SPEED_MPS),
        polyline=None,
        steps=[],
        is_estimate=True,
    )


async def get_directions(
    o_lat: float, o_lng: float, d_lat: float, d_lng: float
) -> RouteInfo:
    if not settings.GOOGLE_MAPS_API_KEY:
        return _fallback_route(o_lat, o_lng, d_lat, d_lng)

    params = {
        "origin": f"{o_lat},{o_lng}",
        "destination": f"{d_lat},{d_lng}",
        "mode": "driving",
        "key": settings.GOOGLE_MAPS_API_KEY,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(_DIRECTIONS_URL, params=params)
        body = resp.json()
        if body.get("status") != "OK" or not body.get("routes"):
            logger.warning("Directions non-OK: %s %s", body.get("status"), body.get("error_message"))
            return _fallback_route(o_lat, o_lng, d_lat, d_lng)

        route = body["routes"][0]
        leg = route["legs"][0]
        steps = []
        for s in leg.get("steps", []):
            steps.append(RouteStep(
                instruction=_strip_html(s.get("html_instructions", "")),
                maneuver=s.get("maneuver"),
                distance_meters=int(s.get("distance", {}).get("value", 0)),
                duration_seconds=int(s.get("duration", {}).get("value", 0)),
                start=LatLng(lat=s["start_location"]["lat"], lng=s["start_location"]["lng"]),
                end=LatLng(lat=s["end_location"]["lat"], lng=s["end_location"]["lng"]),
                polyline=s.get("polyline", {}).get("points"),
            ))
        return RouteInfo(
            distance_meters=int(leg.get("distance", {}).get("value", 0)),
            duration_seconds=int(leg.get("duration", {}).get("value", 0)),
            polyline=route.get("overview_polyline", {}).get("points"),
            steps=steps,
            is_estimate=False,
        )
    except Exception as e:  # network, JSON, schema - all non-fatal
        logger.warning("Directions failed: %s", e)
        return _fallback_route(o_lat, o_lng, d_lat, d_lng)


async def nearest_hospitals(lat: float, lng: float, limit: int = 5) -> list[HospitalInfo]:
    if not settings.GOOGLE_MAPS_API_KEY:
        return []
    params = {
        "location": f"{lat},{lng}",
        "rankby": "distance",
        "type": "hospital",
        "key": settings.GOOGLE_MAPS_API_KEY,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(_PLACES_NEARBY_URL, params=params)
        body = resp.json()
        if body.get("status") not in ("OK", "ZERO_RESULTS"):
            logger.warning("Places non-OK: %s %s", body.get("status"), body.get("error_message"))
            return []
        out: list[HospitalInfo] = []
        for r in body.get("results", [])[:limit]:
            loc = r.get("geometry", {}).get("location", {})
            if "lat" not in loc:
                continue
            h_lat, h_lng = loc["lat"], loc["lng"]
            out.append(HospitalInfo(
                name=r.get("name", "Hospital"),
                address=r.get("vicinity"),
                place_id=r.get("place_id"),
                location=LatLng(lat=h_lat, lng=h_lng),
                distance_meters=haversine_meters(lat, lng, h_lat, h_lng),
            ))
        return out
    except Exception as e:
        logger.warning("Places failed: %s", e)
        return []


async def reverse_geocode(lat: float, lng: float) -> Optional[str]:
    if not settings.GOOGLE_MAPS_API_KEY:
        return None
    params = {"latlng": f"{lat},{lng}", "key": settings.GOOGLE_MAPS_API_KEY}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(_GEOCODE_URL, params=params)
        body = resp.json()
        results = body.get("results", [])
        if results:
            return results[0].get("formatted_address")
    except Exception as e:
        logger.warning("Reverse geocode failed: %s", e)
    return None
