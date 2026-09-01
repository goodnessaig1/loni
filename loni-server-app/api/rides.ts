import { apiClient } from './client';
import type { Ride, RideOffer } from '../store/rideStore';

export interface DriverStats {
  rating_avg: number;
  rating_count: number;
  total_earnings: number;
  total_trips: number;
  trips_today: number;
  earnings_today: number;
  is_online: boolean;
  is_available: boolean;
}

export interface RideHistoryItem {
  id: number;
  status: string;
  pickup_address?: string | null;
  dropoff_name?: string | null;
  dropoff_address?: string | null;
  fare_final?: number | null;
  fare_estimate?: number | null;
  distance_meters?: number | null;
  created_at?: string | null;
  completed_at?: string | null;
  counterpart_name?: string | null;
  counterpart_photo?: string | null;
}

export const ridesApi = {
  available: async (): Promise<{ count: number; offers: RideOffer[] }> => {
    const res = await apiClient.get('/rides/available');
    return res.data;
  },
  stats: async (): Promise<DriverStats> => {
    const res = await apiClient.get('/rides/stats');
    return res.data;
  },
  history: async (limit = 20, offset = 0): Promise<RideHistoryItem[]> => {
    const res = await apiClient.get('/rides/history', { params: { limit, offset } });
    return res.data?.data?.rides ?? [];
  },
  get: async (rideId: number): Promise<Ride> => {
    const res = await apiClient.get(`/rides/${rideId}`);
    return res.data;
  },
  route: async (
    rideId: number,
    leg: 'pickup' | 'dropoff' | 'auto' = 'auto',
    from?: { lat: number; lng: number },
  ) => {
    const res = await apiClient.get(`/rides/${rideId}/route`, {
      params: { leg, from_lat: from?.lat, from_lng: from?.lng },
    });
    return res.data?.data as { leg: string; route: import('../store/rideStore').RouteInfo };
  },
  active: async (): Promise<Ride | null> => {
    const res = await apiClient.get('/rides/active');
    return res.data ?? null;
  },
  setAvailability: async (is_available: boolean) => {
    const res = await apiClient.patch('/rides/availability', { is_available });
    return res.data;
  },
  postLocation: async (lat: number, lng: number, heading?: number | null) => {
    await apiClient.post('/rides/location', { lat, lng, heading: heading ?? null });
  },
  accept: async (rideId: number): Promise<Ride> => (await apiClient.post(`/rides/${rideId}/accept`)).data,
  decline: async (rideId: number) => (await apiClient.post(`/rides/${rideId}/decline`)).data,
  arrived: async (rideId: number): Promise<Ride> => (await apiClient.post(`/rides/${rideId}/arrived`)).data,
  start: async (rideId: number): Promise<Ride> => (await apiClient.post(`/rides/${rideId}/start`)).data,
  complete: async (rideId: number): Promise<Ride> => (await apiClient.post(`/rides/${rideId}/complete`)).data,
  cancel: async (rideId: number, reason?: string): Promise<Ride> =>
    (await apiClient.post(`/rides/${rideId}/cancel`, { reason })).data,
  rate: async (rideId: number, rating: number, feedback?: string) =>
    (await apiClient.post(`/rides/${rideId}/rate`, { rating, feedback })).data,
};
