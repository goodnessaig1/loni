import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCallStore, ParticipantInfo } from '../store/callStore';
import { apiClient } from '../api/client';
import { ensureMicrophoneForCall, MicDecision } from '../lib/micPermission';
import { startCallForegroundService, stopCallForegroundService } from '../lib/callForegroundService';

/**
 * Settle the microphone BEFORE the call is placed or answered (not after the other side picks up,
 * which left them talking to silence behind a permission dialog): the OS prompt if it can still be
 * shown, otherwise an explanation with "Allow" / "Open Settings" / go on muted / cancel
 * (lib/micPermission.ts). With the microphone allowed, start the Android call foreground service
 * now, while the app is certainly in the foreground (Android 12+ refuses to start one from the
 * background; type "microphone" needs the permission granted).
 */
async function prepareForCall(purpose: 'call' | 'answer'): Promise<MicDecision> {
  const decision = await ensureMicrophoneForCall(purpose);
  if (decision === 'granted') {
    await startCallForegroundService('LONI call', 'Tap to return to your call').catch(() => {});
  }
  return decision;
}

/** The call never got going (refused, no nurse, already taken): don't leave the service running. */
function releaseIfNoCall(): void {
  const s = useCallStore.getState();
  if (!s.isActive && !s.isOutgoing) stopCallForegroundService();
}
import { startOutgoingCall, reportCallEnded } from '../lib/callKeepService';

function toParticipant(raw: any) {
  if (!raw) return null;
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? 'Unknown',
    user_type: raw.user_type ?? null,
    profile_picture: raw.profile_picture ?? null,
    trimester: raw.trimester ?? null,
    pregnancy_week: raw.pregnancy_week ?? null,
    hospital_affiliation: raw.hospital_affiliation ?? null,
    years_of_experience: raw.years_of_experience ?? null,
  };
}

export const useCall = () => {
  // Only these fields re-render the caller (not connection quality, mic state, timers...).
  const { isActive, isIncoming, isOutgoing, status, callerName, callId, roomName, remoteParticipant } = useCallStore(
    useShallow((s) => ({
      isActive: s.isActive, isIncoming: s.isIncoming, isOutgoing: s.isOutgoing, status: s.status,
      callerName: s.callerName, callId: s.callId, roomName: s.roomName, remoteParticipant: s.remoteParticipant,
    })),
  );
  const setOutgoingCall = useCallStore((s) => s.setOutgoingCall);
  const setConnecting = useCallStore((s) => s.setConnecting);
  const endCall = useCallStore((s) => s.endCall);

  /**
   * Start a call. No options rings every online nurse; `nurseId` rings one nurse;
   * `rideId` calls the other party of her active emergency ride (her driver).
   */
  const requestCall = useCallback(async (opts: { nurseId?: string; rideId?: number; remote?: ParticipantInfo | null } = {}) => {
    // One call at a time: a second tap while ringing must not start another call.
    if (useCallStore.getState().status !== 'IDLE') return null;
    try {
      if ((await prepareForCall('call')) === 'cancelled') return null;
      if (useCallStore.getState().status !== 'IDLE') return null; // a call arrived meanwhile
      const response = await apiClient.post('/calls/request', { nurse_id: opts.nurseId, ride_id: opts.rideId });
      const call = response.data;
      // Someone called her in the second her own call was being placed: hers wins, theirs is
      // declined (so their phone stops ringing at once) instead of the two screens colliding.
      const crossed = useCallStore.getState();
      if (crossed.status === 'INCOMING' && crossed.callId != null && crossed.callId !== call.id) {
        apiClient.post(`/calls/${crossed.callId}/reject`).catch(() => { /* it times out server-side */ });
        crossed.endCall('REJECTED');
      }
      setOutgoingCall(call.id, call.room_name, { kind: call.kind ?? 'nurse', rideId: call.ride_id ?? null }, opts.remote ?? null);
      // Native outgoing-call UI (Issue 5): on iOS this gives a real
      // system ringback tone via CallKit for free - no bundled audio file
      // needed there anymore (see app/nurse/connecting.tsx, which now
      // skips its bundled ringback specifically on iOS).
      try { startOutgoingCall(call.id, opts.remote?.name || (call.kind === 'ride' ? 'Driver' : 'Nurse')); } catch { /* CallKeep unavailable - in-app UI still works */ }
      return call;
    } catch (error) {
      console.error('Failed to request call', error);
      releaseIfNoCall();
      throw error;
    }
  }, [setOutgoingCall]);

  const acceptCall = useCallback(async (incomingCallId: number) => {
    try {
      // Cancelled: leave it ringing - they can still answer or decline.
      if ((await prepareForCall('answer')) === 'cancelled') return null;
      if (useCallStore.getState().callId !== incomingCallId) return null; // the caller hung up meanwhile
      const response = await apiClient.post(`/calls/${incomingCallId}/accept`);
      setConnecting({
        callId: incomingCallId,
        roomToken: response.data.token,
        livekitUrl: response.data.livekit_url,
        remote: toParticipant(response.data.participant),
      });
      return response.data;
    } catch (error) {
      console.error('Failed to accept call', error);
      releaseIfNoCall();
      endCall('FAILED');
      throw error;
    }
  }, [setConnecting, endCall]);

  const joinCall = useCallback(async (existingCallId: number) => {
    try {
      const response = await apiClient.post(`/calls/${existingCallId}/join`);
      setConnecting({
        callId: existingCallId,
        roomToken: response.data.token,
        livekitUrl: response.data.livekit_url,
        remote: toParticipant(response.data.participant),
      });
      return response.data;
    } catch (error) {
      console.error('Failed to join call', error);
      endCall('FAILED');
      throw error;
    }
  }, [setConnecting, endCall]);

  const rejectCall = useCallback(async (incomingCallId: number) => {
    try {
      await apiClient.post(`/calls/${incomingCallId}/reject`);
    } catch (error) {
      console.error('Failed to reject call', error);
    } finally {
      endCall('REJECTED');
    }
  }, [endCall]);

  const hangupCall = useCallback(async (activeCallId: number) => {
    try {
      await apiClient.post(`/calls/${activeCallId}/end`);
    } catch (error) {
      console.error('Failed to end call', error);
    } finally {
      endCall('ENDED');
      // Hung up from the in-app button rather than the native call UI -
      // still need to tell CallKeep so the native UI/Recents entry closes.
      try { reportCallEnded(activeCallId); } catch { /* non-fatal */ }
    }
  }, [endCall]);

  return {
    isActive,
    isIncoming,
    isOutgoing,
    status,
    callerName,
    callId,
    roomName,
    remoteParticipant,
    requestCall,
    acceptCall,
    joinCall,
    rejectCall,
    hangupCall,
  };
};
