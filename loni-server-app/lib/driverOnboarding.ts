import type { Href } from 'expo-router';
import type { User } from '../context/AuthContext';

export type OnboardingStepKey =
  | 'training'
  | 'aptitude'
  | 'personal'
  | 'vehicle'
  | 'documents';

export interface DriverOnboarding {
  current_step: OnboardingStepKey | 'under_review' | 'approved';
  steps: { key: OnboardingStepKey; label: string; complete: boolean }[];
  can_submit: boolean;
  submitted: boolean;
  account_status: 'pending' | 'active' | 'suspended';
}

export const ONBOARDING_ROUTE: Record<DriverOnboarding['current_step'], Href> = {
  training: '/(auth)/driver-training',
  aptitude: '/(auth)/aptitude-intro',
  personal: '/(auth)/complete-profile-driver',
  vehicle: '/(auth)/complete-profile-vehicle',
  documents: '/(auth)/complete-profile-documents',
  under_review: '/(auth)/verification-progress',
  // An approved driver gets the driver-only dashboard + navigation stack,
  // not the nurse tabs.
  approved: '/(driver)',
};

/**
 * The single place that decides where a signed-in user lands. Used by the
 * root index redirect and by the login / verify screens so the three never
 * drift apart again.
 */
export function getPostAuthRoute(user: User | null): Href {
  if (!user) return '/(auth)';

  if (user.user_type === 'nurse') {
    if (!user.nurse_profile) return '/(auth)/complete-profile-nurse';
    if (user.account_status === 'pending') return '/(auth)/verification-progress';
    return '/(tabs)';
  }

  if (user.user_type === 'driver') {
    if (user.account_status === 'active') return '/(driver)';
    const ob = user.driver_onboarding;
    if (!ob) return '/(auth)/driver-training';
    return ONBOARDING_ROUTE[ob.current_step] ?? '/(auth)/driver-training';
  }

  // A support partner doesn't pick a role. First login (phone not yet
  // verified via verify-partner-setup) shows the connection + sharing
  // confirmation once; after that they land straight on their dashboard.
  if (user.user_type === 'partner') {
    return user.isPhoneVerified ? '/(partner)' : '/(auth)/connected';
  }

  // user_type === 'user' (role not chosen yet) or any other role
  return '/(auth)/role-selection';
}

export function isStepComplete(
  ob: DriverOnboarding | undefined,
  step: OnboardingStepKey
): boolean {
  return !!ob?.steps.find((s) => s.key === step)?.complete;
}
