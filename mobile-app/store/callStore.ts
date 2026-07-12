import { create } from 'zustand';

/**
 * Issue 8 fix: previously this store only had three booleans
 * (isActive/isIncoming/isOutgoing) with no explicit state machine, no
 * timestamps, and no participant info beyond a bare `callerName` string.
 * That made it impossible to represent (or even receive) RECONNECTING,
 * TIMEOUT, FAILED, etc., and meant every screen had to reconstruct "what's
 * actually happening" from ad-hoc boolean combinations.
 *
 * `status` now mirrors the backend's CallStatusEnum 1:1 so a server
 * `call_state` WebSocket event can be applied directly with no translation
 * layer (which is itself a common source of state-sync bugs).
 */
export type CallStatus =
  | 'IDLE'
  | 'RINGING'       // outgoing: waiting for the other side to answer
  | 'INCOMING'       // incoming: someone is calling me, not yet answered
  | 'ACCEPTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ENDED'
  | 'MISSED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED'
  | 'TIMEOUT';

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'unknown';

export interface ParticipantInfo {
  id: string;
  name: string;
  user_type?: string | null;
  profile_picture?: string | null;
  trimester?: string | null;
  pregnancy_week?: string | null;
  hospital_affiliation?: string | null;
  years_of_experience?: number | null;
}

interface CallState {
  status: CallStatus;
  callId: number | null;
  roomName: string | null;
  roomToken: string | null;
  livekitUrl: string | null;
  // Issue 6 / Issue 7: real participant info (name, trimester, pregnancy
  // week, hospital affiliation, profile picture), replacing the single
  // hardcoded "Mother"/"A Mother" string that used to be all the UI had.
  remoteParticipant: ParticipantInfo | null;
  // Issue 12: surfaced from LiveKit's ConnectionQuality events so the UI
  // can reflect it, instead of nothing ever reading this event.
  connectionQuality: ConnectionQuality;
  // Issue 3: set ONLY from the server's `call_state` CONNECTED event (which
  // itself is only sent once the LiveKit webhook confirms BOTH
  // participants joined - see backend webhook_router.py). Local
  // `room.state === 'connected'` is intentionally NOT used as the timer
  // basis anymore, because that fires as soon as *this device's* signaling
  // connects, independent of whether the other side ever joined.
  connectedAt: number | null;
  // Monotonic guard against a re-delivered/duplicate/out-of-order push or
  // WS message re-opening a call that has already moved on locally
  // (Issue 8, Issue 11: "prevent duplicate events / race conditions").
  lastEventCallId: number | null;
  lastEventStatus: CallStatus | null;

  // Backward-compatible derived flags used by existing screens.
  isActive: boolean;
  isIncoming: boolean;
  isOutgoing: boolean;
  callerName: string | null;

  setIncomingCall: (callId: number, roomName: string, remote: ParticipantInfo | null) => void;
  setOutgoingCall: (callId: number, roomName: string) => void;
  setAccepted: (payload: { roomToken?: string; livekitUrl?: string; remote?: ParticipantInfo | null }) => void;
  setConnecting: (payload: { callId?: number; roomToken?: string; livekitUrl?: string; remote?: ParticipantInfo | null }) => void;
  setConnected: (connectedAtMs?: number) => void;
  setReconnecting: () => void;
  setConnectionQuality: (q: CallState['connectionQuality']) => void;
  setRemoteParticipant: (info: ParticipantInfo) => void;
  endCall: (status?: CallStatus) => void;
  /** Ignore this event if it doesn't apply to the call/state we're currently tracking. */
  isStale: (callId: number) => boolean;
}

const initial = {
  status: 'IDLE' as CallStatus,
  callId: null,
  roomName: null,
  roomToken: null,
  livekitUrl: null,
  remoteParticipant: null,
  connectionQuality: 'unknown' as const,
  connectedAt: null,
  lastEventCallId: null,
  lastEventStatus: null,
  isActive: false,
  isIncoming: false,
  isOutgoing: false,
  callerName: null,
};

export const useCallStore = create<CallState>((set, get) => ({
  ...initial,

  isStale: (callId: number) => {
    const current = get().callId;
    // Once we've moved on to a different (or no) call, ignore late events
    // for the old one instead of letting them resurrect stale UI.
    return current !== null && current !== callId;
  },

  setIncomingCall: (callId, roomName, remote) => set({
    status: 'INCOMING',
    isIncoming: true,
    isOutgoing: false,
    isActive: false,
    callId,
    roomName,
    remoteParticipant: remote,
    callerName: remote?.name ?? null,
    lastEventCallId: callId,
    lastEventStatus: 'INCOMING',
  }),

  setOutgoingCall: (callId, roomName) => set({
    status: 'RINGING',
    isOutgoing: true,
    isIncoming: false,
    callId,
    roomName,
    lastEventCallId: callId,
    lastEventStatus: 'RINGING',
  }),

  setAccepted: ({ roomToken, livekitUrl, remote }) => set((s) => ({
    status: 'ACCEPTED',
    roomToken: roomToken ?? s.roomToken,
    livekitUrl: livekitUrl ?? s.livekitUrl,
    remoteParticipant: remote ?? s.remoteParticipant,
    callerName: remote?.name ?? s.callerName,
    lastEventStatus: 'ACCEPTED',
  })),

  setConnecting: ({ callId, roomToken, livekitUrl, remote }) => set((s) => ({
    status: 'CONNECTING',
    callId: callId ?? s.callId,
    isIncoming: false,
    isOutgoing: false,
    isActive: true, // mounts <LiveKitRoom>; the "Connecting..." UI is shown until status becomes CONNECTED
    roomToken: roomToken ?? s.roomToken,
    livekitUrl: livekitUrl ?? s.livekitUrl,
    remoteParticipant: remote ?? s.remoteParticipant,
    callerName: remote?.name ?? s.callerName,
    lastEventStatus: 'CONNECTING',
  })),

  setConnected: (connectedAtMs) => set((s) => ({
    status: 'CONNECTED',
    isActive: true,
    // Idempotent on purpose: RoomEvent.Reconnected fires setConnected()
    // again after a brief network blip, and we don't want that to reset
    // the timer back to 0 - only the FIRST confirmation sets connectedAt.
    connectedAt: s.connectedAt ?? (connectedAtMs ?? Date.now()),
    lastEventStatus: 'CONNECTED',
  })),

  setReconnecting: () => set({ status: 'RECONNECTING', lastEventStatus: 'RECONNECTING' }),

  setConnectionQuality: (q) => set({ connectionQuality: q }),

  setRemoteParticipant: (info) => set({ remoteParticipant: info, callerName: info.name }),

  endCall: (status = 'ENDED') => set({
    ...initial,
    lastEventStatus: status,
  }),
}));
