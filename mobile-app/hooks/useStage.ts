import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { User } from '../context/AuthContext';
import { queryClient } from '../lib/queryClient';
import { useAuth } from './useAuth';

export interface StageChange {
  status?: 'pregnant' | 'newMom' | 'ttc' | 'general';
  trimester?: 1 | 2 | 3;
  recovery_stage?: 'early' | 'active' | 'extended';
}

/** Changes the mother's stage; the server returns the fresh user, so the whole app updates at once. */
export function useUpdateStage() {
  const { updateUser } = useAuth();
  return useMutation({
    mutationFn: async (change: StageChange): Promise<User> =>
      (await apiClient.patch('/users/stage', change)).data.data.user,
    onSuccess: (user) => {
      updateUser(user);
      // Today's plan, nutrition and the weekly report are all stage-specific.
      queryClient.invalidateQueries({ queryKey: ['care'] });
    },
  });
}
