import React, { createContext, useContext, useEffect, useState } from 'react';
import notifee, { EventType } from '@notifee/react-native';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { AuthContext } from './AuthContext';
import { apiClient } from '../api/client';
import { connectCallSocket, disconnectCallSocket } from '../api/socket';
import { applyServerCallEvent, acceptCallDirect, rejectCallDirect } from '../lib/callEvents';
import { useCallStore } from '../store/callStore';
import { setupCallKeep } from '../lib/callKeepService';
import { setupVoipPush } from '../lib/voipPush';
import { requestMicrophonePermission } from '../lib/permissions';

interface NotificationContextType {
  pushToken: string | null;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [pushToken, setPushToken] = useState<string | null>(null);

  const { user } = useContext(AuthContext);

  useEffect(() => {
    // Redundant-safe: index.js already calls both of these at module load
    // (required for a cold-start-via-push scenario), but calling again
    // here is a guarded no-op and ensures they're set up even if this
    // provider somehow mounts before index.js's module-scope code ran in
    // some future refactor.
    setupCallKeep().catch((e) => console.error('[CallKeep] setup failed', e));
    setupVoipPush();
  }, []);

  useEffect(() => {
    /**
     * Issue 1/10/11 fix: this previously registered `expo-notifications`
     * listeners that never fire for this app's raw-FCM-data-message
     * architecture (see mobile-app/context/NotificationContext.tsx for the
     * full explanation) alongside a working Firebase `onMessage` handler -
     * removed the dead ones. Foreground delivery now goes through the
     * shared `applyServerCallEvent` so it's identical to what the
     * WebSocket does.
     */
    const importMessaging = require('@react-native-firebase/messaging').default;
    const unsubscribeFirebase = importMessaging().onMessage(async (remoteMessage: any) => {
      const data = remoteMessage.data;
      if (data?.type) {
        const parsed: any = { ...data };
        for (const key of ['caller', 'receiver']) {
          if (typeof parsed[key] === 'string') {
            try { parsed[key] = JSON.parse(parsed[key]); } catch { /* leave as-is */ }
          }
        }
        applyServerCallEvent(data.type, parsed);

        // Foreground heads-up notification
        if (data.type === 'incoming_call') {
          const uiMode = process.env.EXPO_PUBLIC_CALL_UI_MODE || 'NATIVE_DIALER';
          if (uiMode === 'IN_APP_UI' && Platform.OS === 'android') {
            const { AndroidImportance } = require('@notifee/react-native');
            let callerName = data.caller_name || 'Someone';
            let profilePic = undefined;
            let subtitle = '';
            try {
              if (parsed.caller) {
                callerName = parsed.caller.name || callerName;
                profilePic = parsed.caller.profile_picture;
                if (parsed.caller.trimester) {
                   subtitle = `\n${parsed.caller.trimester} • Week ${parsed.caller.pregnancy_week || '?'}`;
                } else if (parsed.caller.hospital_affiliation) {
                   subtitle = `\n${parsed.caller.hospital_affiliation}`;
                }
              }
            } catch (e) {}

            const channelId = await notifee.createChannel({
              id: 'calls_v6_in_app',
              name: 'Incoming Requests',
              vibration: true,
              importance: AndroidImportance.HIGH,
              sound: 'notification',
            });
            const androidConfig: any = {
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
              id: `incoming-${data.call_id}`,
              title: 'Mother needs assistance',
              body: `${callerName}${subtitle} is requesting a call. Tap to view.`,
              data: data,
              android: androidConfig,
            });
          }
        } else if (['call_rejected', 'call_ended', 'call_timeout', 'call_missed'].includes(data.type)) {
          if (data.call_id) {
            await notifee.cancelNotification(`incoming-${data.call_id}`).catch(() => {});
          }
        }
      }
    });

    return () => {
      unsubscribeFirebase();
    };
  }, []);

  useEffect(() => {
    /**
     * Issue 4 fix (the critical missing piece): index.js already builds a
     * full-screen, high-priority notifee notification with Accept/Decline
     * actions when a call arrives in the background - but NOTHING was
     * listening for those action presses. Tapping "Accept" or "Decline" on
     * the incoming-call notification did nothing at all.
     *
     * notifee requires action presses to be handled in TWO places:
     *  - onBackgroundEvent (registered at module scope in index.js) for
     *    when the JS engine isn't already running a React tree.
     *  - onForegroundEvent (here) for when the app is already open/in the
     *    foreground and the same notification is still showing/tapped.
     */
    return notifee.onForegroundEvent(async ({ type, detail }) => {
      const callId = detail.notification?.data?.call_id;
      if (!callId) return;
      const id = Number(callId);

      if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'accept') {
        await notifee.cancelNotification(detail.notification!.id!);
        try {
          await acceptCallDirect(id);
        } catch (e) {
          console.error('[Notifee] Failed to accept call from notification action', e);
        }
      } else if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'decline') {
        await notifee.cancelNotification(detail.notification!.id!);
        try {
          await rejectCallDirect(id);
        } catch (e) {
          console.error('[Notifee] Failed to decline call from notification action', e);
        }
      } else if (type === EventType.PRESS) {
        // Tapped the notification body itself (not an action button): the
        // data was already used to hydrate the store by the background
        // handler's setIncomingCall equivalent - just make sure the
        // incoming-call UI has what it needs.
        const data = detail.notification?.data as any;
        if (data?.type === 'incoming_call') {
          applyServerCallEvent('incoming_call', {
            call_id: data.call_id,
            room_name: data.room_name,
            caller: data.caller ? JSON.parse(data.caller) : { id: '', name: data.caller_name },
          });
        }
      }
    });
  }, []);

  useEffect(() => {
    // Issue 4: if the app was fully killed and got cold-started by the
    // user tapping the full-screen incoming-call notification, replay that
    // notification's data once the store exists so the incoming-call
    // screen renders instead of the app opening to a blank home screen
    // with a ringing notification the user already dismissed by tapping.
    notifee.getInitialNotification().then((initial) => {
      if (!initial) return;
      const data = initial.notification.data as any;
      if (data?.type === 'incoming_call') {
        applyServerCallEvent('incoming_call', {
          call_id: data.call_id,
          room_name: data.room_name,
          caller: data.caller ? JSON.parse(data.caller) : { id: '', name: data.caller_name },
        });
      }
    });
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
    // shown to brand-new, unauthenticated users - existing Nurse accounts
    // that registered before this flow existed skip it entirely and would
    // otherwise hit the old "prompt appears mid-call" behavior on their
    // next incoming call. This is especially important on this app, since
    // the Nurse is the one who has to *accept* calls immediately -
    // requestMicrophonePermission is a safe no-op if already
    // granted/blocked, so calling it here, once per app launch as soon as
    // a user is authenticated, closes that gap without ever showing a
    // duplicate or unwanted dialog.
    if (user) {
      requestMicrophonePermission().catch((e) =>
        console.error('[Permissions] Microphone bootstrap failed', e)
      );
    }
  }, [user]);

  useEffect(() => {
    // Issue 1/2/8: open the real-time signaling socket as soon as we have
    // an authenticated (Nurse) user, and tear it down on logout.
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
