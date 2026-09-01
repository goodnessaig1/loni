/**
 * Single place that reacts to the backend telling us a nurse/driver account
 * was approved (pending -> active).
 *
 * The backend fires this from `PATCH /admin/users/{id}/status` over THREE
 * transports by design (see backend-new/app/modules/admin/router.py):
 *   - the call-signaling WebSocket  -> `account_status` event (instant, app foregrounded)
 *   - an FCM data+notification push -> `type: account_approved` (wakes a backgrounded/killed app)
 *   - the verification-progress screen also polls `/users/me` as a last resort
 * All of them funnel through `handleAccountApproved()` here so double
 * delivery is a safe no-op rather than a double refresh / navigation race.
 *
 * `refreshUser` lives on the React AuthContext and can't be imported at
 * module scope, so NotificationContext registers it here once on mount.
 */
import { router } from 'expo-router';

type RefreshFn = () => Promise<void>;

let refreshUser: RefreshFn | null = null;
let lastHandledAt = 0;

export function registerAuthRefresh(fn: RefreshFn | null) {
  refreshUser = fn;
}

/**
 * Refresh the cached user (so `account_status` is now `active`) and send
 * them to the dashboard. De-duped across the ~few seconds it takes all
 * three transports to land.
 */
export async function handleAccountApproved() {
  const now = Date.now();
  if (now - lastHandledAt < 4000) return;
  lastHandledAt = now;

  try {
    await refreshUser?.();
  } catch (e) {
    console.warn('[AccountStatus] refresh after approval failed', e);
  }

  router.replace('/(tabs)');
}
