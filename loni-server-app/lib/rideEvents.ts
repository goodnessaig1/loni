/**
 * Single place that turns a server-sent `ride_*` event (WebSocket or a
 * foreground FCM data message) into ride-store mutations + navigation for
 * the DRIVER app. Same role as lib/callEvents.ts for calls.
 *
 * Double delivery (WS + push both fire for every state change by design -
 * see backend rides `_emit()`) is expected, so every handler is idempotent
 * and checks the store before acting.
 */
import { router } from 'expo-router';
import { apiClient } from '../api/client';
import { useRideStore, RideOffer, Ride } from '../store/rideStore';

export type ServerRideEventType =
  | 'ride_request'
  | 'ride_taken'
  | 'ride_cancelled'
  | 'ride_accepted'
  | 'ride_driver_arrived'
  | 'ride_started'
  | 'ride_completed'
  | 'ride_no_drivers'
  | 'ride_driver_location';

/**
 * FCM data payloads arrive with every value stringified (see backend
 * notifications/service.py `_stringify`), while the WebSocket delivers real
 * objects. Normalise the nested fields so the rest of this file doesn't
 * care which transport it came from.
 */
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

function toOffer(raw: any): RideOffer {
  const data = parseRideData(raw);
  return {
    ride_id: Number(data.ride_id ?? data.id),
    offer_id: data.offer_id,
    pickup_address: data.pickup_address ?? null,
    dropoff_name: data.dropoff_name ?? null,
    dropoff_address: data.dropoff_address ?? null,
    pickup: data.pickup,
    dropoff: data.dropoff,
    distance_meters: data.driver_distance_meters ?? data.distance_meters ?? null,
    trip_distance_meters: data.trip_distance_meters ?? null,
    trip_duration_seconds: data.trip_duration_seconds ?? null,
    fare_estimate: data.fare_estimate ?? null,
    rider: data.rider ?? null,
    offered_at: data.offered_at ?? new Date().toISOString(),
    expires_in_seconds: data.expires_in_seconds ?? 30,
  };
}

/** Accept a ride from anywhere (notification action, request screen). */
export async function acceptRideDirect(rideId: number): Promise<Ride> {
  const res = await apiClient.post(`/rides/${rideId}/accept`);
  const ride = res.data as Ride;
  useRideStore.getState().setRide(ride);
  useRideStore.getState().removeOffer(rideId);
  return ride;
}

export async function declineRideDirect(rideId: number): Promise<void> {
  try {
    await apiClient.post(`/rides/${rideId}/decline`);
  } finally {
    useRideStore.getState().removeOffer(rideId);
  }
}

export function applyServerRideEvent(type: string, raw: any) {
  const store = useRideStore.getState();
  const data = parseRideData(raw);
  const rideId = Number(data?.ride_id ?? data?.id);

  switch (type) {
    case 'ride_request': {
      if (!rideId) return;
      // Already on a trip? ignore new offers.
      if (store.ride && store.ride.status !== 'IDLE' && store.ride.status !== 'COMPLETED'
          && store.ride.status !== 'CANCELLED') {
        return;
      }
      store.upsertOffer(toOffer(data));
      // Emergency: surface the request immediately when the app is open.
      router.push(`/driver/request/${rideId}`);
      return;
    }

    case 'ride_taken': {
      if (!rideId) return;
      store.removeOffer(rideId);
      return;
    }

    case 'ride_cancelled': {
      if (!rideId) return;
      store.removeOffer(rideId);
      if (store.ride?.id === rideId) {
        store.clear('CANCELLED');
        router.replace('/(driver)');
      }
      return;
    }

    // The driver's own accept/arrived/start/complete go through the REST
    // response, not WS - but handle echoes defensively.
    case 'ride_accepted':
    case 'ride_driver_arrived':
    case 'ride_started': {
      if (!rideId || store.isStale(rideId)) return;
      store.patchRide({ id: rideId, status: statusForEvent(type), ...(data as Partial<Ride>) });
      return;
    }

    case 'ride_completed': {
      if (!rideId || store.isStale(rideId)) return;
      store.patchRide({ id: rideId, status: 'COMPLETED', ...(data as Partial<Ride>) });
      return;
    }

    default:
      return;
  }
}

function statusForEvent(type: string): Ride['status'] {
  switch (type) {
    case 'ride_accepted': return 'DRIVER_ASSIGNED';
    case 'ride_driver_arrived': return 'DRIVER_ARRIVED';
    case 'ride_started': return 'IN_PROGRESS';
    default: return 'DRIVER_ASSIGNED';
  }
}
