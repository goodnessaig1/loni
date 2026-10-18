/**
 * Push registration for this phone (same file in loni-server-app/lib/pushRegistration.ts).
 *
 *  registerPushToken(token)  tell the backend this phone's token belongs to the signed-in account
 *                            (the backend moves it away from any other account) and remember it
 *  unregisterPush()          on sign-out: remove this phone's tokens from the account, so a signed-out
 *                            nurse is not rung and the next account never gets the last one's alerts
 */
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

const KEY = 'pushTokens';

async function remembered(): Promise<string[]> {
  try {
    return JSON.parse((await SecureStore.getItemAsync(KEY)) || '[]');
  } catch {
    return [];
  }
}

export async function registerPushToken(token: string, deviceType: string = Platform.OS, deviceId?: string) {
  const id = deviceId ?? ((Platform.OS === 'android' ? Device.osBuildId : Device.modelId) || 'unknown_device');
  await apiClient.post('/notifications/devices', { device_id: id, device_type: deviceType, token });
  const tokens = await remembered();
  if (!tokens.includes(token)) {
    await SecureStore.setItemAsync(KEY, JSON.stringify([...tokens.slice(-4), token]));
  }
}

export async function unregisterPush(opts: { skipServer?: boolean } = {}): Promise<void> {
  const tokens = await remembered();
  // skipServer: the login already expired, so the backend would refuse; deleting the token still works.
  if (tokens.length && !opts.skipServer) {
    try {
      // Bounded: signing out must never hang on a bad connection.
      await apiClient.post('/notifications/devices/unregister', { tokens }, { timeout: 5000 });
    } catch {
      /* offline: deleting the Firebase token below still stops pushes reaching this install */
    }
  }
  try {
    const messaging = require('@react-native-firebase/messaging').default;
    await messaging().deleteToken();
  } catch {
    /* Firebase unavailable */
  }
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
}
