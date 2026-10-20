import * as SecureStore from 'expo-secure-store';
import { API_URL } from './client';
import { applyServerCallEvent } from '../lib/callEvents';
import { handleAccountApproved } from '../lib/accountStatus';
import { applyServerRideEvent } from '../lib/rideEvents';
import { applyPartnerEvent } from '../lib/partnerEvents';

/**
 * Real-time call signaling socket (Issue 1, 2, 8, 10, 11).
 *
 * This is the piece that was completely missing before: the app relied
 * 100% on push notifications for call state, which cannot hit the <500ms
 * "instant accept" requirement and has no delivery/ordering guarantees.
 * This socket is opened once the user is authenticated and stays open for
 * the life of the foregrounded app; FCM remains responsible only for
 * waking a backgrounded/killed app (see index.js).
 *
 * Lifecycle handled here per Issue 11's audit checklist:
 *  - Connection: single connect() call, guarded against being called again
 *    while already open/connecting (no duplicate sockets/listeners).
 *  - Disconnection: explicit disconnect() clears all timers and listeners.
 *  - Reconnect: exponential backoff (1s -> 30s cap) unless disconnect() was
 *    called explicitly (e.g. logout).
 *  - Keepalive: app-level ping/pong every 25s so a NAT-killed connection is
 *    detected and replaced quickly instead of silently going dark.
 */

let socket: WebSocket | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let manuallyClosed = false;
let currentUserType: string | undefined;

/** Set by NotificationContext whenever the signed-in user changes. */
export function setSocketUserType(t: string | undefined) {
  currentUserType = t;
}

function wsBaseUrl(): string {
  return API_URL.replace(/^http/, 'ws');
}

// Coming back to the foreground: reconnect now (not after the backoff) and resync calls.
let appStateSub: { remove: () => void } | null = null;
function watchAppState() {
  if (appStateSub) return;
  const { AppState } = require('react-native');
  appStateSub = AppState.addEventListener('change', (next: string) => {
    if (next !== 'active' || manuallyClosed) return;
    reconnectAttempts = 0;
    connectCallSocket();
    require('../lib/callSync').reconcileCall();
    if (currentUserType === 'partner') require('../lib/partnerEvents').refreshPartnerViews();
  });
}

export async function connectCallSocket(): Promise<void> {
  watchAppState();
  manuallyClosed = false;

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const token = await SecureStore.getItemAsync('userToken');
  if (!token) return;

  const url = `${wsBaseUrl()}/calls/ws?token=${encodeURIComponent(token)}`;

  try {
    socket = new WebSocket(url);
  } catch (e) {
    console.warn('[CallSocket] failed to construct WebSocket', e);
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    reconnectAttempts = 0;
    require('../lib/connectivity').markOnline();
    // Anything that happened to a call or a ringing request while we were disconnected.
    require('../lib/callSync').reconcileCall();
    // A partner may have missed her sharing/stage changes or new updates while offline.
    if (currentUserType === 'partner') require('../lib/partnerEvents').refreshPartnerViews();
    console.log('[CallSocket] connected');
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      try {
        socket?.send(JSON.stringify({ type: 'ping' }));
      } catch (e) {
        // send failing means the socket is dead; onclose will fire next.
      }
    }, 25000);
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.type === 'pong') return;
      if (msg.type === 'account_status') {
        if (msg.data?.account_status === 'active') handleAccountApproved();
        return;
      }
      if (typeof msg.type === 'string' && msg.type.startsWith('partner_')) {
        applyPartnerEvent(msg.type, msg.data);
        return;
      }
      if (typeof msg.type === 'string' && (msg.type.startsWith('ride_') || msg.type === 'pregnancy_update')) {
        // A partner's events are about the mother's ride, never a trip of their own.
        if (currentUserType !== 'partner') applyServerRideEvent(msg.type, msg.data);
        // Harmless no-op for a driver/nurse session - see lib/partnerEvents.ts.
        applyPartnerEvent(msg.type, msg.data);
        return;
      }
      applyServerCallEvent(msg.type, msg.data);
    } catch (e) {
      console.warn('[CallSocket] malformed message', e);
    }
  };

  socket.onerror = (e) => {
    console.warn('[CallSocket] error', e);
  };

  socket.onclose = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    socket = null;
    if (!manuallyClosed) {
      scheduleReconnect();
    }
  };
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delay = Math.min(30000, 1000 * 2 ** reconnectAttempts);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    connectCallSocket();
  }, delay);
}

export function disconnectCallSocket(): void {
  manuallyClosed = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  socket?.close();
  socket = null;
}
