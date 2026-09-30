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

// Handle background/killed-state FCM messages
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Background message received:', remoteMessage?.data?.type);

  const rtype = remoteMessage?.data?.type;

  // Emergency ride request while the app is backgrounded / killed (driver).
  if (rtype === 'ride_request') {
    const rideId = String(remoteMessage.data.ride_id || remoteMessage.data.id || '');
    let pickup = remoteMessage.data.pickup_address || 'A mother';
    let dropoff = remoteMessage.data.dropoff_name || 'hospital';
    const channelId = await notifee.createChannel({
      id: 'ride_requests',
      name: 'Emergency Ride Requests',
      vibration: true,
      importance: AndroidImportance.HIGH,
      sound: 'notification',
    });
    await notifee.displayNotification({
      id: `ride-${rideId}`,
      title: 'Emergency Transport Request',
      body: `${pickup} → ${dropoff}. Tap to view.`,
      data: { type: 'ride_request', ride_id: rideId },
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        category: AndroidCategory.CALL,
        visibility: AndroidVisibility.PUBLIC,
        fullScreenAction: { id: 'default', mainComponent: 'loni-server-app' },
        pressAction: { id: 'default', launchActivity: 'default' },
        actions: [
          { title: 'Decline', pressAction: { id: 'ride_decline' } },
          { title: 'Accept', pressAction: { id: 'ride_accept', launchActivity: 'default' } },
        ],
      },
    });
    return;
  }
  if (rtype === 'ride_taken' || rtype === 'ride_cancelled') {
    const rideId = String(remoteMessage.data.ride_id || remoteMessage.data.id || '');
    await notifee.cancelNotification(`ride-${rideId}`).catch(() => {});
    return;
  }

  if (remoteMessage.data && remoteMessage.data.type === 'incoming_call') {
    const callId = Number(remoteMessage.data.call_id);
    let callerName = remoteMessage.data.caller_name || 'Someone';
    let profilePic = undefined;
    let subtitle = '';

    try {
      if (remoteMessage.data.caller) {
        const caller = JSON.parse(remoteMessage.data.caller);
        callerName = caller.name || callerName;
        profilePic = caller.profile_picture;
        if (caller.trimester) {
           subtitle = `\n${caller.trimester} • Week ${caller.pregnancy_week || '?'}`;
        } else if (caller.hospital_affiliation) {
           subtitle = `\n${caller.hospital_affiliation}`;
        }
      }
    } catch (e) {}

    const uiMode = process.env.EXPO_PUBLIC_CALL_UI_MODE || 'NATIVE_DIALER';

    if (uiMode === 'IN_APP_UI') {
      if (Platform.OS === 'android') {
        const channelId = await notifee.createChannel({
          id: 'calls_v7_in_app',
          name: 'Incoming Requests',
          vibration: true,
          importance: AndroidImportance.HIGH,
          sound: 'notification', // Plays the custom notification.mp3
        });

        const androidConfig = {
          channelId,
          importance: AndroidImportance.HIGH,
          autoCancel: true,
          pressAction: { id: 'default', launchActivity: 'default' },
        };

        if (typeof profilePic === 'string' && profilePic.trim().length > 0) {
          androidConfig.largeIcon = profilePic;
          androidConfig.circularLargeIcon = true;
        }

        await notifee.displayNotification({
          id: `incoming-${remoteMessage.data.call_id}`,
          title: 'Mother needs assistance',
          body: `${callerName}${subtitle} is requesting a call. Tap to view.`,
          data: remoteMessage.data,
          android: androidConfig,
        });
      }
    } else {
      // NATIVE_DIALER Mode
      if (callId) {
        try {
          await setupCallKeep();
          displayIncomingCall(callId, callerName);
        } catch (e) {
          console.error('[CallKeep] displayIncomingCall failed', e);
        }
      }

      if (Platform.OS === 'android') {
        const channelId = await notifee.createChannel({
          id: 'calls_v5_silent',
          name: 'Incoming Calls (Silent popup)',
          vibration: true,
          importance: AndroidImportance.HIGH,
        });

        const androidConfig = {
          channelId,
          category: AndroidCategory.CALL,
          visibility: AndroidVisibility.PUBLIC,
          importance: AndroidImportance.HIGH,
          ongoing: true,
          autoCancel: false,
          fullScreenAction: { id: 'default', mainComponent: 'loni-server-app' },
          pressAction: { id: 'default' },
          actions: [
            { title: 'Decline', pressAction: { id: 'decline' } },
            { title: 'Answer', pressAction: { id: 'accept', launchActivity: 'default' } },
          ],
        };

        if (typeof profilePic === 'string' && profilePic.trim().length > 0) {
          androidConfig.largeIcon = profilePic;
          androidConfig.circularLargeIcon = true;
        }

        await notifee.displayNotification({
          id: `incoming-${remoteMessage.data.call_id}`,
          title: 'Incoming Call',
          body: `${callerName}${subtitle}`,
          data: remoteMessage.data,
          android: androidConfig,
        });

        // Fallback: Play default system ringtone via InCallManager if CallKeep is off
        try {
          const InCallManager = require('react-native-incall-manager').default;
          InCallManager.startRingtone('_DEFAULT_');
          
          // Safety timeout: Always stop ringing after 30 seconds in case 'call_ended' FCM is missed
          setTimeout(() => {
            try {
              InCallManager.stopRingtone();
              notifee.cancelNotification(`incoming-${remoteMessage.data.call_id}`).catch(() => {});
            } catch (e) {}
          }, 30000);
        } catch (e) {
          console.error('[Audio] Failed to play InCallManager ringtone', e);
        }
      }
    }
  } else if (remoteMessage.data && ['call_accepted', 'call_rejected', 'call_ended', 'call_timeout', 'call_missed', 'call_failed'].includes(remoteMessage.data.type)) {
    const callId = remoteMessage.data.call_id ? Number(remoteMessage.data.call_id) : null;
    if (callId) {
      try {
        reportCallEnded(callId);
      } catch (e) {}
      if (Platform.OS === 'android') {
        await notifee.cancelNotification(`incoming-${callId}`).catch(() => {});
      }
    }
    // Stop ringing
    try {
      const InCallManager = require('react-native-incall-manager').default;
      InCallManager.stopRingtone();
    } catch (e) {}
  }
});

