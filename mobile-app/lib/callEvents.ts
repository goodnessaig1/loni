/**
 * Single place that turns a server-sent call event (received over the
 * WebSocket, a foreground Firebase data message, or a background notifee
 * action press) into store mutations / API calls.
 *
 * Issue 10/11 fix: before this file existed, the exact same "if
 * type===incoming_call" branch was copy-pasted in three different places
 * (expo-notifications listener x2 + firebase onMessage) with slightly
 * different code each time, and nothing guarded against the same event
 * being delivered twice (WS + push both fire for every call event by
 * design - see backend's `_emit()` - so double delivery is expected, not
 * an edge case). Centralizing it here means there's one implementation to
 * get right, and it can check `useCallStore` state before acting so a
 * duplicate delivery is a safe no-op instead of a duplicate network call
 * or a flicker back to a stale screen.
 */
import { apiClient } from '../api/client';
import { useCallStore, ParticipantInfo } from '../store/callStore';
import { reportConnected, reportCallEnded } from './callKeepService';

export type ServerCallEventType =
  | 'incoming_call'
  | 'call_accepted'
  | 'call_state'
  | 'call_rejected'
  | 'call_ended'
  | 'call_timeout'
  | 'call_missed'
  | 'call_failed';

function toParticipant(raw: any): ParticipantInfo | null {
  if (!raw) return null;
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? 'Unknown',
    user_type: raw.user_type ?? null,
    profile_picture: raw.profile_picture ?? null,
    trimester: raw.trimester ?? null,
    pregnancy_week: raw.pregnancy_week ?? null,
    hospital_affiliation: raw.hospital_affiliation ?? null,
    years_of_experience: raw.years_of_experience ?? null,
  };
}

export async function applyServerCallEvent(type: string, data: any) {
  const store = useCallStore.getState();
  const callId = data?.call_id ? Number(data.call_id) : null;

  switch (type) {
    case 'incoming_call': {
      if (callId == null) return;
      // A brand new incoming call always wins over whatever we were
      // tracking (there is at most one active call per user in this app).
      store.setIncomingCall(callId, data.room_name, toParticipant(data.caller));
      return;
    }

    case 'call_accepted': {
      if (callId == null || store.isStale(callId)) return;
      // The accept event does NOT carry a token for the caller (only the
      // nurse who called POST /accept gets one back synchronously) - the
      // caller must exchange it for a token via POST /join. Guard against
      // doing this twice if both the WS and the push deliver the event.
      if (store.status === 'CONNECTING' || store.status === 'CONNECTED') return;
      store.setAccepted({ remote: toParticipant(data.receiver) });
      try {
        const res = await apiClient.post(`/calls/${callId}/join`);
        store.setConnecting({
          callId,
          roomToken: res.data.token,
          livekitUrl: res.data.livekit_url,
          remote: toParticipant(res.data.participant) ?? toParticipant(data.receiver),
        });
      } catch (e) {
        console.error('[callEvents] Failed to join accepted call', e);
      }
      return;
    }

    case 'call_state': {
      if (callId == null || store.isStale(callId)) return;
      const status = data.status;
      if (status === 'CONNECTED') {
        const ts = data.started_at ? new Date(data.started_at).getTime() : Date.now();
        store.setConnected(ts); // Issue 3: this is the ONLY place the timer basis is set
        try { reportConnected(callId); } catch { /* CallKeep unavailable - non-fatal */ }
      } else if (status === 'RECONNECTING') {
        store.setReconnecting();
      } else if (['ENDED', 'REJECTED', 'CANCELLED', 'TIMEOUT', 'MISSED', 'FAILED'].includes(status)) {
        store.endCall(status);
        try { reportCallEnded(callId); } catch { /* CallKeep unavailable - non-fatal */ }
      }
      return;
    }

    case 'call_rejected':
    case 'call_ended':
    case 'call_timeout':
    case 'call_missed':
    case 'call_failed': {
      if (callId == null || store.isStale(callId)) return;
      const map: Record<string, any> = {
        call_rejected: 'REJECTED',
        call_ended: 'ENDED',
        call_timeout: 'TIMEOUT',
        call_missed: 'MISSED',
        call_failed: 'FAILED',
      };
      store.endCall(map[type]);
      // Nurse-driven end (declined/hung up/timed out) - dismiss the native
      // outgoing-call UI on the Mother's side too.
      try { reportCallEnded(callId); } catch { /* CallKeep unavailable - non-fatal */ }
      return;
    }
  }
}
