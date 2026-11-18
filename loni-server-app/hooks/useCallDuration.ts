import { useEffect, useState } from 'react';

/** Seconds since `connectedAt`, ticking once a second. Only the component that shows it re-renders. */
export function useCallDuration(connectedAt: number | null): number {
  const [seconds, setSeconds] = useState(() => (connectedAt ? Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)) : 0));
  useEffect(() => {
    if (!connectedAt) {
      setSeconds(0);
      return;
    }
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [connectedAt]);
  return seconds;
}

export function formatCallDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ss = s < 10 ? `0${s}` : String(s);
  if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${ss}`;
  return `${m}:${ss}`;
}
