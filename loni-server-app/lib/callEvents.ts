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
import { reportConnected, reportCallEnded, displayIncomingCall } from './callKeepService';

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

/**
 * Called directly (accept/decline) from index.js's notifee background
 * event handler too - see that file. It hits the REST endpoints without
 * going through useCall()'s hook wrapper because hooks can't be used
 * outside a React component and the JS engine may have no mounted React
 * tree at all when a background notification action fires.
 */
export async function acceptCallDirect(callId: number) {
  const res = await apiClient.post(`/calls/${callId}/accept`);
  useCallStore.getState().setConnecting({
    callId,
    roomToken: res.data.token,
    livekitUrl: res.data.livekit_url,
    remote: toParticipant(res.data.participant),
  });
  return res.data;
}

export async function rejectCallDirect(callId: number) {
  await apiClient.post(`/calls/${callId}/reject`);
  useCallStore.getState().endCall('REJECTED');
}

export async function applyServerCallEvent(type: string, data: any) {
  const store = useCallStore.getState();
  const callId = data?.call_id ? Number(data.call_id) : null;

  switch (type) {
    case 'incoming_call': {
      if (callId == null) return;
      store.setIncomingCall(callId, data.room_name, toParticipant(data.caller));
      // Ensures the native CallKit/ConnectionService UI shows up even when
      // this event arrived over the WebSocket or a foreground Firebase
      // message rather than the VoIP-push/FCM-background path (which
      // already calls this directly, before the JS store even exists -
      // see index.js / lib/voipPush.ts). Safe to call twice for the same
      // call id (see displayIncomingCall's idempotency note).
      try {
        const name = toParticipant(data.caller)?.name || data.caller_name || 'Incoming Call';
        displayIncomingCall(callId, name);
      } catch { /* CallKeep unavailable - the in-app CallModals UI still works */ }
      return;
    }

    case 'call_accepted': {
      if (callId == null) return;
      if (store.callId === callId && (store.status === 'CONNECTING' || store.status === 'CONNECTED')) return;
      store.removeIncomingCall(callId);
      try { reportCallEnded(callId); } catch {}
      return;
    }

    case 'call_state': {
      if (callId == null) return;
      const status = data.status;
      
      if (store.callId !== callId) {
        if (['ENDED', 'REJECTED', 'CANCELLED', 'TIMEOUT', 'MISSED', 'FAILED', 'ACCEPTED', 'CONNECTED'].includes(status)) {
          store.removeIncomingCall(callId);
          try { reportCallEnded(callId); } catch {}
        }
        return;
      }

      if (status === 'CONNECTED') {
        const ts = Date.now(); 
        store.setConnected(ts); 
        try { reportConnected(callId); } catch {}
      } else if (status === 'RECONNECTING') {
        store.setReconnecting();
      } else if (['ENDED', 'REJECTED', 'CANCELLED', 'TIMEOUT', 'MISSED', 'FAILED'].includes(status)) {
        store.endCall(status);
        try { reportCallEnded(callId); } catch {}
      }
      return;
    }

    case 'call_rejected':
    case 'call_ended':
    case 'call_timeout':
    case 'call_missed':
    case 'call_failed': {
      if (callId == null) return;
      
      if (store.callId !== callId) {
        store.removeIncomingCall(callId);
        try { reportCallEnded(callId); } catch {}
        return;
      }

      const map: Record<string, any> = {
        call_rejected: 'REJECTED',
        call_ended: 'ENDED',
        call_timeout: 'TIMEOUT',
        call_missed: 'MISSED',
        call_failed: 'FAILED',
      };
      store.endCall(map[type]);
      try { reportCallEnded(callId); } catch {}
      return;
    }
  }
}
