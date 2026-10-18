import { apiClient } from './client';
import type { Ride, LatLng, RouteInfo } from '../store/rideStore';

export interface Quote {
  pickup: LatLng;
  pickup_address?: string | null;
  dropoff: LatLng;
  dropoff_address?: string | null;
  dropoff_name?: string | null;
  dropoff_place_id?: string | null;
  route: RouteInfo;
  fare_estimate: number;
}

export interface Hospital {
  name: string;
  address?: string | null;
  place_id?: string | null;
  location: LatLng;
  distance_meters?: number | null;
}

export const ridesApi = {
  quote: async (body: {
    pickup: LatLng;
    pickup_address?: string;
    dropoff?: LatLng;
    dropoff_name?: string;
    dropoff_place_id?: string;
    nearest_hospital?: boolean;
  }): Promise<Quote> => (await apiClient.post('/rides/quote', body)).data,

  hospitals: async (lat: number, lng: number): Promise<Hospital[]> => {
    const res = await apiClient.get('/rides/hospitals', { params: { lat, lng } });
    return res.data?.data?.hospitals ?? [];
  },

  request: async (body: {
    pickup: LatLng;
    pickup_address?: string;
    dropoff?: LatLng;
    dropoff_name?: string;
    dropoff_place_id?: string;
    nearest_hospital?: boolean;
    notify_contacts?: boolean;
  }): Promise<Ride> => (await apiClient.post('/rides/request', body)).data,

  get: async (rideId: number): Promise<Ride> => (await apiClient.get(`/rides/${rideId}`)).data,
  active: async (): Promise<Ride | null> => (await apiClient.get('/rides/active')).data ?? null,
  cancel: async (rideId: number, reason?: string): Promise<Ride> =>
    (await apiClient.post(`/rides/${rideId}/cancel`, { reason })).data,
  /** 'share' = share the live trip with her support partners; 'arrived' = tell them she arrived safely */
  notifyContacts: async (rideId: number, kind: 'share' | 'arrived'): Promise<{ message: string; data: { notified: number } }> =>
    (await apiClient.post(`/rides/${rideId}/notify-contacts`, { kind })).data,
  rate: async (rideId: number, rating: number, feedback?: string) =>
    (await apiClient.post(`/rides/${rideId}/rate`, { rating, feedback })).data,
  history: async (limit = 20): Promise<any[]> => {
    const res = await apiClient.get('/rides/history', { params: { limit } });
    return res.data?.data?.rides ?? [];
  },
};
