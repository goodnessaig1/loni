import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AudioRouteKind, AudioRouteState, getAudioRoute, selectAudioRoute } from '../lib/audioSession';

const POLL_MS = 1500;

function same(a: AudioRouteState, b: AudioRouteState) {
  return a.current === b.current && a.available.join() === b.available.join();
}

/**
 * The call's audio route as the OS reports it, kept fresh while `active`: a headset plugged in or a
 * Bluetooth device dropping out shows up within ~1.5s. Neither @livekit/react-native nor the OS
 * gives React Native an event for this, so it is polled (a cheap native read) while the call screen
 * is visible. The OS itself moves the audio when a device goes away (Android AudioSwitch falls back
 * by OUTPUT_PRIORITY; iOS falls back to the receiver); this only keeps the UI honest.
 *
 * Same file in mobile-app and loni-server-app.
 */
export function useAudioRoute(active: boolean) {
  const [route, setRoute] = useState<AudioRouteState>({ available: [], current: null });
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const next = await getAudioRoute();
    if (alive.current) setRoute((prev) => (same(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    alive.current = true;
    if (!active) return () => { alive.current = false; };
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => {
      alive.current = false;
      clearInterval(id);
      sub.remove();
    };
  }, [active, refresh]);

  const select = useCallback(async (kind: AudioRouteKind) => {
    setRoute((prev) => ({ ...prev, current: kind })); // instant feedback; the poll confirms it
    await selectAudioRoute(kind);
    // The OS applies the switch asynchronously (Android posts it to its audio thread).
    setTimeout(refresh, 300);
  }, [refresh]);

  return { ...route, select };
}
