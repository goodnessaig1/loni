import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { ridesApi } from '../api/rides';
import { useRideStore } from '../store/rideStore';

const TERMINAL = ['COMPLETED', 'CANCELLED', 'NO_DRIVERS', 'FAILED', 'IDLE'];

/**
 * Keeps the mother's ride fresh:
 *  - rehydrates the in-flight ride on launch / foreground (tracker survives
 *    a restart),
 *  - polls every 5s while a ride is live, as a safety net for when the
 *    WebSocket / FCM push doesn't land (bad wifi, emulator FCM, etc.) - the
 *    ride state transitions and the tracker updates even with no realtime.
 *
 * Mount once, on the home tab.
 */
export function useActiveRideSync(enabled: boolean) {
  const setRide = useRideStore((s) => s.setRide);
  const patchRide = useRideStore((s) => s.patchRide);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const pull = async () => {
      const store = useRideStore.getState();
      const local = store.ride;
      try {
        if (local && !TERMINAL.includes(local.status)) {
          // We have a live ride - fetch that exact one so we still see the
          // COMPLETED / CANCELLED transition (which /active hides).
          const fresh = await ridesApi.get(local.id);
          patchRide(fresh);
        } else if (!local || TERMINAL.includes(local.status)) {
          const active = await ridesApi.active();
          if (active && !TERMINAL.includes(active.status)) setRide(active);
        }
      } catch {
        /* offline - keep what we have */
      }
    };

    pull();
    const onState = AppState.addEventListener('change', (s) => { if (s === 'active') pull(); });

    timer.current = setInterval(() => {
      const s = useRideStore.getState().ride;
      if (s && !TERMINAL.includes(s.status)) pull();
    }, 5000);

    return () => {
      onState.remove();
      if (timer.current) clearInterval(timer.current);
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
