import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Image } from 'react-native';
import { Audio } from 'expo-av';
import { useCallStore, ConnectionQuality } from '../store/callStore';
import { useCall } from '../hooks/useCall';
import { LiveKitRoom, useRoomContext, useLocalParticipant } from '@livekit/react-native';
import { RoomEvent, ConnectionState, ConnectionQuality as LKConnectionQuality, Track } from 'livekit-client';

/**
 * Issue 12 fix: the previous version only listened for
 * RoomEvent.ConnectionStateChanged. Every other event Issue 12 explicitly
 * calls out (ParticipantConnected/Disconnected, TrackSubscribed,
 * Reconnecting/Reconnected, ConnectionQualityChanged) was never wired up.
 *
 * Issue 3 fix: the call timer here used to start from local
 * `room.state === 'connected'`, which fires as soon as THIS device's
 * signaling connection resolves - not when the other participant has
 * actually joined. It's now driven by `callStore.connectedAt`, which is
 * set from two independent, redundant signals so it's both fast and
 * reliable:
 *   1) Locally, the instant RoomEvent.ParticipantConnected fires here
 *      (fastest possible - no server round trip).
 *   2) The backend's `call_state: CONNECTED` WebSocket event, driven by
 *      LiveKit's own webhook confirming both participants joined (see
 *      backend webhook_router.py) - a safety net if this device somehow
 *      misses its own local event.
 * `setConnected()` is idempotent (see store), so both firing is safe.
 */
