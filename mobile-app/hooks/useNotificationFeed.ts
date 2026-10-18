import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryClient } from '../lib/queryClient';
import { useAuth } from './useAuth';

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  read: boolean;
  created_at: string | null;
}

const KEY = ['notifications'] as const;

/** The signed-in mother's notification history and unread count (drives the bell dot and the Notifications screen). */
export function useNotificationFeed() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: KEY,
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<{ unread_count: number; notifications: AppNotification[] }> =>
      (await apiClient.get('/users/notifications')).data.data,
  });
  return { ...query, notifications: query.data?.notifications ?? [], unread: query.data?.unread_count ?? 0 };
}

export const useMarkNotificationsRead = () =>
  useMutation({
    mutationFn: async () => apiClient.post('/users/notifications/mark-read'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
