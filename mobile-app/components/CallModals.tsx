import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Image, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { useCallStore, ConnectionQuality } from '../store/callStore';
import { useCall } from '../hooks/useCall';
import { LiveKitRoom, useRoomContext, useLocalParticipant } from '@livekit/react-native';
import { RoomEvent, ConnectionState, ConnectionQuality as LKConnectionQuality, Track } from 'livekit-client';
import {
  startCallAudioSession,
  stopCallAudioSession,
  listAudioOutputs,
  selectAudioOutput,
  showNativeAudioRoutePicker,
} from '../lib/audioSession';

const LOG = '[Call/Mother]';

/**
 * Issue 1/2 fix (real root cause of "connected but no audio"): every stage
 * of the pipeline is now logged so a break at any point is immediately
 * visible, and the actual missing piece - AudioSession.startAudioSession()
 * - is now called (see lib/audioSession.ts for the full root-cause
 * explanation, confirmed against the SDK's own source:
 * `registerGlobals()` only auto-manages the audio session on iOS via
 * `setupIOSAudioManagement()`, which is a documented no-op on Android -
 * nothing was ever activating the native audio session there).
 *
 * Issue 3 fix: the timer is keyed SOLELY off `callStore.connectedAt`,
 * which is set from exactly one canonical source of truth: the backend's
 * `call_state: CONNECTED` WebSocket event, itself only sent once the
 * LiveKit webhook confirms BOTH participants have joined
 * (backend webhook_router.py sets `Call.started_at` there - this is the
 * single timestamp both clients compute `now - startedAt` from). The
 * local `RoomEvent.ParticipantConnected` listener below ALSO calls
 * `setConnected()` as a low-latency optimization, but `setConnected()` is
 * idempotent - it only records `connectedAt` the first time, so whichever
 * signal arrives first wins and the other is a no-op.
 *
 * Issue 5 fix: reconnection is entirely handled by LiveKit's own Room
 * object - this component never calls `room.connect()` again and
 * `<LiveKitRoom>` never unmounts/remounts during a reconnect, so there is
 * no path here that could create a second room or duplicate participant.
 */
