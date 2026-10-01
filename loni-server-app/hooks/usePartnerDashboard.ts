import { useQuery } from '@tanstack/react-query';
import { partnerApi } from '../api/partner';
import { useAuth } from './useAuth';

export const partnerDashboardKeys = {
  dashboard: ['partner', 'dashboard'] as const,
};

/** Polls so the emergency alert card and last-known location stay fresh
 * without needing a dedicated WebSocket channel for the partner app. */
export const usePartnerDashboard = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: partnerDashboardKeys.dashboard,
    queryFn: partnerApi.getDashboard,
    enabled: user?.user_type === 'partner',
    refetchInterval: 30_000,
  });
};
