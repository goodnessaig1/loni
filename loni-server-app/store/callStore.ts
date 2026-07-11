import { create } from 'zustand';

interface CallState {
  isActive: boolean;
  isIncoming: boolean;
  isOutgoing: boolean;
  callerName: string | null;
  callerId: string | null;
  callId: number | null;
  roomName: string | null;
  roomToken: string | null;
  startTime: Date | null;
  
  setIncomingCall: (callId: number, callerName: string, roomName: string) => void;
  setOutgoingCall: (callId: number, roomName: string) => void;
  setCallConnected: (token: string) => void;
  endCall: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  isActive: false,
  isIncoming: false,
  isOutgoing: false,
  callerName: null,
  callerId: null,
  callId: null,
  roomName: null,
  roomToken: null,
  startTime: null,

  setIncomingCall: (callId, callerName, roomName) => set({
    isIncoming: true,
    callerName,
    callId,
    roomName,
  }),

  setOutgoingCall: (callId, roomName) => set({
    isOutgoing: true,
    callId,
    roomName,
  }),

  setCallConnected: (token) => set({
    isActive: true,
    isIncoming: false,
    isOutgoing: false,
    roomToken: token,
    startTime: new Date(),
  }),

  endCall: () => set({
    isActive: false,
    isIncoming: false,
    isOutgoing: false,
    callerName: null,
    callerId: null,
    callId: null,
    roomName: null,
    roomToken: null,
    startTime: null,
  }),
}));
