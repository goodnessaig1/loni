import { apiClient } from './client';

/**
 * Nurse handoff: a short summary of this chat (stage, any danger signs Loni flagged, allergies/medicines/concerns
 * she has told Loni) that SHE chooses to share with the nurse she is calling. Never sent without her consent, and it
 * says plainly that no clinician has reviewed it.
 */
export const handoffApi = {
  share: async (sessionId: string | null | undefined, includeMessages = false): Promise<void> => {
    await apiClient.post('/ai-chat/handoffs', { session_id: sessionId ?? null, consent: true, include_messages: includeMessages });
  },
};
