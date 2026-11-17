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
import { useCallStore, ParticipantInfo, isFinished } from '../store/callStore';
import { reportConnected, reportCallEnded } from './callKeepService';
import { reportCallProblem } from './callReport';

export type ServerCallEventType =
  | 'incoming_call'
  | 'call_accepted'
  | 'call_state'
  | 'call_rejected'
  | 'call_ended'
  | 'call_timeout'
  | 'call_missed'
  | 'call_failed';

// Guards against the exact race this fixes: `call_accepted` is delivered
// over BOTH the WebSocket and FCM by design (see backend's `_emit()`), and
// the old guard only blocked re-entry once `store.status` reached
// CONNECTING/CONNECTED - but `store.setAccepted()` sets status to
// 'ACCEPTED' first, synchronously, before the `await apiClient.post(...)`
// below even starts. A second delivery arriving in that window saw status
// still 'ACCEPTED' (not blocked by the old check) and fired a second
// POST /join for the same call - confirmed in production logs
// (`POST /api/v1/calls/29/join` appeared twice back to back). A dedicated
// in-flight set is more robust than widening the status check further,
// since it doesn't depend on exactly which store field happens to be set
// at exactly which point in the async flow.
const joinInFlight = new Set<number>();

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

/** POST /join, retried briefly on network errors and 5xx (a 4xx means the call is gone: no retry). */
async function joinWithRetry(callId: number, attempts = 3) {
  let last: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await apiClient.post(`/calls/${callId}/join`);
    } catch (e: any) {
      last = e;
      const status = e?.response?.status;
      if (status && status < 500) throw e;
      if (useCallStore.getState().callId !== callId) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw last;
}

export async function applyServerCallEvent(type: string, data: any) {
  const store = useCallStore.getState();
  const callId = data?.call_id ? Number(data.call_id) : null;

  switch (type) {
    case 'incoming_call': {
      if (callId == null || isFinished(callId)) return;
      if (store.callId === callId) return; // the same ring delivered twice (WebSocket + push)
      // Already on (or placing) a call: never drop it for a new one. Unmounting the room would cut
      // her current call while the server still has it live. Decline the newcomer instead, so the
      // other side hears straight away rather than ringing out.
      if (store.status !== 'IDLE') {
        apiClient.post(`/calls/${callId}/reject`).catch(() => { /* it times out server-side anyway */ });
        return;
      }
      store.setIncomingCall(callId, data.room_name, toParticipant(data.caller), {
        kind: data.kind === 'ride' ? 'ride' : 'nurse',
        rideId: data.ride_id != null ? Number(data.ride_id) : null,
      });
      return;
    }

    case 'call_accepted': {
      if (callId == null || store.isStale(callId)) return;
      // The accept event does NOT carry a token for the caller (only the
      // nurse who called POST /accept gets one back synchronously) - the
      // caller must exchange it for a token via POST /join. Guard against
      // doing this twice if both the WS and the push deliver the event
      // (see joinInFlight's comment above for why status alone isn't
      // sufficient here).
      if (store.status === 'ACCEPTED' || store.status === 'CONNECTING' || store.status === 'CONNECTED') return;
      if (joinInFlight.has(callId)) return;
      joinInFlight.add(callId);
      store.setAccepted({ remote: toParticipant(data.receiver) });
      try {
        const res = await joinWithRetry(callId);
        if (useCallStore.getState().callId !== callId) return; // she hung up meanwhile
        store.setConnecting({
          callId,
          roomToken: res.data.token,
          livekitUrl: res.data.livekit_url,
          remote: toParticipant(res.data.participant) ?? toParticipant(data.receiver),
        });
      } catch (e) {
        // Used to only log, leaving her on "accepted - connecting..." until she cancelled.
        console.error('[callEvents] Failed to join accepted call', e);
        reportCallProblem(callId, 'join_failed', (e as any)?.response?.status ? `HTTP ${(e as any).response.status}` : e);
        if (useCallStore.getState().callId === callId) {
          useCallStore.getState().endCall('FAILED');
          try { reportCallEnded(callId); } catch { /* CallKeep off */ }
          apiClient.post(`/calls/${callId}/end`).catch(() => { /* the server sweeps it */ });
        }
      } finally {
        joinInFlight.delete(callId);
      }
      return;
    }

    case 'call_state': {
      if (callId == null || store.isStale(callId)) return;
      const status = data.status;
      if (status === 'CONNECTED') {
        const ts = Date.now(); // Ignore server's started_at to avoid clock skew bugs
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
