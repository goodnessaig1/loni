import { AppState } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

/**
 * Single shared QueryClient instance. Pulled out of app/_layout.tsx so
 * non-component modules (api/socket.ts, lib/partnerEvents.ts) can push
 * live WebSocket updates straight into the cache instead of the UI relying
 * on polling to notice a change.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Live data arrives over the WebSocket; this only bounds how stale a screen can get.
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// React Native has no window focus event: tell React Query when the app comes back to the
// foreground, so stale screens refetch then (data changed while the phone was in a pocket).
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
  return () => sub.remove();
});
