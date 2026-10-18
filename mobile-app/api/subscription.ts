import { apiClient } from './client';

export type PlanId = 'monthly' | 'annual';
export type CancelReason = 'too_expensive' | 'not_using_enough' | 'found_alternative' | 'temporary_break' | 'other';

export interface Plan {
  id: PlanId;
  price: number; // whole naira
  currency: string;
  interval: 'month' | 'year';
  label: string;
  billed: string;
  badge?: string | null;
}

export interface Plans {
  trial_days: number;
  features: string[];
  plans: Plan[];
}

export interface Subscription {
  state: 'none' | 'trialing' | 'active' | 'cancelled' | 'expired';
  has_access: boolean;
  plan?: PlanId | null;
  price?: number | null;
  trial_ends_at?: string | null;
  access_ends_at?: string | null;
  days_left?: number | null;
  cancelled_at?: string | null;
  can_start_trial: boolean;
}

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

export const subscriptionApi = {
  plans: async (): Promise<Plans> => unwrap(await apiClient.get('/subscriptions/plans')),
  me: async (): Promise<Subscription> => unwrap(await apiClient.get('/subscriptions/me')),
  startTrial: async (plan: PlanId): Promise<Subscription> =>
    unwrap(await apiClient.post('/subscriptions/trial', { plan })),
  cancel: async (reason: CancelReason, note?: string): Promise<Subscription> =>
    unwrap(await apiClient.post('/subscriptions/cancel', { reason, note: note || undefined })),
  resume: async (): Promise<Subscription> => unwrap(await apiClient.post('/subscriptions/resume')),
};
