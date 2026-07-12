import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Dimensions, Platform, AppState } from 'react-native';
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
import { startCallForegroundService, stopCallForegroundService } from '../lib/callForegroundService';
import {
  PermissionStatus,
  getMicrophonePermissionStatus,
  requestMicrophonePermission,
  openAppSettings,
} from '../lib/permissions';

const { width, height } = Dimensions.get('window');
const LOG = '[Call/Nurse]';

function useCallLogger() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const store = useCallStore.getState();
      if (store.status === 'IDLE') return;
      if (next === 'background') {
        console.log(LOG, 'Background Transition - app backgrounded during call, status=', store.status);
      } else if (next === 'active') {
        console.log(LOG, 'Foreground Transition - app foregrounded during call, status=', store.status);
      }
    });
    return () => sub.remove();
  }, []);
}

/**
 * Issue 12 fix: only RoomEvent.ConnectionStateChanged was handled before.
 * Issue 3 fix: timer now keys off callStore.connectedAt (set from
 * ParticipantConnected locally + the backend's webhook-driven `call_state`
 * WS event - see mobile-app/components/CallModals.tsx for the full
 * rationale, identical here).
 * Issue 6/7 fix: this screen used to hardcode "🤰 2nd Trimester" for
 * EVERY caller regardless of who was actually calling. Now reads
 * `remoteParticipant.trimester` / `.pregnancy_week`, populated by the
 * backend from the real Mother's profile (see backend
 * app/modules/calls/services/call_service.py::_participant_info).
 * Issue 7 (re-render audit): converted to granular Zustand selectors -
 * this previously destructured the whole store and re-rendered on every
 * single field change, including ones this component doesn't render
 * (e.g. connectionQuality ticking).
 */
