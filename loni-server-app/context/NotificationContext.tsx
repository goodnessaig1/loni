import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import notifee, { EventType } from '@notifee/react-native';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { AuthContext } from './AuthContext';
import { apiClient } from '../api/client';
import { router } from 'expo-router';
import { connectCallSocket, disconnectCallSocket, setSocketUserType } from '../api/socket';
import { applyServerCallEvent, acceptCallDirect, rejectCallDirect } from '../lib/callEvents';
import { useCallStore } from '../store/callStore';
import { setupCallKeep } from '../lib/callKeepService';
import { setupVoipPush } from '../lib/voipPush';
import { requestMicrophonePermission } from '../lib/permissions';
import { handleAccountApproved, registerAuthRefresh } from '../lib/accountStatus';
import { applyServerRideEvent, parseRideData, acceptRideDirect, declineRideDirect, openRideRequest } from '../lib/rideEvents';
import { applyPartnerEvent, registerPartnerSignOut } from '../lib/partnerEvents';

interface NotificationContextType {
  pushToken: string | null;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [pushToken, setPushToken] = useState<string | null>(null);

  const { user, refreshUser, logoutUser } = useContext(AuthContext);
  // Push handlers are registered once; they read the current role from here.
  const userTypeRef = useRef<string | undefined>(user?.user_type);
  userTypeRef.current = user?.user_type;
  setSocketUserType(user?.user_type);

  useEffect(() => {
    // Let module-scope code (the call socket, FCM tap handlers) trigger a
    // user refresh after an account-approval event - `refreshUser` lives on
    // the React context and can't be imported directly there.
    registerAuthRefresh(refreshUser);
    registerPartnerSignOut(logoutUser);
    return () => { registerAuthRefresh(null); registerPartnerSignOut(null); };
  }, [refreshUser]);

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

      // Account approved while the app is foregrounded: refresh the user and
      // jump to the dashboard. (The WebSocket usually beats this; both are
      // de-duped in handleAccountApproved.)
      if (data?.type === 'account_approved') {
        handleAccountApproved();
        return;
      }

      // A partner's updates about the mother's ride / pregnancy (same split as api/socket.ts).
      if (userTypeRef.current === 'partner' && typeof data?.type === 'string'
          && (data.type.startsWith('ride_') || data.type.startsWith('partner_') || data.type === 'pregnancy_update')) {
        applyPartnerEvent(data.type, parseRideData(data));
        return;
      }

      // Emergency ride dispatch events (driver side).
      if (typeof data?.type === 'string' && data.type.startsWith('ride_')) {
        const parsed = parseRideData(data);
        applyServerRideEvent(data.type, parsed);
        if (data.type === 'ride_request' && Platform.OS === 'android') {
          const { AndroidImportance } = require('@notifee/react-native');
          const rideId = Number(parsed.ride_id ?? parsed.id);
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
            body: `${parsed.pickup_address || 'A mother'} → ${parsed.dropoff_name || 'hospital'}`,
            data: { type: 'ride_request', ride_id: String(rideId) },
            android: {
              channelId,
              importance: AndroidImportance.HIGH,
              pressAction: { id: 'default', launchActivity: 'default' },
              actions: [
                { title: 'Decline', pressAction: { id: 'ride_decline' } },
                { title: 'Accept', pressAction: { id: 'ride_accept', launchActivity: 'default' } },
              ],
            },
          });
        } else if (['ride_taken', 'ride_cancelled'].includes(data.type)) {
          const rideId = Number(parsed.ride_id ?? parsed.id);
          await notifee.cancelNotification(`ride-${rideId}`).catch(() => {});
        }
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
              id: 'calls_v7_in_app',
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
        } else if (['call_accepted', 'call_rejected', 'call_ended', 'call_timeout', 'call_missed', 'call_failed'].includes(data.type)) {
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
      // Ride-request action buttons / body tap.
      const rideData = detail.notification?.data as any;
      if (rideData?.type === 'ride_request') {
        const rideId = Number(rideData.ride_id);
        await notifee.cancelNotification(detail.notification!.id!).catch(() => {});
        if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'ride_accept') {
          try { await acceptRideDirect(rideId); router.replace(`/driver/overview/${rideId}` as any); } catch {}
        } else if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'ride_decline') {
          try { await declineRideDirect(rideId); } catch {}
        } else if (type === EventType.PRESS) {
          openRideRequest(rideId);
        }
        return;
      }

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
    // Account-approval push tapped from the system tray. Firebase (not
    // notifee) owns these notification+data messages: onNotificationOpenedApp
    // fires when the app was backgrounded, getInitialNotification when it was
    // fully killed and the tap cold-started it.
    const importMessaging = require('@react-native-firebase/messaging').default;

    const handleOpen = (remoteMessage: any) => {
      const t = remoteMessage?.data?.type;
      if (t === 'account_approved') {
        handleAccountApproved();
      } else if (userTypeRef.current === 'partner') {
        // Partners open her ride / updates, never the driver's trip screen.
        const rideId = Number(remoteMessage?.data?.ride_id ?? remoteMessage?.data?.id);
        if (t === 'pregnancy_update' || t === 'partner_stage_changed') router.push('/partner/pregnancy-updates' as any);
        else if (t === 'partner_sharing_changed') router.push('/(partner)/profile' as any);
        else if (t === 'ride_arrived_safely' || t === 'ride_completed' || t === 'ride_cancelled') router.push('/partner/notifications' as any);
        else if (typeof t === 'string' && t.startsWith('ride_') && rideId) router.push(`/partner/ride/${rideId}` as any);
      } else if (typeof t === 'string' && t.startsWith('ride_')) {
        const parsed = parseRideData(remoteMessage.data);
        const rideId = Number(parsed.ride_id ?? parsed.id);
        if (t === 'ride_request') openRideRequest(rideId);
        else if (['ride_accepted', 'ride_started', 'ride_driver_arrived'].includes(t)) {
          router.push(`/driver/trip/${rideId}`);
        }
      }
    };

    const unsubscribeOpened = importMessaging().onNotificationOpenedApp(handleOpen);
    importMessaging().getInitialNotification().then((m: any) => m && handleOpen(m));

    return () => unsubscribeOpened();
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
