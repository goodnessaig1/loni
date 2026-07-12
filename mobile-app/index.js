import { registerGlobals } from '@livekit/react-native';
import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import messaging from '@react-native-firebase/messaging';

/**
 * `@livekit/react-native`'s docs are explicit: "Must be called before
 * using LiveKit." `app/_layout.tsx` previously only had a bare
 * `import '@livekit/react-native'` (a side-effect import that loads the
 * module but does NOT call this function - confirmed by reading the
 * installed package's actual source). Without it, `react-native-webrtc`'s
 * globals (RTCPeerConnection etc.) never get installed into the JS global
 * scope, so `livekit-client` has no way to create a WebRTC connection at
 * all - signaling still succeeds (you get a token, the room "exists"), but
 * `room.connect()` can never actually complete. That's the real cause of
 * "stuck on Connecting" / "WebRTC isn't detected, have you called
 * registerGlobals?" - not a network/TURN/node_ip issue. Called here, at
 * the very top of the true JS entry point, so it runs before any other
 * module gets a chance to touch LiveKit.
 */
registerGlobals();

/**
 * Issue 1/2 fix: this file did not exist at all. mobile-app's package.json
 * `main` pointed straight at "expo-router/entry", which means
 * `messaging().setBackgroundMessageHandler` was NEVER registered anywhere
 * in the Mother-facing app. Per react-native-firebase's requirements, that
 * handler must be registered in the actual JS entry file, before the root
 * component mounts - registering it inside app/_layout.tsx (which only
 * runs once Expo Router has already booted) is too late and unreliable.
 *
 * Concretely, without this file: any data-only FCM push (call_accepted,
 * call_rejected, call_ended, call_timeout, call_missed, call_failed) that
 * arrives while the Mother's app is backgrounded or fully killed was
 * silently dropped - Android/iOS have nothing to hand the message to. That
 * directly compounds Issue 1/2: if the Mother locks her phone for even a
 * few seconds while a call is ringing (very plausible - screens auto-lock
 * quickly), the "call accepted" push had no code path to be processed at
 * all, on top of the WebSocket being suspended while backgrounded.
 *
 * This app doesn't need to build a full-screen incoming-call UI the way
 * the Nurse app does (the Mother is never the callee), so the handler here
 * is intentionally minimal - it just needs to exist so the OS hands the
 * message to the JS engine instead of dropping it, and so the app's normal
 * cold/warm-start reconciliation (NotificationContext's socket connect +
 * notifee.getInitialNotification-equivalent state) has a chance to run.
 */
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[FCM] Background message received:', remoteMessage?.data?.type);
  // No UI work here by design - see comment above. State reconciliation
  // happens once the app is foregrounded, via the WebSocket reconnect and
  // GET /calls/active-style checks in AuthContext/NotificationContext.
});

// Must be exported or Fast Refresh won't update the context
export function App() {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
