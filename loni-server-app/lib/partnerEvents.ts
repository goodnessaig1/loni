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
import { partnerConnectionKeys } from '../hooks/usePartnerConnection';
import { Alert } from 'react-native';

/** Set by NotificationContext: signs the partner out (used when she removes them). */
let signOut: (() => Promise<void>) | null = null;
export function registerPartnerSignOut(fn: (() => Promise<void>) | null) {
  signOut = fn;
}
let removedHandled = false;

/** Refetch everything a partner sees (after reconnecting, or when her sharing/stage changed). */
export function refreshPartnerViews() {
  queryClient.invalidateQueries({ queryKey: partnerDashboardKeys.dashboard });
  queryClient.invalidateQueries({ queryKey: partnerConnectionKeys.connection });
  queryClient.invalidateQueries({ queryKey: notificationKeys.list });
  queryClient.invalidateQueries({ queryKey: ['partner', 'updates'] });
  queryClient.invalidateQueries({ queryKey: ['partner', 'ride'] });
}

const REFRESH_EVENTS = new Set([
  'ride_contact_alert',
  'ride_accepted',
  'ride_arrived_safely',
  'ride_driver_cancelled',
  'ride_no_drivers',
  'ride_driver_arrived',
  'ride_started',
  'ride_completed',
  'ride_cancelled',
  'pregnancy_update',
]);

export function applyPartnerEvent(type: string, data: any) {
  // She removed this partner: the account is gone, so sign out (once - WS and push both arrive).
  if (type === 'partner_removed') {
    if (removedHandled) return;
    removedHandled = true;
    Alert.alert('Connection ended', 'She removed you from her support circle, so this account has been closed.');
    signOut?.().finally(() => { removedHandled = false; });
    return;
  }
  // She changed what she shares, or her stage: everything on screen may differ now.
  if (type === 'partner_sharing_changed' || type === 'partner_stage_changed') {
    refreshPartnerViews();
    return;
  }

  if (type === 'ride_driver_location') {
    const rideId = Number(data?.ride_id ?? data?.id);
    if (!rideId) return;
    // Only patches an already-cached ride (i.e. the tracking screen is
    // open) - no fetch is triggered for a ride nobody is looking at.
    const lat = Number(data.lat);
    const lng = Number(data.lng);
    queryClient.setQueryData(['partner', 'ride', rideId], (prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        driver: prev.driver
          ? { ...prev.driver, current_lat: lat, current_lng: lng, heading: data.heading }
          : prev.driver,
        progress: data.phase ? { phase: data.phase, remaining_meters: Number(data.remaining_meters), eta_seconds: Number(data.eta_seconds) } : prev.progress,
      };
    });
    // Home and "Her shared location" read the dashboard: move the pin there too.
    queryClient.setQueryData(partnerDashboardKeys.dashboard, (prev: any) => {
      const alert = prev?.active_alert;
      if (!alert || Number(alert.ride_id) !== rideId) return prev;
      return {
        ...prev,
        active_alert: { ...alert, driver_location: { lat, lng, updated_at: data.ts ?? null } },
      };
    });
    return;
  }

  if (!REFRESH_EVENTS.has(type)) return;

  queryClient.invalidateQueries({ queryKey: partnerDashboardKeys.dashboard });
  queryClient.invalidateQueries({ queryKey: notificationKeys.list });
  if (type === 'pregnancy_update') queryClient.invalidateQueries({ queryKey: ['partner', 'updates'] });

  const rideId = Number(data?.ride_id ?? data?.id);
  if (rideId) {
    queryClient.invalidateQueries({ queryKey: ['partner', 'ride', rideId] });
  }
}
