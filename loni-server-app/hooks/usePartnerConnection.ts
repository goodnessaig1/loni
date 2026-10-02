import { useQuery } from '@tanstack/react-query';
import { emergencyContactsApi } from '../api/emergencyContacts';
import { useAuth } from './useAuth';

export const partnerConnectionKeys = {
  connection: ['partner', 'connection'] as const,
};

export const usePartnerConnection = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: partnerConnectionKeys.connection,
    queryFn: emergencyContactsApi.getPartnerConnection,
    enabled: user?.user_type === 'partner',
  });
};
