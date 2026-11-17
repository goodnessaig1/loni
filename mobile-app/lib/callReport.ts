/**
 * Sends what went wrong on THIS phone during a call to the backend (POST /calls/{id}/client-report),
 * where it joins the call's event trail next to the server's transitions and LiveKit's webhooks.
 * There is no crash-reporting SDK in the app yet; this is the minimum needed to reconstruct a
 * failed call. Only SDK codes/messages are sent - never names, tokens or medical details.
 * Fire-and-forget: reporting must never affect the call itself.
 *
 * Same file in mobile-app and loni-server-app - keep them identical.
 */
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

const APP_VERSION = (() => {
  try {
    return require('expo-constants').default?.expoConfig?.version ?? null;
  } catch {
    return null;
  }
})();

// LiveKit DisconnectReason values that are a normal hang-up, not a failure.
const NORMAL_DISCONNECTS = new Set([1 /* CLIENT_INITIATED */, 5 /* ROOM_DELETED */]);

export function reportCallProblem(callId: number | null | undefined, kind: string, detail?: unknown): void {
  if (!callId) return;
  let text: string | undefined;
  if (detail instanceof Error) text = `${detail.name}: ${detail.message}`;
  else if (detail != null) text = String(detail);
  apiClient
    .post(`/calls/${callId}/client-report`, {
      kind: kind.slice(0, 40),
      detail: text?.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<jwt>').slice(0, 500),
      platform: `${Platform.OS} ${Platform.Version}`.slice(0, 20),
      app_version: APP_VERSION,
    })
    .catch(() => { /* best effort */ });
}

/** Report a LiveKit `Disconnected` unless it was an ordinary hang-up. */
export function reportDisconnect(callId: number | null | undefined, reason: unknown): void {
  if (typeof reason === 'number' && NORMAL_DISCONNECTS.has(reason)) return;
  reportCallProblem(callId, 'livekit_disconnected', `reason=${String(reason)}`);
}
