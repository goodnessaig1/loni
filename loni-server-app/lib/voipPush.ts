import { Platform } from 'react-native';
import { apiClient } from '../api/client';
import { displayIncomingCall } from './callKeepService';
import { applyServerCallEvent } from './callEvents';
import { registerPushToken } from './pushRegistration';

/**
 * PushKit VoIP token registration + incoming-push handling (iOS only).
 *
 * This is the Apple-mandated pairing for `lib/callKeepService.ts`: a plain
 * FCM/APNs remote push cannot reliably wake a force-quit iOS app, but a
 * PushKit VoIP push always does - on the strict condition that the app
 * calls `RNCallKeep.displayIncomingCall` SYNCHRONOUSLY inside the push
 * handler below. Apps that receive a VoIP push and don't immediately
 * report a call get throttled and eventually killed by iOS as a policy
 * violation, so `displayIncomingCall` is the very first thing this file
 * does with the payload - before any parsing, network calls, or store
 * updates.
 *
 * The backend sends these via `app/modules/notifications/voip_service.py`,
 * which talks directly to Apple's APNs HTTP/2 API (FCM cannot send VoIP
 * pushes at all - see that file for why).
 *
 * KILL SWITCH: gated behind the same `EXPO_PUBLIC_ENABLE_CALLKEEP` flag as
 * lib/callKeepService.ts (see that file for the full explanation of why).
 * `react-native-voip-push-notification` is never `require()`'d - not even
 * on iOS - while disabled, and never at all on Android regardless of the
 * flag (this feature is meaningless there; Android's incoming-call wake
 * path is notifee + high-priority FCM, unrelated to PushKit).
 */

const CALLKEEP_ENABLED = process.env.EXPO_PUBLIC_ENABLE_CALLKEEP === 'true';

let listenersRegistered = false;

function loadVoipPushModule(): any {
  if (Platform.OS !== 'ios' || !CALLKEEP_ENABLED) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-voip-push-notification');
    return mod.default ?? mod;
  } catch (e) {
    console.error('[VoIP] Failed to load react-native-voip-push-notification', e);
    return null;
  }
}

export function setupVoipPush(): void {
  if (listenersRegistered) return;
  const VoipPushNotification = loadVoipPushModule();
  if (!VoipPushNotification) return;
  listenersRegistered = true;

  VoipPushNotification.addEventListener('register', (token: string) => {
    // Registered as device_type "ios_voip" - deliberately distinct from
    // the regular device_type "ios" token registered in
    // utils/notifications.ts, so the backend can choose the VoIP path
    // specifically for incoming_call and the regular path for everything
    // else (see NotificationService.notify_user's routing logic).
    registerPushToken(token, 'ios_voip', 'ios_voip')
      .then(() => console.log('[VoIP] Registered VoIP push token with backend'))
      .catch((e) => console.error('[VoIP] Failed to register VoIP token', e));
  });

  VoipPushNotification.addEventListener('notification', (payload: any) => {
    handleIncomingVoipPush(payload);
  });

  // Events that arrived before JS finished bootstrapping (e.g. the process
  // was launched fresh by iOS specifically to deliver this VoIP push).
  VoipPushNotification.addEventListener('didLoadWithEvents', (events: any[]) => {
    events?.forEach((e) => {
      if (e?.name === 'RNVoipPushRemoteNotificationReceivedEvent' && e.data) {
        handleIncomingVoipPush(e.data);
      }
    });
  });

  VoipPushNotification.registerVoipToken();
}

function handleIncomingVoipPush(payload: any) {
  const callId = Number(payload.call_id);
  const callerName = payload.caller_name || 'Incoming Call';
  if (!callId) return;

  // MUST happen first and synchronously - see file header.
  displayIncomingCall(callId, callerName);

  let caller: any = null;
  try {
    caller = payload.caller ? JSON.parse(payload.caller) : null;
  } catch {
    // fall through to the caller_name-only fallback below
  }

  applyServerCallEvent('incoming_call', {
    call_id: payload.call_id,
    room_name: payload.room_name,
    caller: caller || { id: '', name: callerName },
  });
}
