import { registerGlobals } from '@livekit/react-native';
import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, EventType } from '@notifee/react-native';
import { Platform } from 'react-native';

registerGlobals();

import { setupCallKeep, displayIncomingCall, reportCallEnded } from './lib/callKeepService';
import { registerCallForegroundService } from './lib/callForegroundService';

setupCallKeep().catch((e) => console.error('[CallKeep] setup failed at boot', e));
registerCallForegroundService();

messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[FCM] Background message received:', remoteMessage?.data?.type);

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
        if (caller.hospital_affiliation) {
           subtitle = `\n${caller.hospital_affiliation}`;
        }
      }
    } catch (e) {}

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
        id: 'calls_v4_ringtone',
        name: 'Incoming Calls (V4)',
        vibration: true,
        importance: AndroidImportance.HIGH,
        sound: 'default',
      });

      const androidConfig = {
        channelId,
        category: AndroidCategory.CALL,
        visibility: AndroidVisibility.PUBLIC,
        importance: AndroidImportance.HIGH,
        ongoing: true,
        autoCancel: false,
        fullScreenAction: { id: 'default', mainComponent: 'mobile-app' },
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

      try {
        const InCallManager = require('react-native-incall-manager').default;
        InCallManager.startRingtone('_DEFAULT_');
      } catch (e) {
        console.error('[Audio] Failed to play InCallManager ringtone', e);
      }
    }
  } else if (remoteMessage.data && ['call_rejected', 'call_ended', 'call_timeout', 'call_missed'].includes(remoteMessage.data.type)) {
    const callId = remoteMessage.data.call_id ? Number(remoteMessage.data.call_id) : null;
    if (callId) {
      try {
        reportCallEnded(callId);
      } catch (e) {}
      if (Platform.OS === 'android') {
        await notifee.cancelNotification(`incoming-${callId}`).catch(() => {});
      }
    }
    try {
      const InCallManager = require('react-native-incall-manager').default;
      InCallManager.stopRingtone();
    } catch (e) {}
  }
});

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const data = detail.notification?.data;
  const callId = data?.call_id ? Number(data.call_id) : null;
  if (!callId) return;

  try {
    const InCallManager = require('react-native-incall-manager').default;
    InCallManager.stopRingtone();
  } catch (e) {}

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
});

export function App() {
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
