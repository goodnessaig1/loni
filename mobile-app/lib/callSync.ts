/**
 * Brings the local call state back in line with the server after events may have been missed:
 * the app was in the background (FCM only wakes it for some events), or the WebSocket dropped and
 * is still backing off. Runs when the socket (re)connects and when the app comes to the foreground.
 */
import { apiClient } from '../api/client';
import { useCallStore } from '../store/callStore';
import { applyServerCallEvent } from './callEvents';
import { reportCallEnded } from './callKeepService';

const ENDED = ['ENDED', 'REJECTED', 'CANCELLED', 'TIMEOUT', 'MISSED', 'FAILED'];
const ANSWERED = ['ACCEPTED', 'CONNECTING', 'CONNECTED', 'RECONNECTING'];

let running = false;

export async function reconcileCall(): Promise<void> {
  const { callId, status } = useCallStore.getState();
  if (!callId || status === 'IDLE' || running) return;
  running = true;
  try {
    const res = await apiClient.get(`/calls/${callId}/state`);
    const server: string = res.data?.status;
    const now = useCallStore.getState();
    if (now.callId !== callId) return; // moved on while we were asking

    if (ENDED.includes(server)) {
      now.endCall(server as any);
      try { reportCallEnded(callId); } catch { /* CallKeep off */ }
    } else if (ANSWERED.includes(server) && now.isOutgoing) {
      // Answered while we weren't listening: same path as a live `call_accepted`.
      await applyServerCallEvent('call_accepted', { call_id: String(callId) });
    } else if (server === 'RECONNECTING' && now.status === 'CONNECTED') {
      now.setReconnecting();
    }
  } catch (e: any) {
    if (e?.response?.status === 404) useCallStore.getState().endCall('FAILED');
    // Network errors: keep the current state; the next foreground/reconnect tries again.
  } finally {
    running = false;
  }
}
