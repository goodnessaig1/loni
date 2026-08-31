import { useCallback } from 'react';
import { useCallStore } from '../store/callStore';
import { apiClient } from '../api/client';
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
  const {
    isActive, isIncoming, isOutgoing, status,
    callerName, callId, roomName, remoteParticipant,
    setOutgoingCall, setConnecting, endCall,
  } = useCallStore();

  const requestCall = useCallback(async (nurseId?: string) => {
    try {
      const response = await apiClient.post('/calls/request', { nurse_id: nurseId });
      const call = response.data;
      setOutgoingCall(call.id, call.room_name);
      // Native outgoing-call UI (Issue 5): on iOS this gives a real
      // system ringback tone via CallKit for free - no bundled audio file
      // needed there anymore (see app/nurse/connecting.tsx, which now
      // skips its bundled ringback specifically on iOS).
      try { startOutgoingCall(call.id, 'Nurse'); } catch { /* CallKeep unavailable - in-app UI still works */ }
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
      return response.data;
    } catch (error) {
      console.error('Failed to accept call', error);
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
