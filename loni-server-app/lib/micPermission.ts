import { create } from 'zustand';
import { PermissionStatus, getMicrophonePermissionStatus, requestMicrophonePermission } from './permissions';

/**
 * The microphone permission step of placing or answering a call. Same file in both apps.
 *
 *  - granted                 -> go straight on.
 *  - undetermined            -> the OS prompt (requestMicrophonePermission only prompts when it can).
 *  - denied, can ask again   -> explain, and offer to ask again (Android: denied once).
 *  - blocked                 -> explain, and offer Open Settings (iOS after any "Don't Allow";
 *                              Android after "Don't ask again" or a second denial). Coming back to
 *                              the app re-checks (MicPermissionSheet listens to AppState).
 *
 * The person can always go on WITHOUT the microphone (they join muted and can turn it on from the
 * call screen once allowed) or cancel. A missing permission never ends a call by itself.
 *
 * The prompt is never re-shown in a loop: the OS prompt runs once per tap, and only when the OS
 * still allows it.
 */

export type MicDecision = 'granted' | 'muted' | 'cancelled';

interface MicGateState {
  open: boolean;
  status: PermissionStatus;
  /** What the person is about to do, for the sheet's wording. */
  purpose: 'call' | 'answer' | 'unmute';
  resolver: ((d: MicDecision) => void) | null;
  setStatus: (s: PermissionStatus) => void;
  finish: (d: MicDecision) => void;
}

export const useMicGate = create<MicGateState>((set, get) => ({
  open: false,
  status: 'undetermined',
  purpose: 'call',
  resolver: null,
  setStatus: (status) => set({ status }),
  finish: (d) => {
    const r = get().resolver;
    set({ open: false, resolver: null });
    r?.(d);
  },
}));

/**
 * Make sure the microphone can be used for a call, asking the OS and then the person as needed.
 * Resolves once a decision is made; never throws.
 */
export async function ensureMicrophoneForCall(purpose: MicGateState['purpose'] = 'call'): Promise<MicDecision> {
  let status: PermissionStatus;
  try {
    status = await requestMicrophonePermission();
  } catch {
    status = await getMicrophonePermissionStatus().catch((): PermissionStatus => 'denied');
  }
  if (status === 'granted') return 'granted';

  // A previous sheet still open (double tap): settle it before showing a new one.
  useMicGate.getState().finish('cancelled');
  return new Promise<MicDecision>((resolve) => {
    useMicGate.setState({ open: true, status, purpose, resolver: resolve });
  });
}

/** Ask again from the sheet. Only prompts when the OS still allows a prompt. */
export async function retryMicrophonePermission(): Promise<PermissionStatus> {
  const status = await requestMicrophonePermission().catch((): PermissionStatus => 'denied');
  useMicGate.getState().setStatus(status);
  if (status === 'granted') useMicGate.getState().finish('granted');
  return status;
}

/** Re-check without prompting (back from Settings). */
export async function recheckMicrophonePermission(): Promise<PermissionStatus> {
  const status = await getMicrophonePermissionStatus().catch((): PermissionStatus => 'denied');
  useMicGate.getState().setStatus(status);
  if (status === 'granted') useMicGate.getState().finish('granted');
  return status;
}
