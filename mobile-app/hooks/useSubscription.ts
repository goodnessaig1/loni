import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CancelReason, PlanId, Subscription, subscriptionApi } from '../api/subscription';
import { queryClient } from '../lib/queryClient';
import { useAuth } from './useAuth';

export const subscriptionKeys = {
  plans: ['subscription', 'plans'] as const,
  me: ['subscription', 'me'] as const,
};

/** The signed-in mother's LoniPlus state. `hasAccess` is the one flag premium UI should switch on. */
export function useSubscription() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: subscriptionKeys.me,
    queryFn: subscriptionApi.me,
    enabled: !!user,
    staleTime: 60_000,
  });
  return { ...query, subscription: query.data, hasAccess: !!query.data?.has_access };
}

export const usePlans = () =>
  useQuery({ queryKey: subscriptionKeys.plans, queryFn: subscriptionApi.plans, staleTime: 10 * 60_000 });

const store = (sub: Subscription) => {
  queryClient.setQueryData(subscriptionKeys.me, sub);
  // Premium content is gated on this, so anything cached under it is now stale (or must disappear).
  queryClient.invalidateQueries({ queryKey: ['care'] });
};

export const useStartTrial = () => useMutation({ mutationFn: (plan: PlanId) => subscriptionApi.startTrial(plan), onSuccess: store });

export const useCancelSubscription = () =>
  useMutation({
    mutationFn: ({ reason, note }: { reason: CancelReason; note?: string }) => subscriptionApi.cancel(reason, note),
    onSuccess: store,
  });

export const useResumeSubscription = () => useMutation({ mutationFn: subscriptionApi.resume, onSuccess: store });

/** Mount once near the root: re-checks the subscription whenever the app returns to the foreground, so a trial
 *  that ended (or was cancelled elsewhere) while the app was in the background is noticed straight away. */
export function useSubscriptionSync() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') queryClient.invalidateQueries({ queryKey: subscriptionKeys.me });
    });
    return () => sub.remove();
  }, [user]);
}
