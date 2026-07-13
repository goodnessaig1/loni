/**
 * Native call UI for the Nurse app - CallKit on iOS, ConnectionService
 * (self-managed) on Android via `react-native-callkeep`.
 *
 * This is the piece that makes an incoming call look and behave like a
 * real phone call (system ringtone/volume, lock-screen answer/decline,
 * appears while any other app is open, works with Bluetooth/CarPlay/Android
 * Auto) instead of a custom in-app modal that only exists while the JS
 * engine happens to be running. Critically, on iOS this is also the ONLY
 * way to legally/reliably wake a force-quit app for a call (paired with
 * PushKit - see lib/voipPush.ts) - see CALL_SYSTEM_AUDIT.md's Issue 4
 * section for why a plain remote push cannot do this on iOS.
 *
 * `react-native-callkeep` was already an installed dependency before this
 * fix (visible in package.json) but was never imported or used anywhere in
 * the app - this file is the integration that was missing.
 *
 * KILL SWITCH: this library has caused repeated hard native crashes on
 * Android during testing (a TurboModule duplicate-@ReactMethod parsing
 * error, then an invalid drawable-resource-ID crash - both confirmed and
 * fixed by inspecting the library's own Java source in node_modules, see
 * CALL_SYSTEM_AUDIT.md) and at least one more that couldn't be diagnosed
 * without a captured crash log. Every exported function here is gated
 * behind `EXPO_PUBLIC_ENABLE_CALLKEEP` (loni-server-app/.env, currently
 * "false"). While disabled, `react-native-callkeep` is never `require()`'d
 * - not even the JS wrapper is touched - so nothing it does can crash the
 * app. Incoming calls still work via notifee's full-screen notification +
 * Accept/Decline actions (index.js) either way; this file only adds the
 * native CallKit/ConnectionService layer on top. Flip the env var to
 * "true" once you're ready to debug this further with `adb logcat` output
 * in hand.
 */

const CALLKEEP_ENABLED = process.env.EXPO_PUBLIC_ENABLE_CALLKEEP === 'true';

let isSetup = false;
let RNCallKeepModule: any = null;
let CK_CONSTANTS: any = null;
const callUUIDByCallId = new Map<number, string>();
const callIdByUUID = new Map<string, number>();

/** Lazily requires the native module ONLY if the kill switch is on. Never
 * throws - if the module can't load for any reason this returns null and
 * every caller treats that as "CallKeep unavailable, skip it". */
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

function uuidForCall(callId: number): string {
  const existing = callUUIDByCallId.get(callId);
  if (existing) return existing;
  const uuid = makeUUID();
  callUUIDByCallId.set(callId, uuid);
  callIdByUUID.set(uuid, callId);
  return uuid;
}

function forgetCall(callId: number) {
  const uuid = callUUIDByCallId.get(callId);
  if (uuid) callIdByUUID.delete(uuid);
  callUUIDByCallId.delete(callId);
}