const ActiveCallUI = () => {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const callId = useCallStore((s) => s.callId);
  const remoteParticipant = useCallStore((s) => s.remoteParticipant);
  const connectedAt = useCallStore((s) => s.connectedAt);
  const status = useCallStore((s) => s.status);
  const setConnected = useCallStore((s) => s.setConnected);
  const setReconnecting = useCallStore((s) => s.setReconnecting);
  const setConnectionQuality = useCallStore((s) => s.setConnectionQuality);
  const endCall = useCallStore((s) => s.endCall);
  const { hangupCall } = useCall();
  const [duration, setDuration] = useState(0);
  const [audioOutputs, setAudioOutputs] = useState<string[]>([]);
  const [selectedOutput, setSelectedOutput] = useState('earpiece');
  const [showOutputPicker, setShowOutputPicker] = useState(false);

  useEffect(() => {
    console.log(LOG, 'ActiveCallUI mounted - wiring LiveKit room event listeners');

    const onConnected = () => {
      console.log(LOG, 'Room Connected. sid=', room.localParticipant?.sid);
    };
    const onParticipantConnected = (participant: any) => {
      console.log(LOG, 'Participant Joined:', participant?.identity ?? '(already present)');
      if (room.remoteParticipants.size >= 1 && room.state === ConnectionState.Connected) {
        setConnected();
      }
    };
    const onParticipantDisconnected = (participant: any) => {
      console.log(LOG, 'Participant Left:', participant?.identity);
    };
    const onReconnecting = () => {
      console.warn(LOG, 'Reconnection started - audio paused, timer NOT reset.');
      setReconnecting();
    };
    const onReconnected = () => {
      console.log(LOG, 'Reconnection succeeded - audio/subscriptions restored automatically.');
      setConnected();
    };
    const onDisconnected = (reason: any) => {
      console.log(LOG, 'Call Ended (room disconnected). reason=', reason);
      endCall('ENDED');
    };
    const onLocalTrackPublished = (publication: any) => {
      console.log(LOG, 'Audio Published: kind=', publication?.kind, 'source=', publication?.source, 'sid=', publication?.trackSid);
    };
    const onTrackSubscribed = (track: any, publication: any, participant: any) => {
      console.log(LOG, 'Audio Subscribed: from=', participant?.identity, 'sid=', publication?.trackSid);
    };
    const onTrackSubscriptionFailed = (trackSid: string, participant: any) => {
      console.error(LOG, 'Track Subscription FAILED for', trackSid, 'from', participant?.identity);
    };
    const onTrackMuted = (publication: any, participant: any) => {
      console.log(LOG, participant?.isLocal ? 'Microphone Muted' : `Remote muted: ${participant?.identity}`);
    };
    const onTrackUnmuted = (publication: any, participant: any) => {
      console.log(LOG, participant?.isLocal ? 'Microphone Enabled' : `Remote unmuted: ${participant?.identity}`);
    };
    const onMediaDevicesError = (error: Error) => {
      console.error(LOG, 'MediaDevicesError - local track creation failed:', error?.message || error);
    };
    const onAudioPlaybackStatusChanged = () => {
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
        setConnectionQuality(mapped);
      }
    };
    // Issue 12: auto-refresh the picker's list whenever a device
    // connects/disconnects, so it's never stale when opened.
    const onMediaDevicesChanged = () => {
      console.log(LOG, 'Audio Device Changed - refreshing available outputs');
      if (Platform.OS === 'android') {
        listAudioOutputs().then(setAudioOutputs);
      }
    };

    room.on(RoomEvent.Connected, onConnected);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.Disconnected, onDisconnected);
    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed);
    room.on(RoomEvent.TrackMuted, onTrackMuted);
    room.on(RoomEvent.TrackUnmuted, onTrackUnmuted);
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);
    room.on(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackStatusChanged);
    room.on(RoomEvent.ConnectionQualityChanged, onQualityChanged);
    room.on(RoomEvent.MediaDevicesChanged, onMediaDevicesChanged);

    onParticipantConnected(undefined as any);
    if (!room.canPlaybackAudio) onAudioPlaybackStatusChanged();

    return () => {
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackSubscriptionFailed, onTrackSubscriptionFailed);
      room.off(RoomEvent.TrackMuted, onTrackMuted);
      room.off(RoomEvent.TrackUnmuted, onTrackUnmuted);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
      room.off(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackStatusChanged);
      room.off(RoomEvent.ConnectionQualityChanged, onQualityChanged);
      room.off(RoomEvent.MediaDevicesChanged, onMediaDevicesChanged);
    };
  }, [room]);

  // Issue 4: Android foreground service around the connected window only.
  useEffect(() => {
    if (status === 'CONNECTED') {
      startCallForegroundService('Call in progress', `Connected with ${remoteParticipant?.name || 'Mother'}`);
    }
    return () => {
      stopCallForegroundService();
    };
  }, [status === 'CONNECTED']);

  useEffect(() => {
    if (!connectedAt) {
      setDuration(0);
      return;
    }
    console.log(LOG, 'Timer Started at', new Date(connectedAt).toISOString());
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

  const outputIcon = (deviceId: string) => {
    if (deviceId === 'bluetooth') return 'bluetooth';
    if (deviceId === 'headset') return 'headphones';
    if (deviceId === 'speaker') return 'volume-2';
    return 'phone-call';
  };

  const handleOutputPress = async () => {
    if (Platform.OS === 'ios') {
      await showNativeAudioRoutePicker();
      return;
    }
    const outputs = await listAudioOutputs();
    setAudioOutputs(outputs);
    setShowOutputPicker((v) => !v);
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
              <Feather name={outputIcon(selectedOutput) as any} size={20} color="white" />
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
                style={[styles.outputOption, selectedOutput === deviceId && styles.outputOptionSelected]}
                onPress={async () => {
                  await selectAudioOutput(deviceId);
                  setSelectedOutput(deviceId);
                  setShowOutputPicker(false);
                }}
              >
                <Feather name={outputIcon(deviceId) as any} size={18} color="white" />
                <Text style={styles.outputOptionText}>{deviceId}</Text>
                {selectedOutput === deviceId && <Feather name="check" size={16} color="white" style={{ marginLeft: 'auto' }} />}
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
  // Issue 7: granular selectors instead of one big destructure.
  const isIncoming = useCallStore((s) => s.isIncoming);
  const isActive = useCallStore((s) => s.isActive);
  const status = useCallStore((s) => s.status);
  const remoteParticipant = useCallStore((s) => s.remoteParticipant);
  const callId = useCallStore((s) => s.callId);
  const roomToken = useCallStore((s) => s.roomToken);
  const livekitUrl = useCallStore((s) => s.livekitUrl);
  const endCall = useCallStore((s) => s.endCall);
  const { acceptCall, rejectCall, hangupCall } = useCall();
  const [micStatus, setMicStatus] = useState<PermissionStatus>('undetermined');
  const [audioSessionReady, setAudioSessionReady] = useState(false);
  const [connectTimedOut, setConnectTimedOut] = useState(false);

  useCallLogger();

  const micGranted = micStatus === 'granted';

  useEffect(() => {
    // Issue 13 fix: gate connecting on mic permission BEFORE
    // <LiveKitRoom connect={true}> mounts, instead of racing it.
    //
    // Production permission requirement: onboarding (app/(auth)/permissions.tsx)
    // and a launch-time bootstrap for existing users (NotificationContext)
    // both already resolve microphone permission long before any call
    // starts - especially important here since the Nurse has to *accept*
    // an incoming call immediately. This reads the cached status first
    // instead of always calling requestPermissionsAsync(), which is what
    // used to make the dialog pop up while a call was already ringing.
    // requestMicrophonePermission() is only invoked as a fallback for the
    // genuinely-undetermined case, and itself no-ops rather than
    // re-prompting if the OS has already permanently denied access -
    // that's surfaced as 'blocked' so the UI can point to Settings instead
    // of a dead-end "Microphone Required" screen.
    if (!isActive || !roomToken) {
      setMicStatus('undetermined');
      return;
    }
    let cancelled = false;
    getMicrophonePermissionStatus().then((status) => {
      if (cancelled) return;
      if (status !== 'undetermined') {
        setMicStatus(status);
        return;
      }
      requestMicrophonePermission()
        .then((res) => {
          if (!cancelled) setMicStatus(res);
        })
        .catch((e) => {
          console.error(LOG, 'Microphone permission request failed', e);
          if (!cancelled) setMicStatus('denied');
        });
    });
    return () => { cancelled = true; };
  }, [isActive, roomToken]);

  useEffect(() => {
    if (!micGranted || !isActive || !roomToken) {
      setAudioSessionReady(false);
      return;
    }
    let cancelled = false;
    startCallAudioSession().then((ok) => {
      if (!cancelled) setAudioSessionReady(ok);
    });
    return () => { cancelled = true; };
  }, [micGranted, isActive, roomToken]);

  useEffect(() => {
    setConnectTimedOut(false);
    if (!isActive || !roomToken || status === 'CONNECTED') return;

    const timer = setTimeout(() => {
      const current = useCallStore.getState();
      if (current.callId === callId && current.status !== 'CONNECTED' && current.isActive) {
        console.error(LOG, 'Connection timed out after', CONNECT_TIMEOUT_MS, 'ms');
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
            <Text style={styles.connectingText}>
              {micStatus === 'blocked'
                ? 'Microphone access is turned off for this app. Enable it in Settings to continue.'
                : 'Please allow microphone access to continue the call.'}
            </Text>
            {micStatus === 'blocked' && (
              <TouchableOpacity
                style={{ backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24, marginBottom: 16 }}
                onPress={openAppSettings}
              >
                <Text style={{ color: 'white', fontSize: 15, fontWeight: '600' }}>Open Settings</Text>
              </TouchableOpacity>
            )}
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
      return (
        <Modal visible animationType="fade" transparent>
          <SafeAreaView style={styles.incomingSafeArea}>
            <Text style={styles.incomingCallerName}>Preparing Audio...</Text>
          </SafeAreaView>
        </Modal>
      );
    }

    if (connectTimedOut) {
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
    minWidth: 200,
  },
  outputOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  outputOptionSelected: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
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
