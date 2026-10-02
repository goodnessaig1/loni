import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications';
import { useAuth } from './useAuth';

export const notificationKeys = {
  list: ['notifications'] as const,
};

/**
 * Live-updated via the WebSocket (lib/partnerEvents.ts invalidates this on
 * every relevant event). The interval here is just a safety net.
 */
export const useNotifications = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: notificationKeys.list,
    queryFn: notificationsApi.list,
    enabled: !!user,
    refetchInterval: 5 * 60_000,
  });
};

export const useMarkNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.list }),
  });
};
