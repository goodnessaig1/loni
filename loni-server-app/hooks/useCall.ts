import { useCallback } from 'react';
import { useCallStore } from '../store/callStore';
import { apiClient } from '../api/client';

export const useCall = () => {
  const { 
    isActive, isIncoming, isOutgoing, 
    callerName, callId, roomName, 
    setOutgoingCall, setCallConnected, endCall 
  } = useCallStore();

  const requestCall = useCallback(async (nurseId?: string) => {
    try {
      const response = await apiClient.post('/calls/request', { nurse_id: nurseId });
      const call = response.data;
      setOutgoingCall(call.id, call.room_name);
      return call;
    } catch (error) {
      console.error("Failed to request call", error);
      throw error;
    }
  }, [setOutgoingCall]);

  const acceptCall = useCallback(async (incomingCallId: number) => {
    try {
      const response = await apiClient.post(`/calls/${incomingCallId}/accept`);
      setCallConnected(response.data.token);
      return response.data;
    } catch (error) {
      console.error("Failed to accept call", error);
      endCall();
      throw error;
    }
  }, [setCallConnected, endCall]);

  const joinCall = useCallback(async (existingCallId: number) => {
    try {
      const response = await apiClient.post(`/calls/${existingCallId}/join`);
      setCallConnected(response.data.token);
      return response.data;
    } catch (error) {
      console.error("Failed to join call", error);
      endCall();
      throw error;
    }
  }, [setCallConnected, endCall]);

  const rejectCall = useCallback(async (incomingCallId: number) => {
    try {
      await apiClient.post(`/calls/${incomingCallId}/reject`);
    } catch (error) {
      console.error("Failed to reject call", error);
    } finally {
      endCall();
    }
  }, [endCall]);

  const hangupCall = useCallback(async (activeCallId: number) => {
    try {
      await apiClient.post(`/calls/${activeCallId}/end`);
    } catch (error) {
      console.error("Failed to end call", error);
    } finally {
      endCall();
    }
  }, [endCall]);

  return {
    isActive,
    isIncoming,
    isOutgoing,
    callerName,
    callId,
    roomName,
    requestCall,
    acceptCall,
    joinCall,
    rejectCall,
    hangupCall
  };
};
