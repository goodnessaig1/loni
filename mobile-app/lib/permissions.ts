import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { Linking, PermissionsAndroid, Platform } from 'react-native';

/**
 * Centralized permission manager.
 *
 * Previously microphone permission was requested for the first time inside
 * components/CallModals.tsx, gated on `isActive && roomToken` - i.e. the
 * very first time `Audio.requestPermissionsAsync()` ever ran for a given
 * user was mid-call-setup, which is exactly the "permission dialog
 * interrupts the first call" UX problem. This module gives every screen
 * (onboarding, the call UI, settings) one shared place to check/request
 * permissions, so requesting can move to onboarding while the call UI just
 * reads the already-decided status.
 *
 * `expo-av`'s and `expo-notifications`' permission responses both return the
 * same shape (`{ granted, canAskAgain, status }`), so both are normalized
 * into one `PermissionStatus` here rather than each caller re-deriving it.
 */

export type PermissionStatus = 'granted' | 'denied' | 'blocked' | 'undetermined';

interface ExpoPermissionResponse {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

function mapExpoStatus(res: ExpoPermissionResponse): PermissionStatus {
  if (res.granted) return 'granted';
  // `canAskAgain: false` means the OS will no longer show its own prompt -
  // calling requestPermissionsAsync() again would just silently resolve
  // with the same denial. This is the "permanently denied" / iOS Settings-
  // only state, distinct from a plain first-time "denied".
  if (!res.canAskAgain) return 'blocked';
  return res.status === 'denied' ? 'denied' : 'undetermined';
}

// ---------------------------------------------------------------------------
// Microphone
// ---------------------------------------------------------------------------

/** Read-only status check - never shows a dialog. Safe to call from the call UI. */
export async function getMicrophonePermissionStatus(): Promise<PermissionStatus> {
  const res = await Audio.getPermissionsAsync();
  return mapExpoStatus(res);
}

/**
 * Requests microphone permission, but only actually triggers the native
 * dialog if the status is still undetermined - already-granted or
 * already-blocked short-circuit immediately. Safe to call repeatedly (e.g.
 * once at onboarding, then again defensively for existing users at app
 * launch) without ever showing a duplicate/unwanted prompt.
 */
export async function requestMicrophonePermission(): Promise<PermissionStatus> {
  const current = await Audio.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'blocked';
  const res = await Audio.requestPermissionsAsync();
  return mapExpoStatus(res);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  const res = await Notifications.getPermissionsAsync();
  return mapExpoStatus(res as unknown as ExpoPermissionResponse);
}

export async function requestNotificationPermission(): Promise<PermissionStatus> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'blocked';
  const res = await Notifications.requestPermissionsAsync();
  return mapExpoStatus(res as unknown as ExpoPermissionResponse);
}

// ---------------------------------------------------------------------------
// Android CallKeep (self-managed ConnectionService) permissions
// ---------------------------------------------------------------------------

/**
 * `react-native-callkeep`'s Android side gates almost everything behind its
 * own `hasPhoneAccount()` check, which requires `hasPermissions()` to be
 * true - and that checks `CALL_PHONE`, `RECORD_AUDIO`, and
 * `READ_PHONE_NUMBERS` (API 30+) or `READ_PHONE_STATE` (below API 30) via
 * plain `ContextCompat.checkSelfPermission` (confirmed by reading
 * node_modules/react-native-callkeep/android/.../RNCallKeepModule.java).
 * None of these are ever requested anywhere in this app's JS - so even
 * after the manifest fix (plugins/withCallKeepAndroid.js) resolves the
 * crash, `displayIncomingCall`/`startCall`/etc. would keep silently no-op'ing
 * forever (they log a warning and return rather than throw) because
 * `hasPhoneAccount()` would never return true. `READ_CALL_LOG` is also
 * required specifically for self-managed mode per the library's own README
 * ("Android Self Managed Mode" section) and is declared in app.json but,
 * like the others, still needs a runtime grant on Android 6+.
 *
 * Uses React Native's built-in `PermissionsAndroid.requestMultiple` (no new
 * dependency) rather than expo-av/expo-notifications since none of these
 * map to an Expo permissions module. Called once from
 * `lib/callKeepService.ts`'s `setupCallKeep()`, before `CK.setup()` - a
 * no-op safe to call repeatedly, same pattern as the rest of this file.
 */
export async function requestCallKeepAndroidPermissions(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const phoneNumberPermission =
    Platform.Version >= 30
      ? PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS
      : PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE;

  try {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
      phoneNumberPermission,
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
  } catch (e) {
    console.error('[Permissions] CallKeep Android permission request failed', e);
  }
}

// ---------------------------------------------------------------------------
// Bluetooth
// ---------------------------------------------------------------------------

/**
 * Both apps only ROUTE audio to already-paired Bluetooth devices during a
 * call (via @livekit/react-native's AudioSession, see lib/audioSession.ts)
 * - they never scan for or connect to new devices. That only requires the
 * legacy manifest-level `android.permission.BLUETOOTH` (already declared in
 * app.json), which needs no runtime prompt on any Android version. The
 * modern runtime `BLUETOOTH_CONNECT`/`BLUETOOTH_SCAN` permissions (Android
 * 12+/API 31+) are only required for scanning/pairing, so there is
 * genuinely nothing to request today. This function exists so that fact is
 * documented in one place rather than being a silent gap, and so a real
 * request can be dropped in here later if scanning/pairing is ever added.
 */
export async function getBluetoothPermissionStatus(): Promise<PermissionStatus> {
  return 'granted';
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface CallPermissionsResult {
  notifications: PermissionStatus;
  microphone: PermissionStatus;
  bluetooth: PermissionStatus;
}

/**
 * Requests every permission voice calling needs, in the product-specified
 * order (Notifications -> Microphone -> done). Intended to be called once
 * during onboarding (app/(auth)/permissions.tsx) and defensively again at
 * app launch for already-authenticated existing users who signed up before
 * this flow existed (see context/NotificationContext.tsx) - both call sites
 * are safe because each individual request function no-ops once a decision
 * has already been made.
 */
export async function requestAllCallPermissions(): Promise<CallPermissionsResult> {
  const notifications = await requestNotificationPermission();
  const microphone = await requestMicrophonePermission();
  const bluetooth = await getBluetoothPermissionStatus();
  return { notifications, microphone, bluetooth };
}

/** Everything a call actually needs to function is just the microphone. */
export function isCallReady(microphone: PermissionStatus): boolean {
  return microphone === 'granted';
}

/** Deep-links to this app's OS settings page - the only way out of 'blocked'. */
export function openAppSettings() {
  Linking.openSettings();
}
