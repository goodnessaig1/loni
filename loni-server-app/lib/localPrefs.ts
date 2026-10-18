import * as SecureStore from 'expo-secure-store';

/**
 * Settings the device itself has to act on, even with no React tree (index.js plays the ringtone
 * from a background push). Mirrored from the server's account settings whenever they load or change.
 */
const CALL_SOUNDS = 'pref_call_sounds';

export async function rememberCallSounds(on: boolean) {
  try { await SecureStore.setItemAsync(CALL_SOUNDS, on ? 'true' : 'false'); } catch { /* best effort */ }
}

export async function callSoundsEnabled(): Promise<boolean> {
  try { return (await SecureStore.getItemAsync(CALL_SOUNDS)) !== 'false'; } catch { return true; }
}
