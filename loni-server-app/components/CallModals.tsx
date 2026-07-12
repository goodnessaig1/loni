import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Dimensions, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { useCallStore, ConnectionQuality } from '../store/callStore';
import { useCall } from '../hooks/useCall';
import { LiveKitRoom, useRoomContext, useLocalParticipant } from '@livekit/react-native';
import { RoomEvent, ConnectionState, ConnectionQuality as LKConnectionQuality, Track } from 'livekit-client';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import {
  startCallAudioSession,
  stopCallAudioSession,
  listAudioOutputs,
  selectAudioOutput,
  showNativeAudioRoutePicker,
} from '../lib/audioSession';

const { width, height } = Dimensions.get('window');
const LOG = '[Call/Nurse]';

/**
 * Issue 1/2 fix (real root cause of "connected but no audio"): every stage
 * of the pipeline is now logged so a break at any point is immediately
 * visible, and the actual missing piece - AudioSession.startAudioSession()
 * - is now called (see lib/audioSession.ts for the full root-cause
 * explanation, confirmed against the SDK's own source).
 *
 * Issue 3 fix: the timer is keyed SOLELY off `callStore.connectedAt`,
 * which is set from exactly one canonical source of truth: the backend's
 * `call_state: CONNECTED` WebSocket event, itself only sent once the
 * LiveKit webhook confirms BOTH participants have joined
 * (backend webhook_router.py sets `Call.started_at` there - this is the
 * single timestamp both clients compute `now - startedAt` from, matching
 * "the backend records it once, both clients receive the same value").
 * The local `RoomEvent.ParticipantConnected` listener below ALSO calls
 * `setConnected()` as a low-latency optimization (no server round trip),
 * but `setConnected()` is idempotent - it only records `connectedAt` the
 * FIRST time it's called and ignores every call after, so whichever
 * signal (local event or server webhook) arrives first wins and the other
 * is a no-op. Neither client ever computes its own independent start time.
 *
 * Issue 5 fix: reconnection is entirely handled by LiveKit's own Room
 * object (ICE restart under the hood, same participant SID) - this
 * component never calls `room.connect()` again and `<LiveKitRoom>` never
 * unmounts/remounts during a reconnect, so there is no path here that
 * could create a second room or a duplicate participant. `Reconnecting`/
 * `Reconnected` only toggle UI state and never touch `connectedAt`.
 */
