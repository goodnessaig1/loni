# Emergency Ride Dispatch (`rides`)

Real-time driver dispatch for the "Emergency Ride" flow. Modelled on the
`calls` module — same `_emit()` dual-transport pattern (WebSocket + FCM),
same timeout-watchdog approach.

## Flow

```
mother  POST /rides/request
          │  (geocode, Google Directions for route+ETA, fare estimate)
          ▼
     Ride(status=SEARCHING)  ──dispatch──▶  RideOffer per nearby online driver
                                             + ride_request emit to each
     driver  POST /rides/{id}/accept   (first-accept-wins, row-locked)
          ▼
     DRIVER_ASSIGNED ──▶ (driver drives) ──▶ POST /arrived ──▶ DRIVER_ARRIVED
          ──▶ POST /start ──▶ IN_PROGRESS ──▶ POST /complete ──▶ COMPLETED
                                                (driver_profile.total_trips/earnings ++)
```

Driver GPS: `POST /rides/location` every few seconds while online / on a
trip. During an active ride the backend relays each fix to the mother as a
WebSocket `ride_driver_location` event (no FCM — too frequent).

`ride_*` events all ride the existing `/calls/ws` socket
(`ws_manager.send_to_user`) — the mobile clients route any `ride_*` message
type to their ride store.

## Config (`app/core/config.py` / `.env`)

| var | default | meaning |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | *(unset)* | Directions + Places + Geocoding. **Unset ⇒ haversine fallback** (straight-line distance ×1.35, no polyline, no hospital search) so the flow still works in dev. |
| `RIDE_BASE_FARE` | 1500 | ₦ |
| `RIDE_PER_KM` | 200 | ₦/km |
| `RIDE_PER_MIN` | 50 | ₦/min |
| `RIDE_MIN_FARE` | 2000 | ₦ floor |
| `RIDE_SEARCH_RADIUS_KM` | 8 | first dispatch radius |
| `RIDE_SEARCH_RADIUS_MAX_KM` | 20 | widened radius on retry |
| `RIDE_OFFER_TIMEOUT_SECONDS` | 30 | per dispatch round |

The Google key needs these APIs enabled: **Directions API**, **Places API**,
**Geocoding API** (server key, IP-restricted). The mobile apps use a
separate browser/SDK key (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`) with **Maps
SDK for Android/iOS** enabled.

## Migration

`db/migrations/versions/d5f1a7c93b20_add_rides_and_driver_dispatch.py`
adds `rides`, `ride_events`, `ride_offers` and the live-dispatch columns on
`driver_profiles`. Run `alembic upgrade head`.
