import { create } from 'zustand';

/**
 * Driver-side ride/dispatch store. Mirrors the backend `RideStatusEnum` 1:1
 * (see backend-new/app/modules/rides/models.py) so a `ride_*` WebSocket /
 * FCM event applies with no translation layer - same approach as
 * store/callStore.ts.
 *
 * The mother app has its own copy of this file with the same shape.
 */
export type RideStatus =
  | 'IDLE'
  | 'SEARCHING'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_EN_ROUTE'
  | 'DRIVER_ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_DRIVERS'
  | 'FAILED';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RiderInfo {
  id: string;
  name: string;
  profile_picture?: string | null;
  phone?: string | null;
  trimester?: string | null;
  pregnancy_week?: string | null;
}

export interface DriverInfo {
  id: string;
  name: string;
  profile_picture?: string | null;
  phone?: string | null;
  rating_avg?: number;
  rating_count?: number;
  total_trips?: number;
  vehicle_brand?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  plate_number?: string | null;
  vehicle_type?: string | null;
  current_lat?: number | null;
  current_lng?: number | null;
  heading?: number | null;
}

export interface RouteStep {
  instruction: string;
  maneuver?: string | null;
  distance_meters: number;
  duration_seconds: number;
  start: LatLng;
  end: LatLng;
  polyline?: string | null;
}

export interface RouteInfo {
  distance_meters: number;
  duration_seconds: number;
  polyline?: string | null;
  steps: RouteStep[];
  is_estimate: boolean;
}

/** Live progress from each driver GPS heartbeat (backend `ride_progress`). */
export interface RideProgress {
  phase: 'to_pickup' | 'at_pickup' | 'to_dropoff';
  remaining_meters: number;
  eta_seconds: number;
  /** close enough to tell her to get ready / that she is nearly there */
  near: boolean;
}

export interface Ride {
  id: number;
  status: RideStatus;
  rider_id: string;
  driver_id?: string | null;
  pickup: LatLng;
  pickup_address?: string | null;
  dropoff: LatLng;
  dropoff_address?: string | null;
  dropoff_name?: string | null;
  distance_meters?: number | null;
  duration_seconds?: number | null;
  route_polyline?: string | null;
  fare_estimate?: number | null;
  fare_final?: number | null;
  rider_rating?: number | null;
  driver_rating?: number | null;
  notify_contacts?: boolean;
  /** set when her driver backed out and a new one is being found */
  rematching?: boolean;
  requested_at?: string | null;
  assigned_at?: string | null;
  arrived_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  rider?: RiderInfo | null;
  driver?: DriverInfo | null;
  next_route?: RouteInfo | null;
}

/** A pending offer shown on the dashboard's "Available Emergency Requests". */
export interface RideOffer {
  ride_id: number;
  offer_id?: number;
  pickup_address?: string | null;
  dropoff_name?: string | null;
  dropoff_address?: string | null;
  pickup: LatLng;
  dropoff: LatLng;
  distance_meters?: number | null;        // driver -> pickup
  trip_distance_meters?: number | null;
  trip_duration_seconds?: number | null;
  fare_estimate?: number | null;
  rider?: RiderInfo | null;
  offered_at?: string | null;
  expires_in_seconds?: number;
}

interface RideState {
  status: RideStatus;
  ride: Ride | null;
  offers: RideOffer[];
  /** live driver position (mother app populates this from ride_driver_location) */
  driverLocation: { lat: number; lng: number; heading?: number | null; ts?: string } | null;
  progress: RideProgress | null;

  lastEventRideId: number | null;
  lastEventStatus: RideStatus | null;

  upsertOffer: (offer: RideOffer) => void;
  removeOffer: (rideId: number) => void;
  setOffers: (offers: RideOffer[]) => void;
  setRide: (ride: Ride | null) => void;
  patchRide: (patch: Partial<Ride> & { status?: RideStatus }) => void;
  setDriverLocation: (loc: { lat: number; lng: number; heading?: number | null; ts?: string }, progress?: RideProgress | null) => void;
  clear: (status?: RideStatus) => void;
  /** ignore an event that doesn't apply to the ride we're tracking */
  isStale: (rideId: number) => boolean;
}

const initial = {
  status: 'IDLE' as RideStatus,
  ride: null,
  offers: [] as RideOffer[],
  driverLocation: null,
  progress: null as RideProgress | null,
  lastEventRideId: null,
  lastEventStatus: null,
};

export const useRideStore = create<RideState>((set, get) => ({
  ...initial,

  isStale: (rideId) => {
    const current = get().ride?.id ?? null;
    return current !== null && current !== rideId;
  },

  upsertOffer: (offer) => set((s) => {
    const rest = s.offers.filter((o) => o.ride_id !== offer.ride_id);
    return {
      offers: [...rest, offer].sort(
        (a, b) => (a.distance_meters ?? 1e12) - (b.distance_meters ?? 1e12),
      ),
    };
  }),

  removeOffer: (rideId) => set((s) => ({ offers: s.offers.filter((o) => o.ride_id !== rideId) })),

  setOffers: (offers) => set({
    offers: [...offers].sort(
      (a, b) => (a.distance_meters ?? 1e12) - (b.distance_meters ?? 1e12),
    ),
  }),

  setRide: (ride) => set({
    ride,
    status: ride?.status ?? 'IDLE',
    lastEventRideId: ride?.id ?? null,
    lastEventStatus: ride?.status ?? null,
  }),

  patchRide: (patch) => set((s) => {
    const next = s.ride ? { ...s.ride, ...patch } : (patch.id ? (patch as Ride) : s.ride);
    const phaseChanged = patch.status && patch.status !== s.status;
    return {
      ride: next,
      // progress is per leg; a new status (arrived, started) makes the old figure meaningless
      progress: phaseChanged ? null : s.progress,
      status: patch.status ?? s.status,
      lastEventRideId: next?.id ?? s.lastEventRideId,
      lastEventStatus: patch.status ?? s.lastEventStatus,
    };
  }),

  setDriverLocation: (loc, progress) => set((s) => ({ driverLocation: loc, progress: progress ?? s.progress })),

  clear: (status = 'IDLE') => set({ ...initial, status, lastEventStatus: status }),
}));
