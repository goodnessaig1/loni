import { apiClient } from './client';

export interface CheckinPreferences {
  enabled: boolean;
  timezone: string;
  preferred_hour: number;
  /** May Loni keep short notes (tags, never your words) of what you share? */
  remember: boolean;
  quiet_from_hour: number;
  /** Check-ins are paused through this date (YYYY-MM-DD), or null. */
  paused_until?: string | null;
}

/** One thing Loni remembers, with where it came from. She can correct, resolve or delete each one. */
export interface MemoryFact {
  id: number;
  kind: 'symptom' | 'concern' | 'medication' | 'allergy' | 'appointment' | 'condition' | 'preference';
  key: string;
  label: string;
  detail: string | null;
  event_date: string | null;
  provenance: 'user_reported' | 'clinician_confirmed' | 'ai_inferred';
  status: 'active' | 'resolved';
  stale: boolean;
  last_noted: string;
}

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

export const checkinsApi = {
  preferences: async (): Promise<CheckinPreferences> => unwrap(await apiClient.get('/checkins/preferences')),
  updatePreferences: async (body: Partial<Pick<CheckinPreferences, 'enabled' | 'timezone' | 'preferred_hour' | 'remember'>> & { pause_days?: number }): Promise<CheckinPreferences> =>
    unwrap(await apiClient.put('/checkins/preferences', body)),
  /** Erase everything Loni has noted about your days. */
  forget: async (): Promise<number> => unwrap<{ removed: number }>(await apiClient.delete('/checkins/memory')).removed,
  facts: async (): Promise<MemoryFact[]> => unwrap<{ facts: MemoryFact[] }>(await apiClient.get('/checkins/memory')).facts ?? [],
  correctFact: async (id: number, body: { key?: string; status?: 'active' | 'resolved'; event_date?: string }): Promise<MemoryFact> =>
    unwrap(await apiClient.patch(`/checkins/memory/facts/${id}`, body)),
  addFact: async (body: { kind: 'allergy' | 'medication' | 'condition' | 'appointment'; key: string; event_date?: string }): Promise<MemoryFact> =>
    unwrap(await apiClient.post('/checkins/memory/facts', body)),
  deleteFact: async (id: number): Promise<void> => {
    await apiClient.delete(`/checkins/memory/facts/${id}`);
  },
  opened: async (checkinId: number | string): Promise<void> => {
    await apiClient.post(`/checkins/${checkinId}/opened`);
  },
};
