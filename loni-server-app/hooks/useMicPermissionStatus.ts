import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { PermissionStatus, getMicrophonePermissionStatus } from '../lib/permissions';
import { useMicGate } from '../lib/micPermission';

/** The microphone permission, re-read whenever the app comes back to the foreground (e.g. from
 * Settings) and whenever the permission sheet changes it. Never prompts. */
export function useMicPermissionStatus(): PermissionStatus | null {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const gateStatus = useMicGate((s) => s.status);
  const gateOpen = useMicGate((s) => s.open);
  useEffect(() => {
    let alive = true;
    const check = () => getMicrophonePermissionStatus().then((s) => { if (alive) setStatus(s); }).catch(() => {});
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => { alive = false; sub.remove(); };
  }, [gateStatus, gateOpen]);
  return status;
}
