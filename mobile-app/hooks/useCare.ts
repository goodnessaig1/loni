import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { careApi, HospitalBag, TodayPlan } from '../api/care';
import { queryClient } from '../lib/queryClient';
import { subscriptionKeys, useSubscription } from './useSubscription';

export const careKeys = {
  overview: ['care', 'overview'] as const,
  today: ['care', 'today'] as const,
  nutrition: ['care', 'nutrition'] as const,
  report: ['care', 'report'] as const,
  bag: ['care', 'bag'] as const,
  labour: ['care', 'labour'] as const,
  labourTopic: (slug: string) => ['care', 'labour', slug] as const,
};

/** Premium queries only run for members, so a free user never hits (and 403s on) these endpoints. */
const usePremiumQuery = <T,>(key: readonly unknown[], fn: () => Promise<T>) => {
  const { hasAccess } = useSubscription();
  const query = useQuery({ queryKey: key, queryFn: fn, enabled: hasAccess });

  // The server is the authority: a 403 means the trial/subscription ended since we last looked,
  // so refresh the cached subscription (screens then fall back to the offer) instead of showing an error.
  const status = (query.error as any)?.response?.status;
  useEffect(() => {
    if (status === 403) queryClient.invalidateQueries({ queryKey: subscriptionKeys.me });
  }, [status]);

  return query;
};

export const useCareOverview = () => usePremiumQuery(careKeys.overview, careApi.overview);
export const useTodayPlan = () => usePremiumQuery(careKeys.today, careApi.today);
export const useNutrition = () => usePremiumQuery(careKeys.nutrition, careApi.nutrition);
export const useWeeklyReport = () => usePremiumQuery(careKeys.report, careApi.weeklyReport);
export const useHospitalBag = () => usePremiumQuery(careKeys.bag, careApi.hospitalBag);
export const useLabourTopics = () => usePremiumQuery(careKeys.labour, careApi.labourTopics);
export const useLabourTopic = (slug: string) => usePremiumQuery(careKeys.labourTopic(slug), () => careApi.labourTopic(slug));

/** Tick/untick with an instant UI response; rolls back if the server refuses. */
export function useToggleTask() {
  return useMutation({
    mutationFn: ({ key, done }: { key: string; done: boolean }) => careApi.setTask(key, done),
    onMutate: async ({ key, done }) => {
      await queryClient.cancelQueries({ queryKey: careKeys.today });
      const previous = queryClient.getQueryData<TodayPlan>(careKeys.today);
      if (previous) {
        const tasks = previous.tasks.map((t) => (t.key === key ? { ...t, done } : t));
        queryClient.setQueryData<TodayPlan>(careKeys.today, { ...previous, tasks, done: tasks.filter((t) => t.done).length });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(careKeys.today, ctx.previous),
    onSuccess: (plan) => queryClient.setQueryData(careKeys.today, plan),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: careKeys.overview });
      queryClient.invalidateQueries({ queryKey: careKeys.report });
    },
  });
}

export function useToggleBagItem() {
  return useMutation({
    mutationFn: ({ key, checked }: { key: string; checked: boolean }) => careApi.setBagItem(key, checked),
    onMutate: async ({ key, checked }) => {
      await queryClient.cancelQueries({ queryKey: careKeys.bag });
      const previous = queryClient.getQueryData<HospitalBag>(careKeys.bag);
      if (previous) {
        const groups = previous.groups.map((g) => ({
          ...g,
          items: g.items.map((i) => (i.key === key ? { ...i, checked } : i)),
        }));
        const done = groups.reduce((n, g) => n + g.items.filter((i) => i.checked).length, 0);
        queryClient.setQueryData<HospitalBag>(careKeys.bag, { ...previous, groups, done });
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(careKeys.bag, ctx.previous),
    onSuccess: (bag) => queryClient.setQueryData(careKeys.bag, bag),
    onSettled: () => queryClient.invalidateQueries({ queryKey: careKeys.overview }),
  });
}
