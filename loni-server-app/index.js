import { registerGlobals } from '@livekit/react-native';
import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';

/**
 * `@livekit/react-native`'s docs are explicit: "Must be called before
 * using LiveKit." `app/_layout.tsx` previously only had a bare
 * `import '@livekit/react-native'` (a side-effect import that loads the
 * module but does NOT call this function - confirmed by reading the
 * installed package's actual source, node_modules/@livekit/react-native/
 * lib/commonjs/index.js). Without it, `react-native-webrtc`'s globals
 * (RTCPeerConnection etc.) never get installed into the JS global scope,
 * so `livekit-client` has no way to create a WebRTC connection at all -
 * signaling still succeeds (you get a token, the room "exists"), but
 * `room.connect()` can never actually complete, which is exactly the
 * "stuck on Connecting" symptom this was silently causing. Not a network/
 * TURN/node_ip issue - the WebRTC stack was never initialized in the first
 * place. Called here, at the very top of the true JS entry point, so it
 * runs before any other module (including ones that might construct a
 * LiveKit Room during their own import-time side effects) gets a chance
 * to touch LiveKit.
 */
registerGlobals();

/**
 * Issue 4/5 fix, "make it ring like a real phone call no matter what":
 * `react-native-callkeep` (already an installed dependency, previously
 * completely unused anywhere in this app - see CALL_SYSTEM_AUDIT.md) is
 * now the PRIMARY incoming-call UI on both platforms:
 *   - iOS: native CallKit lock-screen/banner call UI, system ringtone,
 *     works even if the app was fully force-quit (paired with a PushKit
 *     VoIP push - see lib/voipPush.ts, registered below).
 *   - Android: a self-managed ConnectionService call (via
 *     `selfManaged: true` in lib/callKeepService.ts's setup()), which gets
 *     the OS's native full-screen incoming-call UI, respects the phone's
 *     ringtone/volume/Do-Not-Disturb-call-exception behavior, and doesn't
 *     require the intrusive "set as default phone app" prompt.
 * notifee's full-screen notification (below) is kept ONLY as a fallback if
 * CallKeep's native module fails to initialize for any reason - so a call
 * still rings via *some* mechanism rather than silently not ringing at
 * all. In normal operation only one of the two will actually display.
 */
import { setupCallKeep, displayIncomingCall, reportCallEnded } from './lib/callKeepService';
import { setupVoipPush } from './lib/voipPush';
import { registerCallForegroundService } from './lib/callForegroundService';

// PushKit VoIP registration must happen at module scope, before the app
// finishes bootstrapping, so a fully-killed app relaunched by a VoIP push
// doesn't miss the event that woke it. No-ops on Android.
setupVoipPush();
// CallKeep setup is safe to call multiple times (guarded internally) and
// must run before any `displayIncomingCall` call below could fire.
setupCallKeep().catch((e) => console.error('[CallKeep] setup failed at boot', e));
// Issue 4 fix: must register the foreground service runner before any
// active-call screen tries to start it (components/CallModals.tsx calls
// startCallForegroundService once the call connects) - see
// lib/callForegroundService.ts for why this exists independently of
// CallKeep's own (currently disabled) foreground service.
registerCallForegroundService();

