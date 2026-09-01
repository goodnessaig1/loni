import { useEffect } from 'react';
import { AppState } from 'react-native';
import { ridesApi } from '../api/rides';
import { useRideStore } from '../store/rideStore';

const TERMINAL = ['COMPLETED', 'CANCELLED', 'NO_DRIVERS', 'FAILED', 'IDLE'];

/**
 * Rehydrates the mother's in-flight ride into the store on app launch /
 * foreground, so the tracker survives a restart. Mount once (home tab).
 */
export function useActiveRideSync(enabled: boolean) {
  const setRide = useRideStore((s) => s.setRide);

  useEffect(() => {
    if (!enabled) return;

    const check = async () => {
      try {
        const ride = await ridesApi.active();
        if (ride && !TERMINAL.includes(ride.status)) setRide(ride);
      } catch {
        /* offline - keep whatever we have */
      }
    };

    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
