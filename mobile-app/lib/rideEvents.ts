/**
 * MOTHER-side handler for server `ride_*` events (WebSocket or foreground
 * FCM data message). Store-only: it never navigates - the ride tracker UI
 * (components/RideTrackerModal.tsx + app/ride/[id].tsx) renders purely from
 * `useRideStore`.
 *
 * FCM data payloads arrive with every value stringified (backend
 * notifications/service.py `_stringify`); the WebSocket delivers real
 * objects. `parseRideData` normalises both.
 */
import { useRideStore, Ride } from '../store/rideStore';

export function parseRideData(data: any): any {
  if (!data) return data;
  const out = { ...data };
  for (const key of ['rider', 'driver', 'pickup', 'dropoff', 'next_route']) {
    if (typeof out[key] === 'string') {
      try { out[key] = JSON.parse(out[key]); } catch { /* leave */ }
    }
  }
  return out;
}

const STATUS_BY_EVENT: Record<string, Ride['status']> = {
  ride_accepted: 'DRIVER_ASSIGNED',
  ride_driver_arrived: 'DRIVER_ARRIVED',
  ride_started: 'IN_PROGRESS',
  ride_completed: 'COMPLETED',
  ride_cancelled: 'CANCELLED',
  ride_no_drivers: 'NO_DRIVERS',
};

export function applyServerRideEvent(type: string, raw: any) {
  const store = useRideStore.getState();
  const data = parseRideData(raw);
  const rideId = Number(data?.ride_id ?? data?.id);
  if (!rideId) return;

  if (type === 'ride_driver_location') {
    if (store.ride?.id === rideId || store.ride == null) {
      store.setDriverLocation({
        lat: Number(data.lat),
        lng: Number(data.lng),
        heading: data.heading != null ? Number(data.heading) : null,
        ts: data.ts,
      });
    }
    return;
  }

  const status = STATUS_BY_EVENT[type];
  if (!status) return;
  if (store.isStale(rideId)) return;

  store.patchRide({ id: rideId, status, ...(data as Partial<Ride>) });
}
