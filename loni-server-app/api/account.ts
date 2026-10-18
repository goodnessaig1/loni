import { apiClient } from './client';

export type AccountPrefs = Record<
  'push' | 'email_updates' | 'sms_alerts' | 'incoming_calls' | 'messages' | 'availability_reminders' | 'call_sounds' | 'trip_updates',
  boolean
>;

export interface SupportInfo {
  email: string;
  phone: string;
  hours: string;
  subjects: string[];
}

/** Settings and support shared by every role (backend `account` module). */
export const accountApi = {
  getSettings: async (): Promise<AccountPrefs> => (await apiClient.get('/account/settings')).data.data.prefs,
  updateSettings: async (prefs: Partial<AccountPrefs>): Promise<AccountPrefs> =>
    (await apiClient.put('/account/settings', { prefs })).data.data.prefs,
  supportInfo: async (): Promise<SupportInfo> => (await apiClient.get('/account/support')).data.data,
  contactSupport: async (body: { subject: string; message: string; name?: string; email?: string }) =>
    (await apiClient.post('/account/support', body)).data as { message: string },
};
