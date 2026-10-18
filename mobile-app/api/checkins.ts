import { apiClient } from './client';

export interface CheckinPreferences {
  enabled: boolean;
  timezone: string;
  preferred_hour: number;
  /** May Loni keep short notes (tags, never your words) of what you share? */
  remember: boolean;
  quiet_from_hour: number;
}

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

export const checkinsApi = {
  preferences: async (): Promise<CheckinPreferences> => unwrap(await apiClient.get('/checkins/preferences')),
  updatePreferences: async (body: Partial<Pick<CheckinPreferences, 'enabled' | 'timezone' | 'preferred_hour' | 'remember'>>): Promise<CheckinPreferences> =>
    unwrap(await apiClient.put('/checkins/preferences', body)),
  /** Erase everything Loni has noted about your days. */
  forget: async (): Promise<number> => unwrap<{ removed: number }>(await apiClient.delete('/checkins/memory')).removed,
  opened: async (checkinId: number | string): Promise<void> => {
    await apiClient.post(`/checkins/${checkinId}/opened`);
  },
};
