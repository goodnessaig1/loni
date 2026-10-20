import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useCallStore, ParticipantInfo } from '../store/callStore';
import { apiClient } from '../api/client';

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
  const {
    isActive, isIncoming, isOutgoing, status,
    callerName, callId, roomName, remoteParticipant,
    setOutgoingCall, setConnecting, endCall, removeIncomingCall,
  } = useCallStore();

  /** Drivers call the passenger of their active ride with `rideId`; the server picks the other party. */
  const requestCall = useCallback(async (opts: { rideId?: number; remote?: ParticipantInfo | null } = {}) => {
    if (useCallStore.getState().status !== 'IDLE') return null;
    try {
      const response = await apiClient.post('/calls/request', { ride_id: opts.rideId });
      const call = response.data;
      setOutgoingCall(call.id, call.room_name, { kind: call.kind ?? 'ride', rideId: call.ride_id ?? null }, opts.remote ?? null);
      return call;
    } catch (error) {
      console.error('Failed to request call', error);
      throw error;
    }
  }, [setOutgoingCall]);

  const acceptCall = useCallback(async (incomingCallId: number) => {
    try {
      const response = await apiClient.post(`/calls/${incomingCallId}/accept`);
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
