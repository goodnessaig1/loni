import type { Room } from 'livekit-client';
import { useCallStore } from '../store/callStore';

/**
 * The LiveKit room of the call in progress, for UI that lives outside <LiveKitRoom>
 * (the emergency-ride card shows the call inline and needs a mute button).
 */
let activeRoom: Room | null = null;

export function setActiveRoom(room: Room | null) {
  activeRoom = room;
  useCallStore.getState().setMicMuted(room ? !room.localParticipant.isMicrophoneEnabled : false);
}

export async function toggleMicrophone() {
  if (!activeRoom) return;
  const lp = activeRoom.localParticipant;
  const next = !lp.isMicrophoneEnabled;
  await lp.setMicrophoneEnabled(next);
  useCallStore.getState().setMicMuted(!next);
}