export async function setupCallKeep(): Promise<void> {
  if (isSetup) return;
  const CK = loadCallKeep();
  if (!CK) return; // disabled, or failed to load - app continues on notifee only
  isSetup = true;

  // Must happen BEFORE CK.setup() - react-native-callkeep's Android side
  // gates displayIncomingCall/startCall/etc. behind hasPhoneAccount(),
  // which itself requires CALL_PHONE, READ_PHONE_NUMBERS (or
  // READ_PHONE_STATE below API 30) and READ_CALL_LOG to already be granted
  // (see lib/permissions.ts's requestCallKeepAndroidPermissions for the
  // full explanation). None of these were ever requested anywhere before -
  // without this, CallKeep would silently no-op forever even after fixing
  // the missing-manifest-service crash.
  const { requestCallKeepAndroidPermissions } = await import('./permissions');
  await requestCallKeepAndroidPermissions();

  const options = {
    ios: {
      appName: 'Loni Server',
      supportsVideo: false,
      maximumCallGroups: '1',
      maximumCallsPerCallGroup: '1',
      includesCallsInRecents: false, // avoids leaking Mothers' identities into the Phone app's Recents list
    },
    android: {
      alertTitle: 'Phone account permission required',
      alertDescription: 'Loni needs access to manage calls so incoming calls can ring like a normal phone call.',
      cancelButton: 'Cancel',
      okButton: 'OK',
      imageName: 'phone_account_icon',
      additionalPermissions: [] as string[],
      // Self-managed avoids the intrusive default-phone-account/dialer-role
      // prompt on Android 10+ (API 29+) while still getting the native
      // full-screen incoming call UI, ringtone, and telecom integration.
      selfManaged: true,
      foregroundService: {
        channelId: 'com.loni.server.calls',
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

  // Local user answered via the NATIVE call UI (lock screen / banner).
  CK.addEventListener('answerCall', async ({ callUUID }: { callUUID: string }) => {
    const callId = callIdByUUID.get(callUUID);
    if (callId == null) return;
    try {
      const { acceptCallDirect } = await import('./callEvents');
      await acceptCallDirect(callId);
      CK.setCurrentCallActive(callUUID);
    } catch (e) {
      console.error('[CallKeep] Failed to accept call from native UI', e);
      try { CK.reportEndCallWithUUID(callUUID, CK_CONSTANTS?.END_CALL_REASONS?.FAILED ?? 1); } catch {}
      forgetCall(callId);
    }
  });

  // Local user declined/hung up via the NATIVE call UI, or a currently
  // active call was ended from there.
  CK.addEventListener('endCall', async ({ callUUID }: { callUUID: string }) => {
    const callId = callIdByUUID.get(callUUID);
    if (callId == null) return;
    try {
      const { useCallStore } = await import('../store/callStore');
      const store = useCallStore.getState();
      if (store.status === 'INCOMING' && store.callId === callId) {
        const { rejectCallDirect } = await import('./callEvents');
        await rejectCallDirect(callId);
      } else if (store.callId === callId) {
        const { apiClient } = await import('../api/client');
        await apiClient.post(`/calls/${callId}/end`).catch(() => {});
        store.endCall('ENDED');
      }
    } catch (e) {
      console.error('[CallKeep] Failed to process native end call', e);
    } finally {
      forgetCall(callId);
    }
  });

  CK.addEventListener('didPerformSetMutedCallAction', async ({ muted }: { muted: boolean }) => {
    // The mic mute button in CallKit/ConnectionService's native UI. Actual
    // LiveKit mute state lives in ActiveCallUI (CallModals.tsx) via
    // localParticipant.setMicrophoneEnabled - this event exists here so
    // native-UI-driven mutes are at least logged; a full two-way sync would
    // route this through callStore, left as a follow-up since the native
    // mute button and in-app mute button both work independently today
    // without visibly conflicting (each just enforces "muted" once).
    console.log('[CallKeep] native mute toggled', muted);
  });

  // Android self-managed mode ONLY (no-op on iOS, where CallKit renders its
  // own incoming-call UI automatically): per react-native-callkeep's own
  // README ("Android Self Managed Mode"), a self-managed app is responsible
  // for showing ITS OWN incoming-call UI - the framework does not draw one
  // for you. This event is Telecom's signal that `displayIncomingCall` was
  // accepted and it's now this app's turn to render something. In practice
  // notifee's full-screen notification (index.js's messaging().setBackgroundMessageHandler,
  // and applyServerCallEvent for the foregrounded/WebSocket path) already
  // renders unconditionally as soon as an incoming_call event arrives - it
  // doesn't wait for this event - so there's nothing further to draw here.
  // Logged for visibility/debugging so a "call never actually reached the
  // Telecom layer" failure is distinguishable from "notifee never even
  // tried."
  CK.addEventListener('showIncomingCallUi', ({ callUUID, handle, name }: { callUUID: string; handle: string; name: string }) => {
    console.log('[CallKeep] showIncomingCallUi', { callUUID, handle, name });
  });

  // Android self-managed mode ONLY. Telecom refused to let this app show an
  // incoming call at all (e.g. Do Not Disturb blocking self-managed calls
  // on some OEM ROMs, or the phone account got disabled) - per the docs,
  // the correct response is to clean up our own call-id/UUID bookkeeping so
  // a stale entry doesn't linger; the incoming call still rings via
  // notifee's independent notification either way.
  CK.addEventListener('createIncomingConnectionFailed', ({ callUUID }: { callUUID: string }) => {
    console.warn('[CallKeep] createIncomingConnectionFailed - Telecom refused the call', callUUID);
    const callId = callIdByUUID.get(callUUID);
    if (callId != null) forgetCall(callId);
  });

  // Replay any events that fired before this listener was attached - e.g.
  // the app was launched BECAUSE the user answered from the native UI
  // while fully killed.
  try {
    const initialEvents = await CK.getInitialEvents();
    for (const evt of initialEvents || []) {
      if (evt.name === 'RNCallKeepPerformAnswerCallAction') {
        const callId = callIdByUUID.get((evt.data as any).callUUID);
        if (callId != null) {
          const { acceptCallDirect } = await import('./callEvents');
          acceptCallDirect(callId).catch((e) => console.error('[CallKeep] initial answer replay failed', e));
        }
      }
    }
    CK.clearInitialEvents();
  } catch (e) {
    console.warn('[CallKeep] getInitialEvents failed', e);
  }
}

/**
 * Called the instant a VoIP push or an FCM data message tells us about an
 * incoming call - MUST be called synchronously/immediately per Apple's
 * PushKit contract (see lib/voipPush.ts) or iOS will penalize/kill the app
 * for receiving a VoIP push without reporting a call.
 *
 * Idempotent by design: `applyServerCallEvent` (lib/callEvents.ts) also
 * calls this for consistency when an incoming_call arrives over the
 * WebSocket or a foreground Firebase message, which can race with the
 * VoIP-push/FCM-background path already having called this for the same
 * call - the native `displayIncomingCall` bridge call is only actually
 * made once per call id. No-op (returns null) if CallKeep is
 * disabled/unavailable - notifee's notification is still shown regardless
 * (see index.js), so the call still rings.
 */
export function displayIncomingCall(callId: number, callerName: string): string | null {
  const CK = loadCallKeep();
  if (!CK) return null;
  const alreadyDisplayed = callUUIDByCallId.has(callId);
  const uuid = uuidForCall(callId);
  if (!alreadyDisplayed) {
    try {
      CK.displayIncomingCall(uuid, callerName, callerName, 'generic', false);
    } catch (e) {
      console.error('[CallKeep] displayIncomingCall failed', e);
    }
  }
  return uuid;
}

/** Server/other-party-driven end (the call ended for a reason that did NOT
 * originate from this device's native call UI - e.g. the Mother cancelled,
 * the ring timed out, or the call completed normally). Removes the native
 * call UI without re-triggering our own `endCall` listener's REST call. */
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

/** Marks the call as connected/active in the native UI (starts the native
 * call timer, removes "Connecting..." state) once LiveKit confirms both
 * participants joined. */
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
