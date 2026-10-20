import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountApi, AccountPrefs } from '../api/account';
import { useAuth } from './useAuth';
import { rememberCallSounds } from '../lib/localPrefs';

export const accountKeys = {
  settings: ['account', 'settings'] as const,
  support: ['account', 'support'] as const,
};

export const useAccountSettings = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: accountKeys.settings,
    queryFn: async () => {
      const prefs = await accountApi.getSettings();
      rememberCallSounds(prefs.call_sounds);
      return prefs;
    },
    enabled: !!user,
  });
};

/** Flips one setting optimistically; rolls back if the save fails. */
export const useUpdateSetting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (change: Partial<AccountPrefs>) => accountApi.updateSettings(change),
    onMutate: async (change) => {
      await qc.cancelQueries({ queryKey: accountKeys.settings });
      const prev = qc.getQueryData<AccountPrefs>(accountKeys.settings);
      if (prev) qc.setQueryData(accountKeys.settings, { ...prev, ...change });
      return { prev };
    },
    onError: (_e, _c, ctx) => { if (ctx?.prev) qc.setQueryData(accountKeys.settings, ctx.prev); },
    onSuccess: (prefs) => {
      qc.setQueryData(accountKeys.settings, prefs);
      rememberCallSounds(prefs.call_sounds);
    },
  });
};

export const useSupportInfo = () =>
  useQuery({ queryKey: accountKeys.support, queryFn: accountApi.supportInfo, staleTime: 60 * 60_000 });

export const useContactSupport = () => useMutation({ mutationFn: accountApi.contactSupport });
