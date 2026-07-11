import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, setupNotificationHandlers } from '../utils/notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { AuthContext } from './AuthContext';
import { apiClient } from '../api/client';
import { useCallStore } from '../store/callStore';

interface NotificationContextType {
  pushToken: string | null;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [pushToken, setPushToken] = useState<string | null>(null);
  
  const { user } = useContext(AuthContext);

  useEffect(() => {
    setupNotificationHandlers();

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      console.log('[Push] Notification received in foreground:', notification);
      if (data && data.type === 'incoming_call') {
        useCallStore.getState().setIncomingCall(Number(data.call_id), data.caller_name as string, data.room_name as string);
      } else if (data && data.type === 'call_accepted') {
        apiClient.post(`/calls/${data.call_id}/join`).then(res => {
          useCallStore.getState().setCallConnected(res.data.token);
        }).catch(e => console.error("Failed to join accepted call", e));
      }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('[Push] Notification clicked. Data:', data);
      if (data && data.type === 'incoming_call') {
        useCallStore.getState().setIncomingCall(Number(data.call_id), data.caller_name as string, data.room_name as string);
      } else if (data && data.type === 'call_accepted') {
        apiClient.post(`/calls/${data.call_id}/join`).then(res => {
          useCallStore.getState().setCallConnected(res.data.token);
        }).catch(e => console.error("Failed to join accepted call", e));
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
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
