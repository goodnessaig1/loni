import { QueryClient } from '@tanstack/react-query';

/**
 * Single shared QueryClient instance. Pulled out of app/_layout.tsx so
 * non-component modules (api/socket.ts, lib/partnerEvents.ts) can push
 * live WebSocket updates straight into the cache instead of the UI relying
 * on polling to notice a change.
 */
export const queryClient = new QueryClient();
