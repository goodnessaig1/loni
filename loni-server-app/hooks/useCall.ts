import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Alert } from 'react-native';
import { useCallStore, ParticipantInfo } from '../store/callStore';
import { apiClient } from '../api/client';
import { answering } from '../lib/callEvents';
import { ensureMicrophoneForCall, MicDecision } from '../lib/micPermission';
import { startCallForegroundService, stopCallForegroundService } from '../lib/callForegroundService';

/**
 * Settle the microphone BEFORE the call is placed or answered: the OS prompt if it can still be
 * shown, otherwise an explanation with "Allow" / "Open Settings" / go on muted / cancel
 * (lib/micPermission.ts). With it allowed, start the Android call foreground service now, while the
 * app is certainly in the foreground (type "microphone" needs the permission granted).
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
  const removeIncomingCall = useCallStore((s) => s.removeIncomingCall);

  /** Drivers call the passenger of their active ride with `rideId`; the server picks the other party. */
  const requestCall = useCallback(async (opts: { rideId?: number; remote?: ParticipantInfo | null } = {}) => {
    if (useCallStore.getState().status !== 'IDLE') return null;
    try {
      if ((await prepareForCall('call')) === 'cancelled') return null;
      if (useCallStore.getState().status !== 'IDLE') return null; // a call arrived meanwhile
      const response = await apiClient.post('/calls/request', { ride_id: opts.rideId });
      const call = response.data;
      setOutgoingCall(call.id, call.room_name, { kind: call.kind ?? 'ride', rideId: call.ride_id ?? null }, opts.remote ?? null);
      return call;
    } catch (error) {
      console.error('Failed to request call', error);
      releaseIfNoCall();
      throw error;
    }
  }, [setOutgoingCall]);

  const acceptCall = useCallback(async (incomingCallId: number) => {
    try {
      // Cancelled: leave the request waiting - it can still be answered or declined.
      if ((await prepareForCall('answer')) === 'cancelled') return null;
      answering.add(incomingCallId);
      const response = await apiClient.post(`/calls/${incomingCallId}/accept`).finally(() => answering.delete(incomingCallId));
      setConnecting({
        callId: incomingCallId,
        roomToken: response.data.token,
        livekitUrl: response.data.livekit_url,
        remote: toParticipant(response.data.participant),
      });
      // Once accepted, we can remove it from incoming requests list if we want, 
      // but the state moves to CONNECTING anyway. We should clear it.
      removeIncomingCall(incomingCallId);
      return response.data;
    } catch (error: any) {
      console.error('Failed to accept call', error);
      releaseIfNoCall();
      removeIncomingCall(incomingCallId);
      Alert.alert(
        'Call Unavailable',
        'This request may have been cancelled or accepted by another nurse.',
        [{ text: 'OK' }]
      );
      // Wait, if we throw, caller handles it. But we should also endCall if it was the ONLY active call.
      // But endCall clears everything. If we had other incoming requests, we don't want to end everything.
      // removeIncomingCall handles switching to next or IDLE.
      throw error;
    }
  }, [setConnecting, removeIncomingCall]);

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
      removeIncomingCall(incomingCallId);
    }
  }, [removeIncomingCall]);

  const hangupCall = useCallback(async (activeCallId: number) => {
    try {
      await apiClient.post(`/calls/${activeCallId}/end`);
    } catch (error) {
      console.error('Failed to end call', error);
    } finally {
      endCall('ENDED');
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
