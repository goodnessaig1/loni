/**
 * Is LONI reachable right now? (same file in loni-server-app/lib/connectivity.ts)
 *
 * Learned from traffic the app already makes - no extra native module:
 *  - a request that gets no response at all  -> offline
 *  - any response from the API, or the live socket opening -> online
 * While offline, a light health check runs every 5 s so the app notices the moment it's back.
 * React Query is told too, so queries pause offline and refetch automatically on reconnect.
 */
import { create } from 'zustand';
import { onlineManager } from '@tanstack/react-query';

interface ConnectivityState {
  online: boolean;
}

export const useConnectivity = create<ConnectivityState>(() => ({ online: true }));

let probe: ReturnType<typeof setInterval> | null = null;

export function markOnline() {
  if (probe) {
    clearInterval(probe);
    probe = null;
  }
  if (!useConnectivity.getState().online) {
    useConnectivity.setState({ online: true });
    onlineManager.setOnline(true);
  }
}

export function markOffline() {
  if (useConnectivity.getState().online) {
    useConnectivity.setState({ online: false });
    onlineManager.setOnline(false);
  }
  if (!probe) {
    probe = setInterval(async () => {
      try {
        // Lazy import: client.ts imports this file.
        const { apiClient } = require('../api/client');
        await apiClient.get('/health/', { timeout: 4000 });
        markOnline();
      } catch {
        /* still offline */
      }
    }, 5000);
  }
}
