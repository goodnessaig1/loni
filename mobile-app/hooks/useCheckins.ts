import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { checkinsApi, CheckinPreferences } from '../api/checkins';
import { queryClient } from '../lib/queryClient';
import { useAuth } from './useAuth';

const KEY = ['checkins', 'preferences'] as const;

export function useCheckinPreferences() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: KEY, queryFn: checkinsApi.preferences, enabled: !!user, staleTime: 5 * 60_000 });

  const update = useMutation({
    mutationFn: checkinsApi.updatePreferences,
    // The switch flips instantly; if the server refuses, it flips back.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<CheckinPreferences>(KEY);
      if (previous) queryClient.setQueryData<CheckinPreferences>(KEY, { ...previous, ...patch });
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(KEY, ctx.previous),
    onSuccess: (prefs) => queryClient.setQueryData(KEY, prefs),
  });

  return { prefs: query.data, isLoading: query.isLoading, update };
}

/** "Good morning" should be HER morning: tell the server the phone's timezone once it differs from what is stored. */
export function useSyncTimezone() {
  const { prefs, update } = useCheckinPreferences();
  useEffect(() => {
    if (!prefs) return;
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (tz && tz !== prefs.timezone) update.mutate({ timezone: tz });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs?.timezone]);
}
