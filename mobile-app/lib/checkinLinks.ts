import { router } from 'expo-router';
import { checkinsApi } from '../api/checkins';

/** What a push notification carries (FCM data values are all strings). */
export type PushData = Record<string, string | undefined> | undefined;

/**
 * Opens the conversation a check-in notification points at, and tells the server she opened it (so she is not
 * counted as ignoring it). Returns false when the push was not a check-in, so other handlers can take it.
 */
export function openFromPush(data: PushData): boolean {
  if (!data || data.type !== 'checkin' || !data.session_id) return false;
  if (data.checkin_id) checkinsApi.opened(data.checkin_id).catch(() => {});
  router.push({ pathname: '/chat/conversation', params: { existingSessionId: String(data.session_id) } });
  return true;
}