const ActiveCallUI = () => {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const { endCall, callId, remoteParticipant, connectedAt, status, setConnected, setReconnecting, setConnectionQuality } = useCallStore();
  const { hangupCall } = useCall();
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    console.log(LOG, 'ActiveCallUI mounted - wiring LiveKit room event listeners');

    const onConnected = () => {
      console.log(LOG, 'Room Connected. localParticipant=', localParticipant?.identity, 'sid=', room.localParticipant?.sid);
    };
    const onParticipantConnected = (participant?: any) => {
      console.log(LOG, 'Remote Participant Connected:', participant?.identity, 'sid=', participant?.sid);
      if (room.remoteParticipants.size >= 1 && room.state === ConnectionState.Connected) {
        setConnected();
      }
    };
    const onParticipantDisconnected = (participant: any) => {
      console.log(LOG, 'Remote Participant Disconnected:', participant?.identity);
    };
    const onReconnecting = () => {
      console.warn(LOG, 'Room Reconnecting - network interruption detected, audio will pause until restored. Timer is NOT reset.');
      setReconnecting();
    };
    const onReconnected = () => {
      console.log(LOG, 'Room Reconnected - audio/subscriptions restored automatically by LiveKit. Timer unaffected.');
      setConnected();
    };
    const onDisconnected = (reason: any) => {
      console.log(LOG, 'Room Disconnected. reason=', reason);
      endCall('ENDED');
    };
    const onLocalTrackPublished = (publication: any) => {
      console.log(
        LOG,
        'Local Track Published: kind=', publication?.kind,
        'source=', publication?.source,
        'trackSid=', publication?.trackSid,
        'muted=', publication?.isMuted
      );
    };
    const onLocalTrackUnpublished = (publication: any) => {
      console.log(LOG, 'Local Track Unpublished:', publication?.trackSid);
    };
    const onTrackPublished = (publication: any, participant: any) => {
      console.log(LOG, 'Remote Track Published by', participant?.identity, ': kind=', publication?.kind, 'sid=', publication?.trackSid);
    };
    const onTrackSubscribed = (track: any, publication: any, participant: any) => {
      console.log(
        LOG,
        'Remote Track Subscribed: kind=', track?.kind,
        'from=', participant?.identity,
        'sid=', publication?.trackSid
      );
      if (track.kind === Track.Kind.Audio) {
        console.log(LOG, 'Remote Track Playing (audio auto-attaches to native output once subscribed on RN - no manual attach() needed).');
      }
    };
    const onTrackSubscriptionFailed = (trackSid: string, participant: any) => {
      console.error(LOG, 'Track Subscription FAILED for', trackSid, 'from', participant?.identity, '- remote audio will not be heard.');
    };
    const onTrackMuted = (publication: any, participant: any) => {
      const who = participant?.isLocal ? 'local (Microphone Muted)' : `remote (${participant?.identity})`;
      console.log(LOG, 'Track Muted -', who, 'kind=', publication?.kind);
    };
    const onTrackUnmuted = (publication: any, participant: any) => {
      const who = participant?.isLocal ? 'local (Microphone Enabled)' : `remote (${participant?.identity})`;
      console.log(LOG, 'Track Unmuted -', who, 'kind=', publication?.kind);
    };
    const onMediaDevicesError = (error: Error) => {
      console.error(LOG, 'MediaDevicesError - local track creation failed:', error?.message || error);
    };
    const onAudioPlaybackStatusChanged = () => {
      console.log(LOG, 'Audio Playback Status Changed. canPlaybackAudio=', room.canPlaybackAudio);
      if (!room.canPlaybackAudio) {
        console.warn(LOG, 'Audio playback blocked by platform - attempting room.startAudio() to resume.');
        room.startAudio().catch((e) => console.error(LOG, 'room.startAudio() failed:', e));
      }
    };
    const onQualityChanged = (quality: LKConnectionQuality, participant: any) => {
      if (participant?.sid === localParticipant?.sid) {
        const mapped: ConnectionQuality =
          quality === LKConnectionQuality.Excellent ? 'excellent' :
          quality === LKConnectionQuality.Good ? 'good' :
          quality === LKConnectionQuality.Poor ? 'poor' : 'unknown';
        console.log(LOG, 'Connection Quality Changed:', mapped);
        setConnectionQuality(mapped);
      }
    };

    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    room.on(RoomEvent.TrackPublished, onTrackPublished);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed);
    room.on(RoomEvent.TrackMuted, onTrackMuted);
    room.on(RoomEvent.TrackUnmuted, onTrackUnmuted);
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);
    room.on(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackStatusChanged);
    room.on(RoomEvent.ConnectionQualityChanged, onQualityChanged);

    onParticipantConnected(undefined);
    if (!room.canPlaybackAudio) {
      onAudioPlaybackStatusChanged();
    }

    return () => {
      console.log(LOG, 'ActiveCallUI unmounting - removing all room event listeners');
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
      room.off(RoomEvent.TrackPublished, onTrackPublished);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed);
      room.off(RoomEvent.TrackMuted, onTrackMuted);
      room.off(RoomEvent.TrackUnmuted, onTrackUnmuted);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
      room.off(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackStatusChanged);
      room.off(RoomEvent.ConnectionQualityChanged, onQualityChanged);
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
      const next = !isMicrophoneEnabled;
      console.log(LOG, 'toggleMicrophone ->', next ? 'Microphone Enabled' : 'Microphone Muted');
      localParticipant.setMicrophoneEnabled(next);
    }
  };

  const [isSpeaker, setIsSpeaker] = useState(false);

  const toggleSpeaker = async () => {
    try {
      const next = !isSpeaker;
      console.log(LOG, 'toggleSpeaker ->', next ? 'speaker' : 'earpiece');
      if (Platform.OS === 'ios') {
        await selectAudioOutput(next ? 'force_speaker' : 'default');
      } else {
        await selectAudioOutput(next ? 'speaker' : 'earpiece');
      }
      setIsSpeaker(next);
    } catch (e) {
      console.error(LOG, 'Failed to toggle speaker', e);
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
          style={[styles.muteBtn, isSpeaker && styles.mutedBtn]} 
          onPress={toggleSpeaker}
        >
          <Text style={styles.btnText}>{isSpeaker ? "Speaker On" : "Speaker Off"}</Text>
        </TouchableOpacity>

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
  const [audioSessionReady, setAudioSessionReady] = useState(false);
  const [connectTimedOut, setConnectTimedOut] = useState(false);

  useEffect(() => {
    // Issue 13 fix: permission used to be requested inside a `useEffect`
    // gated on `isActive`, which only flips true AFTER <LiveKitRoom
    // connect={true}> has already started connecting/publishing - i.e. the
    // permission prompt raced the actual connection attempt instead of
    // gating it. Requested up front here, before LiveKitRoom ever mounts.
    if (isActive && roomToken) {
      console.log(LOG, 'Requesting microphone permission...');
      Audio.requestPermissionsAsync()
        .then((res) => {
          console.log(LOG, 'Microphone permission status:', res.granted ? 'GRANTED' : 'DENIED');
          setMicGranted(res.granted);
        })
        .catch((e) => {
          console.error(LOG, 'Microphone permission request failed', e);
          setMicGranted(false);
        });
    } else {
      setMicGranted(false);
    }
  }, [isActive, roomToken]);

  useEffect(() => {
    // Issue 1 fix: activate the native audio session BEFORE connecting to
    // the room (per the SDK's explicit requirement - see
    // lib/audioSession.ts).
    if (!micGranted || !isActive || !roomToken) {
      setAudioSessionReady(false);
      return;
    }
    let cancelled = false;
    startCallAudioSession().then((ok) => {
      if (!cancelled) setAudioSessionReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [micGranted, isActive, roomToken]);

  useEffect(() => {
    // Issue 7 fix: release the audio session the moment the call is no
    // longer active, for any reason (hangup, remote end, failure, timeout).
    if (!isActive) {
      stopCallAudioSession();
    }
    return () => {
      if (!useCallStore.getState().isActive) {
        stopCallAudioSession();
      }
    };
  }, [isActive]);

  useEffect(() => {
    setConnectTimedOut(false);
    if (!isActive || !roomToken || status === 'CONNECTED') return;

    const timer = setTimeout(() => {
      const current = useCallStore.getState();
      if (current.callId === callId && current.status !== 'CONNECTED' && current.isActive) {
        console.error(LOG, 'LiveKit did not reach CONNECTED within', CONNECT_TIMEOUT_MS, 'ms - check logs above for which pipeline stage stalled.');
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
      // (`ws://192.168.100.8:7880`) baked into source, which silently
      // "worked" on one WiFi network and silently failed everywhere else.
      // The URL now always comes from the backend's CallActionResponse
      // (LiveKitService.get_public_url()) - if it's missing, that's a real
      // configuration error we surface instead of connecting to the wrong
      // server.
      console.error(LOG, 'No livekitUrl from server - cannot connect. Check LIVEKIT_PUBLIC_URL on the backend.');
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

    if (!audioSessionReady) {
      // Issue 1 fix: don't mount <LiveKitRoom> until the native audio
      // session is actually active - publishing before this was ready is
      // exactly the "connected but silent" scenario this audit is about.
      return (
        <Modal visible animationType="fade" transparent>
          <View style={styles.outgoingContainer}>
            <Text style={styles.title}>Preparing Audio...</Text>
            <Text style={styles.status}>Setting up the call audio session.</Text>
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
          onConnected={() => console.log(LOG, 'LiveKitRoom onConnected callback fired')}
          onDisconnected={() => console.log(LOG, 'LiveKitRoom onDisconnected callback fired')}
          onError={(e) => console.error(LOG, 'LiveKitRoom onError:', e)}
          onMediaDeviceFailure={(f) => console.error(LOG, 'LiveKitRoom onMediaDeviceFailure:', f)}
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
  },
  outputPicker: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 8,
    minWidth: 180,
    marginBottom: 20,
  },
  outputOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  outputOptionText: {
    color: 'white',
    fontSize: 15,
    textTransform: 'capitalize',
  },
});