/**
 * notifee action-press handling - kept as the handler for the FALLBACK
 * notification path above (CallKeep's own `answerCall`/`endCall` events,
 * wired in lib/callKeepService.ts, handle the primary path).
 */
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const data = detail.notification?.data;

  // Ride-request action presses (driver).
  if (data?.type === 'ride_request') {
    const rideId = Number(data.ride_id);
    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'ride_accept') {
      await notifee.cancelNotification(detail.notification.id).catch(() => {});
      try {
        const { acceptRideDirect } = require('./lib/rideEvents');
        await acceptRideDirect(rideId);
      } catch (e) {
        console.error('[Notifee/bg] ride accept failed', e);
      }
    } else if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'ride_decline') {
      await notifee.cancelNotification(detail.notification.id).catch(() => {});
      try {
        const { declineRideDirect } = require('./lib/rideEvents');
        await declineRideDirect(rideId);
      } catch (e) {
        console.error('[Notifee/bg] ride decline failed', e);
      }
    }
    // PRESS (body tap): fullScreenAction/pressAction launches the app;
    // NotificationContext's getInitialNotification handler routes to the
    // request screen once foregrounded.
    return;
  }

  const callId = data?.call_id ? Number(data.call_id) : null;
  if (!callId) return;

  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'accept') {
    try {
      const InCallManager = require('react-native-incall-manager').default;
      InCallManager.stopRingtone();
    } catch (e) {}
    await notifee.cancelNotification(detail.notification.id);
    try {
      const { acceptCallDirect } = require('./lib/callEvents');
      await acceptCallDirect(callId);
    } catch (e) {
      console.error('[Notifee/background] Failed to accept call', e);
    }
  } else if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'decline') {
    try {
      const InCallManager = require('react-native-incall-manager').default;
      InCallManager.stopRingtone();
    } catch (e) {}
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