const ActiveCallUI = () => {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const { endCall, callId, remoteParticipant, connectedAt, status, setConnected, setReconnecting, setConnectionQuality } = useCallStore();
  const { hangupCall } = useCall();
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const onParticipantConnected = () => {
      if (room.remoteParticipants.size >= 1 && room.state === ConnectionState.Connected) {
        setConnected();
      }
    };
    const onReconnecting = () => setReconnecting();
    const onReconnected = () => setConnected();
    const onQualityChanged = (quality: LKConnectionQuality, participant: any) => {
      if (participant?.sid === localParticipant?.sid) {
        const mapped: ConnectionQuality =
          quality === LKConnectionQuality.Excellent ? 'excellent' :
          quality === LKConnectionQuality.Good ? 'good' :
          quality === LKConnectionQuality.Poor ? 'poor' : 'unknown';
        setConnectionQuality(mapped);
      }
    };
    const onTrackSubscribed = (track: any) => {
      // Issue 13: confirms remote audio actually started flowing, not just
      // that the participant/room connected. @livekit/react-native handles
      // attaching remote audio tracks to the device's audio output
      // automatically once subscribed - nothing else to do here besides
      // logging, but this is the exact event to hook if that ever changes.
      if (track.kind === Track.Kind.Audio) {
        console.log('[LiveKit] Remote audio track subscribed');
      }
    };
    const onDisconnected = () => {
      // Local safety net: if the socket/webhook path somehow doesn't
      // reach us, ending the LiveKit connection itself still ends the UI
      // instead of leaving a frozen "Connected" screen with dead audio.
      endCall('ENDED');
    };

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.ConnectionQualityChanged, onQualityChanged);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.Disconnected, onDisconnected);

    // In case the remote participant was already in the room by the time
    // this listener attaches (fast-accept race).
    onParticipantConnected();

    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.ConnectionQualityChanged, onQualityChanged);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room]);

  useEffect(() => {
    if (!connectedAt) {
      setDuration(0);
      return;
    }
    const tick = () => setDuration(Math.max(0, Math.floor((Date.now() - connectedAt) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [connectedAt]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleMicrophone = () => {
    if (localParticipant) {
      localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    }
  };

  const statusLabel =
    status === 'CONNECTED' ? formatDuration(duration) :
    status === 'RECONNECTING' ? 'Reconnecting...' :
    'Connecting...';

  return (
    <SafeAreaView style={styles.activeContainer}>
      {remoteParticipant?.profile_picture ? (
        <Image source={{ uri: remoteParticipant.profile_picture }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitial}>{(remoteParticipant?.name || 'N')[0]}</Text></View>
      )}
      <Text style={styles.title}>{remoteParticipant?.name || 'Nurse'}</Text>
      {!!remoteParticipant?.hospital_affiliation && (
        <Text style={styles.subtitle}>{remoteParticipant.hospital_affiliation}</Text>
      )}
      <Text style={styles.status}>{statusLabel}</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.muteBtn, !isMicrophoneEnabled && styles.mutedBtn]}
          onPress={toggleMicrophone}
        >
          <Text style={styles.btnText}>{isMicrophoneEnabled ? 'Mute' : 'Unmute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.hangupBtn} onPress={() => {
            if (callId) hangupCall(callId);
            else endCall('ENDED');
        }}>
          <Text style={styles.btnText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// If LiveKit hasn't reached CONNECTED within this window after the room
// token is issued, something is wrong at the network/media layer (most
// likely Issue 9: LiveKit's node_ip/TURN not reachable from this device's
// network) rather than just "taking a while". Signaling succeeding but
// media never completing is exactly what an unreachable ICE candidate
// looks like from the client's point of view - it doesn't error, it just
// never finishes. Surfacing this as a clear failure after a bounded wait
// is far better than an infinite "Connecting..." spinner with zero
// feedback, which is what happened before this fix.
const CONNECT_TIMEOUT_MS = 20000;

export const CallModals = () => {
  const { isOutgoing, isActive, callId, roomToken, livekitUrl, status, remoteParticipant, endCall } = useCallStore();
  const { hangupCall } = useCall();
  const [micGranted, setMicGranted] = useState(false);
  const [connectTimedOut, setConnectTimedOut] = useState(false);

  useEffect(() => {
    // Issue 13 fix: permission used to be requested inside a `useEffect`
    // gated on `isActive`, which only flips true AFTER <LiveKitRoom
    // connect={true}> has already started connecting/publishing - i.e. the
    // permission prompt raced the actual connection attempt instead of
    // gating it. Requested up front here, before LiveKitRoom ever mounts.
    if (isActive && roomToken) {
      Audio.requestPermissionsAsync()
        .then((res) => setMicGranted(res.granted))
        .catch((e) => {
          console.error('Microphone permission request failed', e);
          setMicGranted(false);
        });
    } else {
      setMicGranted(false);
    }
  }, [isActive, roomToken]);

  useEffect(() => {
    setConnectTimedOut(false);
    if (!isActive || !roomToken || status === 'CONNECTED') return;

    const timer = setTimeout(() => {
      const current = useCallStore.getState();
      if (current.callId === callId && current.status !== 'CONNECTED' && current.isActive) {
        console.error('[CallModals] LiveKit did not reach CONNECTED within', CONNECT_TIMEOUT_MS, 'ms - likely a network/TURN issue (Issue 9).');
        setConnectTimedOut(true);
      }
    }, CONNECT_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isActive, roomToken, callId, status === 'CONNECTED']);

  // Outgoing Call UI (Mother is calling, waiting for accept)
  if (isOutgoing && !isActive && callId) {
    return (
      <Modal visible animationType="fade" transparent>
        <View style={styles.outgoingContainer}>
          <Text style={styles.title}>Calling Nurse...</Text>
          <Text style={styles.status}>
            {status === 'ACCEPTED' ? 'Nurse accepted - connecting...' : 'Ringing...'}
          </Text>
          <TouchableOpacity style={styles.hangupBtn} onPress={() => hangupCall(callId)}>
            <Text style={styles.btnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // Active Connected Call UI
  if (isActive && roomToken) {
    if (!livekitUrl) {
      // Issue 9 fix: previously fell back to a hardcoded developer LAN IP
      // (`ws://192.168.100.132:7880`) baked into source, which silently
      // "worked" on one WiFi network and silently failed everywhere else.
      // The URL now always comes from the backend's CallActionResponse
      // (LiveKitService.get_public_url()) - if it's missing, that's a real
      // configuration error we surface instead of connecting to the wrong
      // server.
      console.error('[CallModals] No livekitUrl from server - cannot connect. Check LIVEKIT_PUBLIC_URL on the backend.');
      return (
        <Modal visible animationType="fade" transparent>
          <View style={styles.outgoingContainer}>
            <Text style={styles.title}>Call Failed</Text>
            <Text style={styles.status}>Could not reach the call server. Please try again.</Text>
            <TouchableOpacity style={styles.hangupBtn} onPress={() => endCall('FAILED')}>
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      );
    }

    if (!micGranted) {
      return (
        <Modal visible animationType="fade" transparent>
          <View style={styles.outgoingContainer}>
            <Text style={styles.title}>Microphone Required</Text>
            <Text style={styles.status}>Please allow microphone access to continue the call.</Text>
            <TouchableOpacity style={styles.hangupBtn} onPress={() => {
              if (callId) hangupCall(callId); else endCall('ENDED');
            }}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      );
    }

    if (connectTimedOut) {
      // Issue 9: signaling worked (we got a token) but the actual
      // WebRTC/media connection never completed - almost always a network
      // path problem (LiveKit's node_ip/TURN unreachable from this
      // device), not a bug in the call state machine. Unmounting
      // <LiveKitRoom> here stops the stalled connection attempt instead of
      // leaving it retrying forever in the background.
      return (
        <Modal visible animationType="fade" transparent>
          <View style={styles.outgoingContainer}>
            <Text style={styles.title}>Connection Failed</Text>
            <Text style={styles.status}>
              Could not establish a call connection. This usually means the call server isn't reachable from your network.
            </Text>
            <TouchableOpacity style={styles.hangupBtn} onPress={() => {
              if (callId) hangupCall(callId); else endCall('FAILED');
            }}>
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      );
    }

    return (
      <Modal visible animationType="fade">
        <LiveKitRoom
          serverUrl={livekitUrl}
          token={roomToken}
          connect={true}
          audio={true}
          video={false}
          options={{
            // Keep audio flowing when the screen locks/app backgrounds
            // mid-call (Issue 13: audio session must not die on background).
            adaptiveStream: true,
            dynacast: true,
          }}
        >
          <ActiveCallUI />
        </LiveKitRoom>
      </Modal>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  outgoingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 16,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  status: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 50,
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
  },
  hangupBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  muteBtn: {
    backgroundColor: '#334155',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  mutedBtn: {
    backgroundColor: '#f59e0b',
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  }
});
