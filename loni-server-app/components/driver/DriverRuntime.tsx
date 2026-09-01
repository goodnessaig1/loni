import { useEffect } from 'react';
import { useDriverStats } from '../../hooks/useRides';
import { useRideStore } from '../../store/rideStore';
import { startForegroundLocation, startTripLocation, stopDriverLocation } from '../../lib/driverLocation';

const ACTIVE = ['DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS'];

/**
 * Mounted once inside the driver route group. Owns the location-broadcaster
 * lifecycle so no individual screen has to:
 *   - on an active trip  -> background streaming + foreground service
 *   - otherwise, if online/available -> foreground streaming
 *   - otherwise -> off
 */
export function DriverRuntime() {
  const stats = useDriverStats();
  const rideStatus = useRideStore((s) => s.ride?.status);

  const online = !!stats.data?.is_online && !!stats.data?.is_available;
  const onTrip = !!rideStatus && ACTIVE.includes(rideStatus);

  useEffect(() => {
    if (onTrip) {
      startTripLocation();
    } else if (online) {
      startForegroundLocation();
    } else {
      stopDriverLocation();
    }
  }, [online, onTrip]);

  useEffect(() => () => { stopDriverLocation(); }, []);

  return null;
}
