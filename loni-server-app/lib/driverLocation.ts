/**
 * Driver location broadcaster.
 *
 * While the driver is online (accepting rides) or on an active trip, we
 * stream GPS fixes to the backend (`POST /rides/location`). The backend
 * uses the latest fix to pick the nearest driver for a new request and,
 * during an active ride, relays it to the waiting mother over the WebSocket
 * as `ride_driver_location`.
 *
 * Two modes:
 *   - foreground: `watchPositionAsync`, ~5s / 25m.
 *   - background / screen-off (active trip): `startLocationUpdatesAsync`
 *     with an Android foreground-service notification so Android doesn't
 *     kill the updates.
 *
 * The background task runs headless (no React tree), so it reads the auth
 * token straight from SecureStore and posts with `fetch`.
 */
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from '../api/client';

export const DRIVER_LOCATION_TASK = 'loni-driver-location';

let watcher: Location.LocationSubscription | null = null;
let mode: 'off' | 'foreground' | 'background' = 'off';

async function postFix(lat: number, lng: number, heading: number | null) {
  try {
    const token = await SecureStore.getItemAsync('userToken');
    if (!token) return;
    await fetch(`${API_URL}/rides/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lat, lng, heading }),
    });
  } catch {
    // best-effort; the next fix will retry
  }
}

TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const last = locations?.[locations.length - 1];
  if (!last) return;
  await postFix(last.coords.latitude, last.coords.longitude, last.coords.heading ?? null);
});

export async function ensureLocationPermission(background = false): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  if (background) {
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === 'granted';
  }
  return true;
}

/** Foreground-only streaming - used while the dashboard is open and online. */
export async function startForegroundLocation() {
  if (mode === 'foreground') return;
  await stopDriverLocation();
  const ok = await ensureLocationPermission(false);
  if (!ok) return;
  mode = 'foreground';
  watcher = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 25 },
    (loc) => postFix(loc.coords.latitude, loc.coords.longitude, loc.coords.heading ?? null),
  );
}

/** Background streaming with a foreground service - used during an active trip. */
export async function startTripLocation() {
  if (mode === 'background') return;
  await stopDriverLocation();
  const ok = await ensureLocationPermission(true);
  if (!ok) {
    // Fall back to foreground streaming if background was denied.
    await startForegroundLocation();
    return;
  }
  mode = 'background';
  const already = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK).catch(() => false);
  if (already) return;
  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 4000,
    distanceInterval: 20,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Loni — trip in progress',
      notificationBody: 'Sharing your live location with the passenger.',
      notificationColor: '#D62D88',
    },
    activityType: Location.ActivityType.AutomotiveNavigation,
  });
}

export async function stopDriverLocation() {
  mode = 'off';
  if (watcher) {
    watcher.remove();
    watcher = null;
  }
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
    if (started) await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  } catch {
    /* ignore */
  }
}

export function locationMode() {
  return mode;
}
