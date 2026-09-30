import { useQuery } from '@tanstack/react-query';
import { ridesApi } from '../api/rides';

/**
 * Driver dashboard data. `available` is also fed live by `ride_*` WS events
 * (see lib/rideEvents.ts) so React Query here is really just the initial
 * load + a slow safety-net refetch.
 */
export function useDriverStats(enabled = true) {
  return useQuery({
    queryKey: ['rides', 'stats'],
    queryFn: ridesApi.stats,
    enabled,
    staleTime: 15_000,
  });
}

export function useAvailableRides(enabled = true) {
  return useQuery({
    queryKey: ['rides', 'available'],
    queryFn: ridesApi.available,
    enabled,
    refetchInterval: enabled ? 20_000 : false,
    staleTime: 5_000,
  });
}

export function useRideHistory(limit = 20) {
  return useQuery({
    queryKey: ['rides', 'history', limit],
    queryFn: () => ridesApi.history(limit),
    staleTime: 30_000,
  });
}

export function useRide(rideId?: number) {
  return useQuery({
    queryKey: ['ride', rideId],
    queryFn: () => ridesApi.get(rideId as number),
    enabled: !!rideId,
  });
}
