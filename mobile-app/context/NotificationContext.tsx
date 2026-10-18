import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { openFromPush, PushData } from '../lib/checkinLinks';
import { queryClient } from '../lib/queryClient';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { AuthContext } from './AuthContext';
import { apiClient } from '../api/client';
import { connectCallSocket, disconnectCallSocket } from '../api/socket';
import { applyServerCallEvent } from '../lib/callEvents';
import { applyServerRideEvent } from '../lib/rideEvents';
import { setupCallKeep } from '../lib/callKeepService';
import { requestMicrophonePermission } from '../lib/permissions';

interface NotificationContextType {
  pushToken: string | null;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [pushToken, setPushToken] = useState<string | null>(null);

  const { user } = useContext(AuthContext);
  const userRef = useRef(user);
  const pendingOpen = useRef<PushData>(undefined);
  useEffect(() => {
    userRef.current = user;
    if (user && pendingOpen.current) {
      const data = pendingOpen.current;
      pendingOpen.current = undefined;
      openFromPush(data);
    }
  }, [user]);

  useEffect(() => {
    // Native outgoing-call UI (Issue 5) - see lib/callKeepService.ts.
    setupCallKeep().catch((e) => console.error('[CallKeep] setup failed', e));
  }, []);

  useEffect(() => {
    /**
     * Issue 1/10/11 fix: this previously registered two `expo-notifications`
     * listeners (addNotificationReceivedListener /
     * addNotificationResponseReceivedListener) and NO Firebase `onMessage`
     * listener at all. `expo-notifications` only fires for notifications
     * that went through Expo's own push service / local notification APIs.
     * This backend sends raw FCM data messages via firebase-admin directly
     * (see registerForPushNotificationsAsync, which explicitly requests a
     * native FCM/APNs token via getDevicePushTokenAsync, not an Expo push
     * token) - so those two listeners never fired for incoming_call /
     * call_accepted on this app. That means the Mother app had NO working
     * foreground handler for "call accepted" at all before this fix; it
     * was depending entirely on the notification tray, which most
     * platforms suppress while the app is foregrounded for data-only
     * messages. Replaced with Firebase's own `onMessage`, routed through
     * the shared `applyServerCallEvent` handler (lib/callEvents.ts) so
     * foreground push and the WebSocket apply identical logic.
     */
    const importMessaging = require('@react-native-firebase/messaging').default;
    const messaging = importMessaging();

    // Tapping a notification (app in background, or launching the app from it) opens what it points at.
    const handleOpen = (remoteMessage: any) => {
      const data: PushData = remoteMessage?.data;
      if (data?.type !== 'checkin') return;
      if (userRef.current) openFromPush(data);
      else pendingOpen.current = data;   // cold start: wait until she is signed in
    };
    const unsubscribeOpened = messaging.onNotificationOpenedApp(handleOpen);
    messaging.getInitialNotification().then(handleOpen).catch(() => {});

    const unsubscribeFirebase = messaging.onMessage(async (remoteMessage: any) => {
      const data = remoteMessage.data;
      if (data?.type === 'checkin') {
        // App is open: a quiet in-app banner instead of a system alert. Tap it to open the conversation.
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        Toast.show({
          type: 'info',
          text1: data.title || remoteMessage.notification?.title || 'Loni',
          text2: data.body || remoteMessage.notification?.body || '',
          visibilityTime: 8000,
          onPress: () => { Toast.hide(); openFromPush(data); },
        });
        return;
      }
      if (typeof data?.type === 'string' && data.type.startsWith('ride_')) {
        applyServerRideEvent(data.type, data);
        return;
      }
      if (data?.type) {
        const parsed: any = { ...data };
        for (const key of ['caller', 'receiver']) {
          if (typeof parsed[key] === 'string') {
            try { parsed[key] = JSON.parse(parsed[key]); } catch { /* leave as-is */ }
          }
        }
        applyServerCallEvent(data.type, parsed);
      }
    });

    return () => {
      unsubscribeFirebase();
      unsubscribeOpened();
    };
  }, []);

  useEffect(() => {
    async function initPush() {
      if (!user) return;

      const token = await registerForPushNotificationsAsync();
      if (token) {
        setPushToken(token);

        try {
          const deviceId = Platform.OS === 'android' ? Device.osBuildId : Device.modelId || 'ios_device';

          await apiClient.post('/notifications/devices', {
            device_id: deviceId || 'unknown_device',
            device_type: Platform.OS,
            token: token
          });

          console.log('[Push] Successfully registered device with backend.');
        } catch (error) {
          console.error('[Push] Failed to register device with backend:', error);
        }
      }
    }

    initPush();
  }, [user]);

  useEffect(() => {
    // Proactive microphone permission: app/(auth)/permissions.tsx already
    // requests this during signup, but that onboarding screen is only ever
    // shown to brand-new, unauthenticated users - existing accounts that
    // registered before this flow existed (or a token that just never
    // expires) skip it entirely and would otherwise hit the old "prompt
    // appears mid-call" behavior on their next call. requestMicrophonePermission
    // is a safe no-op if already granted/blocked, so calling it here, once
    // per app launch as soon as a user is authenticated, closes that gap
    // without ever showing a duplicate or unwanted dialog.
    if (user) {
      requestMicrophonePermission().catch((e) =>
        console.error('[Permissions] Microphone bootstrap failed', e)
      );
    }
  }, [user]);

  useEffect(() => {
    // Issue 1/2/8: open the real-time signaling socket as soon as we have
    // an authenticated user, and tear it down on logout. This is what
    // makes "Accept" -> caller UI update nearly instantaneous instead of
    // depending entirely on push delivery latency.
    if (user) {
      connectCallSocket();
    } else {
      disconnectCallSocket();
    }
    return () => {
      disconnectCallSocket();
    };
  }, [user]);

  return (
    <NotificationContext.Provider value={{ pushToken }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
