import { useEffect } from 'react';
import { useRoomContext } from '@livekit/react-native';
import {
  ConnectionQuality as LKConnectionQuality,
  ConnectionState,
  DisconnectReason,
  Participant,
  RoomEvent,
  Track,
} from 'livekit-client';
import { useCallStore, ConnectionQuality } from '../store/callStore';
import { setActiveRoom } from '../lib/activeRoom';
import { startCallForegroundService } from '../lib/callForegroundService';
import { getMicrophonePermissionStatus, requestMicrophonePermission } from '../lib/permissions';
import { reportCallProblem, reportDisconnect } from '../lib/callReport';

/**
 * Everything a live call needs while its <LiveKitRoom> is mounted - connection state, reconnects,
 * quality, the microphone, the foreground service. Mounted ONCE per call, beside the call screen
 * rather than inside it, so minimising / restoring the screen or showing the call inline (mother:
 * the ride card) never re-registers listeners or touches the connection.
 *
 * The room connects with `audio={false}` and the microphone is turned on here, once, when the signal
 * connection is up and only if the OS permission is granted. So:
 *  - no permission never fails the connection (they join muted and can enable it later);
 *  - a full reconnect does not silently un-mute someone who muted themselves;
 *  - the mic is published as soon as the room allows it.
 *
 * Same file in mobile-app and loni-server-app.
 */
export function useCallRoomLifecycle() {
  const room = useRoomContext();

  useEffect(() => {
    setActiveRoom(room);
    return () => setActiveRoom(null);
  }, [room]);

  useEffect(() => {
    const store = () => useCallStore.getState();
    let micInitialised = false;

    const syncMic = () => store().setMicMuted(!room.localParticipant.isMicrophoneEnabled);

    const initMicrophone = async () => {
      if (micInitialised) return;
      micInitialised = true;
      let status = await getMicrophonePermissionStatus().catch(() => 'denied' as const);
      // Answered from a notification before the app ever asked: ask now, once.
      if (status === 'undetermined') status = await requestMicrophonePermission().catch(() => 'denied' as const);
      if (status === 'granted') {
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
        } catch (e) {
          reportCallProblem(store().callId, 'mic_enable_failed', e);
        }
      }
      syncMic();
    };

    const markConnectedIfBothIn = () => {
      if (room.remoteParticipants.size >= 1 && room.state === ConnectionState.Connected) store().setConnected();
    };
    const onConnected = () => {
      initMicrophone();
      markConnectedIfBothIn();
    };
    // The other person dropped out of the room: show it straight away rather than waiting for the
    // server's RECONNECTING (which never arrives if our WebSocket is down).
    const onParticipantDisconnected = () => {
      if (room.remoteParticipants.size === 0 && store().status === 'CONNECTED') store().setReconnecting();
    };
    const onReconnecting = () => store().setReconnecting();
    const onReconnected = () => {
      syncMic();
      markConnectedIfBothIn();
    };
    const onDisconnected = (reason?: DisconnectReason) => {
      reportDisconnect(store().callId, reason);
      store().endCall('ENDED');
    };
    const onMediaDevicesError = (e: Error) => reportCallProblem(store().callId, 'media_devices_error', e);
    const onAudioPlaybackStatusChanged = () => {
      if (!room.canPlaybackAudio) room.startAudio().catch(() => {});
    };
    const onQualityChanged = (quality: LKConnectionQuality, participant: Participant) => {
      if (participant.sid !== room.localParticipant.sid) return;
      const mapped: ConnectionQuality =
        quality === LKConnectionQuality.Excellent ? 'excellent' :
        quality === LKConnectionQuality.Good ? 'good' :
        quality === LKConnectionQuality.Unknown ? 'unknown' : 'poor';
      if (store().connectionQuality !== mapped) store().setConnectionQuality(mapped);
    };
    const onLocalTrackChanged = (pub: { source?: Track.Source }) => {
      if (!pub?.source || pub.source === Track.Source.Microphone) syncMic();
    };
    const onMuteChanged = (pub: { source?: Track.Source }, participant: Participant) => {
      if (participant.sid === room.localParticipant.sid) onLocalTrackChanged(pub);
    };

    room.on(RoomEvent.SignalConnected, initMicrophone);
    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.ParticipantConnected, markConnectedIfBothIn);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);
    room.on(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackStatusChanged);
    room.on(RoomEvent.ConnectionQualityChanged, onQualityChanged);
    room.on(RoomEvent.LocalTrackPublished, onLocalTrackChanged);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalTrackChanged);
    room.on(RoomEvent.TrackMuted, onMuteChanged);
    room.on(RoomEvent.TrackUnmuted, onMuteChanged);

    if (room.state === ConnectionState.Connected) onConnected();
    if (!room.canPlaybackAudio) onAudioPlaybackStatusChanged();

    // Belt and braces for the call timer, in case the SDK fired its events before we listened.
    const poll = setInterval(() => {
      if (store().connectedAt) clearInterval(poll);
      else markConnectedIfBothIn();
    }, 500);

    return () => {
      clearInterval(poll);
      room.off(RoomEvent.SignalConnected, initMicrophone);
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.ParticipantConnected, markConnectedIfBothIn);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
      room.off(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackStatusChanged);
      room.off(RoomEvent.ConnectionQualityChanged, onQualityChanged);
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackChanged);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalTrackChanged);
      room.off(RoomEvent.TrackMuted, onMuteChanged);
      room.off(RoomEvent.TrackUnmuted, onMuteChanged);
    };
  }, [room]);

  // Fallback start of the Android foreground service, for a call answered from a notification.
  // Normally useCall started it already, while the app was certainly in the foreground. It is
  // stopped by CallModals when the call is over - never on unmount or on a reconnect.
  useEffect(() => {
    getMicrophonePermissionStatus().then((s) => {
      if (s === 'granted') startCallForegroundService('LONI call', 'Tap to return to your call');
    }).catch(() => {});
  }, []);
}

/** Headless: mounts the lifecycle with no UI. */
export function CallRoomLifecycle() {
  useCallRoomLifecycle();
  return null;
}
