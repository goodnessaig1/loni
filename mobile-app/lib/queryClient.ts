import { AppState } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

/**
 * Single shared QueryClient. Lives outside app/_layout.tsx so non-component modules (the WebSocket
 * handlers in lib/communityEvents.ts) can write live updates straight into the cache.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Lists are kept fresh by WebSocket events + explicit invalidation, so don't refetch on every focus.
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
