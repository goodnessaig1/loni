import { useQuery } from '@tanstack/react-query';
import { partnerApi } from '../api/partner';
import { useAuth } from './useAuth';

export const partnerDashboardKeys = {
  dashboard: ['partner', 'dashboard'] as const,
};

/**
 * Live-updated via the WebSocket (lib/partnerEvents.ts invalidates this
 * query on every ride/emergency/pregnancy-update event). The interval here
 * is just a safety net for a dropped/reconnecting socket, not the primary
 * update path.
 */
export const usePartnerDashboard = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: partnerDashboardKeys.dashboard,
    queryFn: partnerApi.getDashboard,
    enabled: user?.user_type === 'partner',
    refetchInterval: 5 * 60_000,
  });
};
