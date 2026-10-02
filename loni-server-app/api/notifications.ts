import { apiClient } from './client';

export type NotificationType = 'ride_contact_alert' | 'pregnancy_update' | 'location_shared' | string;

export interface PartnerNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any> | null;
  read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  unread_count: number;
  notifications: PartnerNotification[];
}

export const notificationsApi = {
  list: async (): Promise<NotificationsResponse> => {
    const response = await apiClient.get('/users/notifications');
    return response.data.data;
  },
  markAllRead: async (): Promise<void> => {
    await apiClient.post('/users/notifications/mark-read');
  },
};
