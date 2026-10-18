/**
 * Brings local call state back in line with the server after events may have been missed (app in
 * the background, WebSocket dropped). Runs when the socket (re)connects and when the app comes to
 * the foreground. Checks the call this user is on and every request still shown as ringing.
 */
import { apiClient } from '../api/client';
import { useCallStore } from '../store/callStore';
import { applyServerCallEvent } from './callEvents';

const ENDED = ['ENDED', 'REJECTED', 'CANCELLED', 'TIMEOUT', 'MISSED', 'FAILED'];
const ANSWERED = ['ACCEPTED', 'CONNECTING', 'CONNECTED', 'RECONNECTING'];

let running = false;

async function stateOf(callId: number): Promise<{ status: string; answered_by_other?: boolean } | null> {
  try {
    return (await apiClient.get(`/calls/${callId}/state`)).data;
  } catch (e: any) {
    return e?.response?.status === 404 || e?.response?.status === 403 ? { status: 'FAILED' } : null;
  }
}

export async function reconcileCall(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const store = useCallStore.getState();

    // Requests still showing on the dashboard: drop the ones that were answered elsewhere or ended.
    for (const req of store.incomingRequests) {
      const st = await stateOf(req.callId);
      if (st && (ENDED.includes(st.status) || st.answered_by_other)) {
        await applyServerCallEvent(ENDED.includes(st.status) ? 'call_ended' : 'call_accepted', { call_id: String(req.callId) });
      }
    }

    // The call we're on or placing.
    const now = useCallStore.getState();
    if (now.callId && (now.isActive || now.isOutgoing)) {
      const st = await stateOf(now.callId);
      if (!st || useCallStore.getState().callId !== now.callId) return;
      if (ENDED.includes(st.status)) {
        await applyServerCallEvent('call_ended', { call_id: String(now.callId) });
      } else if (ANSWERED.includes(st.status) && now.isOutgoing) {
        await applyServerCallEvent('call_accepted', { call_id: String(now.callId) });
      }
    }
  } finally {
    running = false;
  }
}
