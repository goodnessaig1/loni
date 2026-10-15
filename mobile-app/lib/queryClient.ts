import { QueryClient } from '@tanstack/react-query';

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