const ActiveCallUI = () => {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const { endCall, callId, remoteParticipant, connectedAt, status, setConnected, setReconnecting, setConnectionQuality } = useCallStore();
  const { hangupCall } = useCall();
  const [duration, setDuration] = useState(0);
  const [audioOutputs, setAudioOutputs] = useState<string[]>([]);
  const [showOutputPicker, setShowOutputPicker] = useState(false);

  useEffect(() => {
    console.log(LOG, 'ActiveCallUI mounted - wiring LiveKit room event listeners');

    // --- Room-level connection lifecycle -----------------------------
    const onConnected = () => {
      console.log(LOG, 'Room Connected. localParticipant=', localParticipant?.identity, 'sid=', room.localParticipant?.sid);
    };
    const onParticipantConnected = (participant: any) => {
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

    // --- Track publish/subscribe pipeline (Issue 1/2's core checklist) ---
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
      // Fires when getUserMedia() fails - i.e. local microphone track
      // creation itself failed (permission revoked mid-call, device busy,
      // etc.). This is the exact event to catch failures at the
      // "Local microphone track creation" stage Issue 1 asks about.
      console.error(LOG, 'MediaDevicesError - local track creation failed:', error?.message || error);
    };
    const onAudioPlaybackStatusChanged = () => {
      // LiveKit attempts to auto-play subscribed audio; if platform
      // policy blocks it, `room.canPlaybackAudio` goes false and calling
      // `room.startAudio()` (must happen after a user gesture on some
      // platforms) resumes it. On native mobile this is rare compared to
      // browsers, but costs nothing to handle defensively.
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

    // Catch the case where the remote participant (and their tracks)
    // already joined before this listener attached (fast-accept race).
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

  const handleOutputPress = async () => {
    if (Platform.OS === 'ios') {
      // iOS doesn't expose per-device selection to apps beyond
      // default/force_speaker - the native route picker is the correct UX
      // for choosing Bluetooth/wired/AirPlay there.
      await showNativeAudioRoutePicker();
      return;
    }
    const outputs = await listAudioOutputs();
    console.log(LOG, 'Available audio outputs:', outputs);
    setAudioOutputs(outputs);
    setShowOutputPicker(true);
  };

  const statusLabel =
    status === 'CONNECTED' ? formatDuration(duration) :
    status === 'RECONNECTING' ? 'Reconnecting...' :
    'Connecting...';

  const trimesterLabel = remoteParticipant?.trimester
    ? `🤰 ${remoteParticipant.trimester}${remoteParticipant.pregnancy_week ? ` · ${remoteParticipant.pregnancy_week}` : ''}`
    : null;

  return (
    <LinearGradient colors={['#D8B4A0', '#4A6970', '#0B192C']} style={styles.fullScreen}>
      <SafeAreaView style={styles.activeSafeArea}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.callOngoingPill}>
            <Feather name="bar-chart-2" size={16} color="white" />
            <Text style={styles.callOngoingText}>{status === 'RECONNECTING' ? 'Reconnecting' : 'Call Ongoing'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={styles.topMuteBtn} onPress={handleOutputPress}>
              <Feather name="volume-2" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.topMuteBtn, !isMicrophoneEnabled && styles.topMutedBtn]}
              onPress={toggleMicrophone}
            >
              <Feather name={isMicrophoneEnabled ? "mic" : "mic-off"} size={20} color={isMicrophoneEnabled ? "white" : "#ef4444"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Center Sound Wave */}
        <View style={styles.soundWaveContainer}>
          <View style={[styles.bar, { height: 40 }]} />
          <View style={[styles.bar, { height: 70 }]} />
          <View style={[styles.bar, { height: 100 }]} />
          <View style={[styles.bar, { height: 70 }]} />
          <View style={[styles.bar, { height: 40 }]} />
        </View>

        {/* Caller Details */}
        <View style={styles.callerDetails}>
          <Text style={styles.durationText}>{statusLabel}</Text>
          <Text style={styles.activeCallerName}>{remoteParticipant?.name || "A Mother"}</Text>
          {trimesterLabel && (
            <View style={styles.trimesterBadge}>
              <Text style={styles.trimesterText}>{trimesterLabel}</Text>
            </View>
          )}
        </View>

        {/* Audio output picker (Android) */}
        {showOutputPicker && (
          <View style={styles.outputPicker}>
            {audioOutputs.map((deviceId) => (
              <TouchableOpacity
                key={deviceId}
                style={styles.outputOption}
                onPress={async () => {
                  await selectAudioOutput(deviceId);
                  setShowOutputPicker(false);
                }}
              >
                <Feather
                  name={deviceId === 'bluetooth' ? 'bluetooth' : deviceId === 'speaker' ? 'volume-2' : deviceId === 'headset' ? 'headphones' : 'phone-call'}
                  size={18}
                  color="white"
                />
                <Text style={styles.outputOptionText}>{deviceId}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.outputOption} onPress={() => setShowOutputPicker(false)}>
              <Feather name="x" size={18} color="white" />
              <Text style={styles.outputOptionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.endCallBtn} onPress={() => {
              if (callId) hangupCall(callId);
              else endCall('ENDED');
          }}>
            <MaterialIcons name="call-end" size={24} color="white" />
            <Text style={styles.endCallText}>End Call</Text>
          </TouchableOpacity>
          <Text style={styles.confidentialText}>This call is confidential and secure</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
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
  const { isIncoming, isActive, status, remoteParticipant, callId, roomToken, livekitUrl, endCall } = useCallStore();
  const { acceptCall, rejectCall, hangupCall } = useCall();
  const [micGranted, setMicGranted] = useState(false);
  const [audioSessionReady, setAudioSessionReady] = useState(false);
  const [connectTimedOut, setConnectTimedOut] = useState(false);

  useEffect(() => {
    // Issue 13 fix: request (and gate connecting on) mic permission BEFORE
    // <LiveKitRoom connect={true}> mounts, instead of racing it.
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
    // lib/audioSession.ts). Gated on mic permission so we don't request
    // audio focus before we even know if we'll be allowed to use the mic.
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
    // Issue 7 fix: release the audio session (audio focus, native
    // AudioManager mode) the moment the call is no longer active, not just
    // implicitly whenever the native module happens to get garbage
    // collected. Runs whenever this component leaves the "active call"
    // state for any reason (hangup, remote end, failure, timeout).
    if (!isActive) {
      stopCallAudioSession();
    }
    return () => {
      // Also covers unmount of CallModals itself (e.g. app backgrounded
      // hard enough to tear down the root layout - shouldn't normally
      // happen, but this is a correct, cheap safety net).
      if (!useCallStore.getState().isActive) {
        stopCallAudioSession();
      }
    };
  }, [isActive]);

  useEffect(() => {
    setConnectTimedOut(false);
    if (!isActive || !roomToken || status === 'CONNECTED') return;

    const timer = setTimeout(() => {
      // Re-check at fire time - the call may have connected or ended in
      // the interim (setTimeout captures state at schedule time only).
      const current = useCallStore.getState();
      if (current.callId === callId && current.status !== 'CONNECTED' && current.isActive) {
        console.error(LOG, 'LiveKit did not reach CONNECTED within', CONNECT_TIMEOUT_MS, 'ms - check logs above for which pipeline stage stalled.');
        setConnectTimedOut(true);
      }
    }, CONNECT_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isActive, roomToken, callId, status === 'CONNECTED']);

  // Issue 5: ringing is handled entirely by notifee's native full-screen
  // call notification (see index.js) while backgrounded, and by the
  // system notification sound/vibration even in foreground - no custom
  // audio file is played here, matching "use the platform's native call
  // experience" (Issue 5's requirement).

  const handleAccept = () => {
    if (callId) acceptCall(callId);
  };

  const handleDecline = () => {
    if (callId) rejectCall(callId);
  };

  // Incoming Call UI (Issue 6: real caller info, not "Mother Calling")
  if (isIncoming && !isActive && callId) {
    return (
      <Modal visible animationType="slide" transparent>
        <LinearGradient colors={['#8B7355', '#2F4F4F', '#001F3F']} style={styles.fullScreen}>
          <SafeAreaView style={styles.incomingSafeArea}>
            <View style={styles.incomingHeader}>
              <View style={styles.avatarPlaceholder}>
                {remoteParticipant?.profile_picture ? (
                  <Image source={{ uri: remoteParticipant.profile_picture }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <Ionicons name="person" size={40} color="white" />
                )}
              </View>
              <View style={styles.incomingInfo}>
                <Text style={styles.incomingCallerName}>{remoteParticipant?.name || "Unknown Caller"}</Text>
                {!!remoteParticipant?.trimester && (
                  <Text style={styles.connectingText}>
                    {remoteParticipant.trimester}{remoteParticipant.pregnancy_week ? ` · ${remoteParticipant.pregnancy_week}` : ''}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.incomingActions}>
              <View style={styles.actionWrapper}>
                <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={handleDecline}>
                  <MaterialIcons name="call-end" size={32} color="white" />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Decline</Text>
              </View>

              <View style={styles.actionWrapper}>
                <TouchableOpacity style={[styles.actionBtn, styles.acceptBtnUI]} onPress={handleAccept}>
                  <Feather name="phone" size={32} color="white" />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Accept</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </Modal>
    );
  }

  // Active Connected Call UI
  if (isActive && roomToken) {
    if (!livekitUrl) {
      // Issue 9 fix: no more hardcoded LAN-IP fallback - see mobile-app's
      // CallModals.tsx for the identical rationale.
      console.error(LOG, 'No livekitUrl from server - cannot connect.');
      return (
        <Modal visible animationType="fade" transparent>
          <View style={styles.incomingSafeArea}>
            <Text style={styles.incomingCallerName}>Call Failed</Text>
            <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={() => endCall('FAILED')}>
              <MaterialIcons name="call-end" size={32} color="white" />
            </TouchableOpacity>
          </View>
        </Modal>
      );
    }

    if (!micGranted) {
      return (
        <Modal visible animationType="fade" transparent>
          <SafeAreaView style={styles.incomingSafeArea}>
            <Text style={styles.incomingCallerName}>Microphone Required</Text>
            <Text style={styles.connectingText}>Please allow microphone access to continue the call.</Text>
            <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={() => {
              if (callId) hangupCall(callId); else endCall('ENDED');
            }}>
              <MaterialIcons name="call-end" size={32} color="white" />
            </TouchableOpacity>
          </SafeAreaView>
        </Modal>
      );
    }

    if (!audioSessionReady) {
      // Issue 1 fix: don't mount <LiveKitRoom> (and start publishing/
      // subscribing tracks) until the native audio session is actually
      // active - publishing before this was ready is exactly the
      // "connected but silent" scenario this whole audit is about.
      return (
        <Modal visible animationType="fade" transparent>
          <SafeAreaView style={styles.incomingSafeArea}>
            <Text style={styles.incomingCallerName}>Preparing Audio...</Text>
            <Text style={styles.connectingText}>Setting up the call audio session.</Text>
          </SafeAreaView>
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
          <SafeAreaView style={styles.incomingSafeArea}>
            <Text style={styles.incomingCallerName}>Connection Failed</Text>
            <Text style={styles.connectingText}>
              Could not establish a call connection. This usually means the call server isn't reachable from your network - check with support if this keeps happening.
            </Text>
            <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={() => {
              if (callId) hangupCall(callId); else endCall('FAILED');
            }}>
              <MaterialIcons name="call-end" size={32} color="white" />
            </TouchableOpacity>
          </SafeAreaView>
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
  fullScreen: {
    flex: 1,
  },
  activeSafeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  callOngoingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  callOngoingText: {
    color: 'white',
    fontFamily: 'Helixa-Bold',
    fontSize: 14,
  },
  topMuteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topMutedBtn: {
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  soundWaveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
  },
  bar: {
    width: 6,
    backgroundColor: 'white',
    borderRadius: 3,
  },
  callerDetails: {
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  durationText: {
    color: 'white',
    fontFamily: 'Helixa-Bold',
    fontSize: 24,
    marginBottom: 8,
  },
  activeCallerName: {
    color: 'white',
    fontFamily: 'Helixa-Black',
    fontSize: 48,
    lineHeight: 52,
    marginBottom: 15,
  },
  trimesterBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  trimesterText: {
    color: 'white',
    fontFamily: 'Helixa-Bold',
    fontSize: 14,
  },
  outputPicker: {
    position: 'absolute',
    bottom: 160,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 16,
    padding: 8,
    minWidth: 180,
  },
  outputOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  outputOptionText: {
    color: 'white',
    fontFamily: 'Helixa-Regular',
    fontSize: 15,
    textTransform: 'capitalize',
  },
  bottomActions: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  endCallBtn: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    gap: 10,
    marginBottom: 20,
  },
  endCallText: {
    color: 'white',
    fontFamily: 'Helixa-Bold',
    fontSize: 18,
  },
  confidentialText: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Helixa-Regular',
    fontSize: 14,
  },
  incomingSafeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 60,
    paddingTop: 80,
  },
  incomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    gap: 20,
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  incomingInfo: {
    justifyContent: 'center',
  },
  incomingCallerName: {
    color: 'white',
    fontFamily: 'Helixa-Bold',
    fontSize: 28,
    marginBottom: 4,
  },
  connectingText: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Helixa-Regular',
    fontSize: 18,
  },
  incomingActions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
  },
  actionWrapper: {
    alignItems: 'center',
  },
  actionBtn: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  declineBtn: {
    backgroundColor: '#FF3B30',
  },
  acceptBtnUI: {
    backgroundColor: '#34C759',
  },
  actionLabel: {
    color: 'white',
    fontFamily: 'Helixa-Regular',
    fontSize: 16,
  }
});
