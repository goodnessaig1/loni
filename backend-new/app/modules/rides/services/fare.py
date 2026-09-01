"""Distance/time based fare estimate (Naira). No real payment integration -
this just produces the number shown to the mother and recorded as the
driver's earnings on trip completion."""
import math

from app.core.config import settings


def estimate_fare(distance_meters: int | None, duration_seconds: int | None) -> int:
    km = (distance_meters or 0) / 1000.0
    minutes = (duration_seconds or 0) / 60.0
    raw = settings.RIDE_BASE_FARE + settings.RIDE_PER_KM * km + settings.RIDE_PER_MIN * minutes
    fare = max(settings.RIDE_MIN_FARE, raw)
    # Round up to the nearest ₦100.
    return int(math.ceil(fare / 100.0) * 100)


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """Great-circle distance in metres - the fallback when Google Directions
    is unavailable, and used to rank drivers by proximity to a pickup."""
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return int(2 * r * math.asin(math.sqrt(a)))
