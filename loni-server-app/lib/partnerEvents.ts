/**
 * PARTNER-side handler for server `ride_*`/`pregnancy_update` events
 * arriving over the shared WebSocket (see api/socket.ts). Pushes updates
 * straight into the React Query cache instead of the UI relying on
 * polling to eventually notice a change.
 *
 * This runs for every authenticated session alongside lib/rideEvents.ts
 * (the driver's own trip dispatcher) - it's a safe no-op for a
 * driver/nurse session because the query keys it touches
 * (['partner','dashboard'], ['partner','ride',id], ['notifications'])
 * are never populated there: usePartnerDashboard only fetches for
 * user_type 'partner', so invalidating/writing to those keys for anyone
 * else hits no active observers and triggers no network call.
 */
import { queryClient } from './queryClient';
import { partnerDashboardKeys } from '../hooks/usePartnerDashboard';
import { notificationKeys } from '../hooks/useNotifications';

const REFRESH_EVENTS = new Set([
  'ride_contact_alert',
  'ride_driver_arrived',
  'ride_started',
  'ride_completed',
  'ride_cancelled',
  'pregnancy_update',
]);

export function applyPartnerEvent(type: string, data: any) {
  if (type === 'ride_driver_location') {
    const rideId = Number(data?.ride_id ?? data?.id);
    if (!rideId) return;
    // Only patches an already-cached ride (i.e. the tracking screen is
    // open) - no fetch is triggered for a ride nobody is looking at.
    queryClient.setQueryData(['partner', 'ride', rideId], (prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        driver: prev.driver
          ? { ...prev.driver, current_lat: data.lat, current_lng: data.lng, heading: data.heading }
          : prev.driver,
      };
    });
    return;
  }

  if (!REFRESH_EVENTS.has(type)) return;

  queryClient.invalidateQueries({ queryKey: partnerDashboardKeys.dashboard });
  queryClient.invalidateQueries({ queryKey: notificationKeys.list });

  const rideId = Number(data?.ride_id ?? data?.id);
  if (rideId) {
    queryClient.invalidateQueries({ queryKey: ['partner', 'ride', rideId] });
  }
}