// Handle background/killed-state FCM messages (Android's incoming_call
// path, and the fallback path for any call event on either platform when
// the app isn't fully killed).
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Background message received:', remoteMessage?.data?.type);

  if (remoteMessage.data && remoteMessage.data.type === 'incoming_call') {
    const callId = Number(remoteMessage.data.call_id);
    const callerName = remoteMessage.data.caller_name || 'Someone';

    // Bug found via real-device/emulator testing: `displayIncomingCall()`
    // (lib/callKeepService.ts) calls a `void` native bridge method on
    // Android - it has no way to know whether Telecom actually accepted and
    // displayed the call, only whether the JS->native call was made without
    // throwing. The Java side silently no-ops (just logs a warning) if the
    // self-managed phone account isn't registered/enabled yet - which is
    // the default state on first run, and is especially unreliable on
    // emulators/AVDs, where the "enable calling account" system prompt
    // doesn't always surface the way it does on real hardware. The
    // previous `usedCallKeep` gate treated "the bridge call didn't throw"
    // as "the user is now seeing an incoming call", and skipped the notifee
    // fallback whenever that was wrongly true - the exact "nothing rings in
    // the background, the call is only visible once I open the app" bug
    // this comment is replacing. notifee's full-screen notification is the
    // one path in this app that's actually been proven to work reliably
    // (real-device screenshots, this bug report's own "I see the call once
    // I open the app" confirms the underlying FCM delivery + store
    // hydration is fine) - so it's now unconditional. CallKeep is called
    // best-effort alongside it; when Telecom does successfully take the
    // self-managed call, its own system call UI simply layers on top - a
    // possible brief double-surface is a far smaller problem than the call
    // not ringing at all.
    if (Platform.OS === 'android' && callId) {
      try {
        await setupCallKeep();
        displayIncomingCall(callId, callerName);
      } catch (e) {
        console.error('[CallKeep] displayIncomingCall failed - notifee will still ring', e);
      }
    }

    const channelId = await notifee.createChannel({
      id: 'calls_v2',
      name: 'Incoming Calls',
      vibration: true,
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });

    await notifee.displayNotification({
      id: `incoming-${remoteMessage.data.call_id}`,
      title: 'Incoming Call',
      body: `${callerName} is calling`,
      data: remoteMessage.data,
      android: {
        channelId,
        category: AndroidCategory.CALL,
        visibility: AndroidVisibility.PUBLIC,
        importance: AndroidImportance.HIGH,
        fullScreenAction: { id: 'default' },
        actions: [
          { title: 'Decline', pressAction: { id: 'decline' } },
          { title: 'Accept', pressAction: { id: 'accept' } },
        ],
      },
    });
  } else if (remoteMessage.data && ['call_rejected', 'call_ended', 'call_timeout', 'call_missed'].includes(remoteMessage.data.type)) {
    // Issue 4/8: clear/end a still-ringing call if it was resolved before
    // the Nurse acted on it (Mother cancelled, another nurse in a
    // broadcast call answered first, or it timed out).
    const callId = remoteMessage.data.call_id ? Number(remoteMessage.data.call_id) : null;
    if (callId) {
      try {
        reportCallEnded(callId);
      } catch (e) {
        console.error('[CallKeep] reportCallEnded failed', e);
      }
      await notifee.cancelNotification(`incoming-${callId}`).catch(() => {});
    }
  }
});

/**
 * notifee action-press handling - kept as the handler for the FALLBACK
 * notification path above (CallKeep's own `answerCall`/`endCall` events,
 * wired in lib/callKeepService.ts, handle the primary path).
 */
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const data = detail.notification?.data;
  const callId = data?.call_id ? Number(data.call_id) : null;
  if (!callId) return;

  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'accept') {
    await notifee.cancelNotification(detail.notification.id);
    try {
      const { acceptCallDirect } = require('./lib/callEvents');
      await acceptCallDirect(callId);
    } catch (e) {
      console.error('[Notifee/background] Failed to accept call', e);
    }
  } else if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'decline') {
    await notifee.cancelNotification(detail.notification.id);
    try {
      const { rejectCallDirect } = require('./lib/callEvents');
      await rejectCallDirect(callId);
    } catch (e) {
      console.error('[Notifee/background] Failed to decline call', e);
    }
  }
  // type === PRESS (tapped the body, not a button): notifee's
  // fullScreenAction already launches the app; NotificationContext's
  // notifee.getInitialNotification() call picks this up once the app is
  // foregrounded and hydrates the incoming-call screen from it.
});

// Must be exported or Fast Refresh won't update the context
export function App() {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
