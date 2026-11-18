import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return null;
    }

    token = (
      await Notifications.getDevicePushTokenAsync()
    ).data;
    console.log('[Push] Native device token retrieved');
  } catch (e) {
    console.warn('[Push] Error getting push token:', e);
    return null;
  }

  return token;
}

const CALL_PUSH_TYPES = new Set([
  'incoming_call', 'call_accepted', 'call_state', 'call_rejected', 'call_ended', 'call_timeout', 'call_missed',
  'call_failed', 'call_cancelled', 'answered_here', 'call_answered_elsewhere',
]);

export function setupNotificationHandlers() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // With the app open, the call screen is the call UI (and plays the only ring, on the
      // receiver's phone - lib/callTones.ts). A call push shown here as well made a second sound -
      // on the caller's phone too, for "accepted" / "ended" updates.
      const type = (notification.request.content.data as { type?: unknown } | undefined)?.type;
      if (typeof type === 'string' && CALL_PUSH_TYPES.has(type)) {
        return { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: false, shouldShowList: false };
      }
      return { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true };
    },
  });
}
