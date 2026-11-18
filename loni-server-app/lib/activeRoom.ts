import type { Room } from 'livekit-client';
import { useCallStore } from '../store/callStore';
import { getMicrophonePermissionStatus } from './permissions';
import { ensureMicrophoneForCall } from './micPermission';
import { startCallForegroundService } from './callForegroundService';
import { reportCallProblem } from './callReport';

/**
 * The LiveKit room of the call in progress, for UI that lives outside <LiveKitRoom> or does not want
 * to subscribe to it (the call controls, the floating widget, the mother app's ride card).
 *
 * Same file in mobile-app and loni-server-app.
 */
let activeRoom: Room | null = null;

export function setActiveRoom(room: Room | null) {
  activeRoom = room;
  if (!room) useCallStore.getState().setMicMuted(false);
}

/**
 * Mute / unmute. Unmuting without the OS permission goes through the permission sheet first
 * (ask again, or Settings) instead of failing silently.
 */
export async function toggleMicrophone(): Promise<void> {
  const room = activeRoom;
  if (!room) return;
  const lp = room.localParticipant;
  const enable = !lp.isMicrophoneEnabled;
  if (enable) {
    const status = await getMicrophonePermissionStatus().catch(() => 'denied' as const);
    if (status !== 'granted') {
      if ((await ensureMicrophoneForCall('unmute')) !== 'granted') return;
      // Allowed mid-call: the Android call service (type microphone) can run now.
      startCallForegroundService('LONI call', 'Tap to return to your call');
    }
  }
  try {
    await lp.setMicrophoneEnabled(enable);
  } catch (e) {
    reportCallProblem(useCallStore.getState().callId, 'mic_toggle_failed', e);
  }
  if (activeRoom === room) useCallStore.getState().setMicMuted(!lp.isMicrophoneEnabled);
}
