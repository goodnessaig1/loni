/**
 * Native OUTGOING call UI for the Mother app - CallKit on iOS,
 * ConnectionService (self-managed) on Android, via `react-native-callkeep`.
 *
 * This is what makes placing a call feel like a real phone call instead of
 * a custom in-app "Calling Nurse..." modal: native ringback tone on iOS
 * (no bundled audio file needed there - see hooks/useCall.ts and
 * app/nurse/connecting.tsx, which now skip the bundled ringback on iOS
 * specifically because CallKit's `startCall` provides it automatically),
 * the call shows in the system's Recents/call log, and audio routing
 * (speaker/Bluetooth/earpiece) is handled by the OS the same way it is for
 * a cellular call.
 *
 * KILL SWITCH: `react-native-callkeep` has caused repeated hard native
 * crashes on Android during testing (a TurboModule duplicate-@ReactMethod
 * parsing error, then an invalid drawable-resource-ID crash - both
 * confirmed and fixed by inspecting the library's own Java source in
 * node_modules, see CALL_SYSTEM_AUDIT.md) and at least one more that
 * couldn't be diagnosed without a captured crash log. Rather than keep
 * guessing at native bugs one at a time, EVERY exported function here is
 * gated behind `EXPO_PUBLIC_ENABLE_CALLKEEP` (mobile-app/.env, currently
 * "false"). While disabled, `react-native-callkeep` is never `require()`'d
 * at all - not even the JS wrapper is touched - so nothing it does can
 * crash the app. The rest of the calling flow (WebSocket/FCM signaling,
 * LiveKit audio, the in-app "Calling Nurse..." modal) is completely
 * independent of this file and works normally either way. Flip the env
 * var to "true" once you're ready to debug this further with `adb logcat`
 * output in hand.
 */

const CALLKEEP_ENABLED = process.env.EXPO_PUBLIC_ENABLE_CALLKEEP === 'true';

let isSetup = false;
let RNCallKeepModule: any = null;
let CK_CONSTANTS: any = null;
const callUUIDByCallId = new Map<number, string>();
const callIdByUUID = new Map<string, number>();

/** Lazily requires the native module ONLY if the kill switch is on. Never
 * throws - if the module can't load (not linked, native crash on import,
 * etc.) this just returns null and every caller treats that as "CallKeep
 * unavailable, skip it" rather than propagating the error. */
function loadCallKeep(): any {
  if (!CALLKEEP_ENABLED) return null;
  if (RNCallKeepModule) return RNCallKeepModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-callkeep');
    RNCallKeepModule = mod.default ?? mod;
    CK_CONSTANTS = mod.CONSTANTS;
    return RNCallKeepModule;
  } catch (e) {
    console.error('[CallKeep] Failed to load native module - disabling for this session', e);
    RNCallKeepModule = null;
    return null;
  }
}

function makeUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function forgetCall(callId: number) {
  const uuid = callUUIDByCallId.get(callId);
  if (uuid) callIdByUUID.delete(uuid);
  callUUIDByCallId.delete(callId);
}

export async function setupCallKeep(): Promise<void> {
  if (isSetup) return;
  const CK = loadCallKeep();
  if (!CK) return; // disabled, or failed to load - app continues without native call UI
  isSetup = true;

  // Must happen BEFORE CK.setup() - react-native-callkeep's Android side
  // gates startCall/etc. behind hasPhoneAccount(), which itself requires
  // CALL_PHONE, READ_PHONE_NUMBERS (or READ_PHONE_STATE below API 30) and
  // READ_CALL_LOG to already be granted (see lib/permissions.ts's
  // requestCallKeepAndroidPermissions for the full explanation). None of
  // these were ever requested anywhere before - without this, CallKeep
  // would silently no-op forever even after fixing the missing-manifest-
  // service crash.
  const { requestCallKeepAndroidPermissions } = await import('./permissions');
  await requestCallKeepAndroidPermissions();

  const options = {
    ios: {
      appName: 'Loni',
      supportsVideo: false,
      maximumCallGroups: '1',
      maximumCallsPerCallGroup: '1',
      includesCallsInRecents: false,
    },
    android: {
      alertTitle: 'Phone account permission required',
      alertDescription: 'Loni needs access to manage calls so your call works like a normal phone call.',
      cancelButton: 'Cancel',
      okButton: 'OK',
      imageName: 'phone_account_icon',
      additionalPermissions: [] as string[],
      // We must set selfManaged: false to force Android to use the true
      // native Google Dialer full-screen UI (as requested by the user).
      // Note: This will prompt the user to enable the app as a "Calling Account" in settings.
      selfManaged: false,
      foregroundService: {
        channelId: 'com.loni.app.calls',
        channelName: 'Loni Calls',
        notificationTitle: 'Loni is handling an active call',
      },
    },
  };

  try {
    await CK.setup(options);
    CK.setAvailable(true);
  } catch (e) {
    console.error('[CallKeep] setup failed', e);
    isSetup = false;
    return;
  }

  // The Mother hung up from the NATIVE call UI (lock screen / status bar
  // control / CarPlay etc.) rather than the in-app "End Call" button.
  CK.addEventListener('endCall', async ({ callUUID }: { callUUID: string }) => {
    const callId = callIdByUUID.get(callUUID);
    if (callId == null) return;
    try {
      const { useCallStore } = await import('../store/callStore');
      const { apiClient } = await import('../api/client');
      await apiClient.post(`/calls/${callId}/end`).catch(() => {});
      useCallStore.getState().endCall('ENDED');
    } catch (e) {
      console.error('[CallKeep] Failed to process native end call', e);
    } finally {
      forgetCall(callId);
    }
  });
}

/** Starts the native outgoing-call UI (Calling.../ringback) the moment the
 * Mother initiates a call - called from hooks/useCall.ts's requestCall.
 * No-op (returns null) if CallKeep is disabled/unavailable. */
export function startOutgoingCall(callId: number, calleeName: string): string | null {
  const CK = loadCallKeep();
  if (!CK) return null;
  const uuid = makeUUID();
  callUUIDByCallId.set(callId, uuid);
  callIdByUUID.set(uuid, callId);
  try {
    CK.startCall(uuid, calleeName, calleeName);
  } catch (e) {
    console.error('[CallKeep] startCall failed', e);
  }
  return uuid;
}

/** Marks the call answered/active in the native UI once LiveKit confirms
 * both participants joined - starts the native call timer display. */
export function reportConnected(callId: number) {
  const CK = loadCallKeep();
  const uuid = callUUIDByCallId.get(callId);
  if (CK && uuid) {
    try {
      CK.setCurrentCallActive(uuid);
    } catch (e) {
      console.error('[CallKeep] setCurrentCallActive failed', e);
    }
  }
}

/** Server-driven end (nurse declined/timed out/hung up, or the call ended
 * normally) - dismisses the native call UI without re-triggering our own
 * `endCall` listener's REST call. */
export function reportCallEnded(callId: number, reason?: number) {
  const CK = loadCallKeep();
  const uuid = callUUIDByCallId.get(callId);
  if (CK && uuid) {
    try {
      CK.reportEndCallWithUUID(uuid, reason ?? CK_CONSTANTS?.END_CALL_REASONS?.REMOTE_ENDED ?? 2);
    } catch (e) {
      console.error('[CallKeep] reportEndCallWithUUID failed', e);
    }
  }
  forgetCall(callId);
}
