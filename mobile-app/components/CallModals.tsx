import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Image as RNImage, Platform, AppState } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';
import { Feather, MaterialIcons } from '@expo/vector-icons';
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
import { startCallForegroundService, stopCallForegroundService } from '../lib/callForegroundService';
import {
  PermissionStatus,
  getMicrophonePermissionStatus,
  requestMicrophonePermission,
  openAppSettings,
} from '../lib/permissions';

const LOG = '[Call/Mother]';

/**
 * Issue 6 fix: this used to be split across THREE separate UI surfaces -
 * a routed screen (app/nurse/connecting.tsx, "Connecting you to a
 * nurse..."), this component's own separate "Calling Nurse..." modal, and
 * then the active-call modal - each mounting/unmounting independently,
 * which is exactly the "unnecessary transitions between multiple screens"
 * this issue describes. Now there is exactly ONE <Modal>, mounted once for
 * the entire outgoing-call lifecycle; only the CONTENT inside it changes
 * as `status` progresses (RINGING -> ACCEPTED -> CONNECTING -> CONNECTED).
 * app/nurse/connecting.tsx still exists as a route (in case anything still
 * navigates to it) but is now just a trigger that calls requestCall() and
 * immediately returns - all UI lives here.
 *
 * Icons/background reuse the design from the old connecting.tsx screen
 * (talk-to-nurse.png + blur) for the pre-connect states, and the same
 * gradient/visualizer treatment loni-server-app's CallModals already used
 * for the connected state - so both apps' call screens now look and feel
 * like one consistent product instead of two different implementations
 * (Issue 8/9).
 */

const RING_TIMEOUT_TERMINAL_STATUSES: string[] = ['REJECTED', 'TIMEOUT', 'FAILED', 'CANCELLED', 'MISSED', 'ENDED'];
const CONNECT_TIMEOUT_MS = 20000;

function useCallLogger() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const store = useCallStore.getState();
      if (store.status === 'IDLE') return; // don't spam logs when there's no call
      if (next === 'background') {
        console.log(LOG, 'Background Transition - app backgrounded during call, status=', store.status);
      } else if (next === 'active') {
        console.log(LOG, 'Foreground Transition - app foregrounded during call, status=', store.status);
      }
    });
    return () => sub.remove();
  }, []);
}

const ActiveCallUI = () => {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  // Issue 7 fix: granular selectors instead of destructuring the whole
  // store - this component previously re-rendered on every single store
  // change (e.g. connectionQuality ticking every few seconds), even
  // updates that don't affect anything it renders.
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
  const [selectedOutput, setSelectedOutput] = useState<string>('earpiece');
  const [showOutputPicker, setShowOutputPicker] = useState(false);

  useEffect(() => {
    console.log(LOG, 'ActiveCallUI mounted - wiring LiveKit room event listeners');

    const onConnected = () => console.log(LOG, 'Room Connected. sid=', room.localParticipant?.sid);
    const onParticipantConnected = (participant?: any) => {
      console.log(LOG, 'Participant Joined:', participant?.identity ?? '(already present)');
      if (room.remoteParticipants.size >= 1 && room.state === ConnectionState.Connected) {
        setConnected();
      }
    };
    const onParticipantDisconnected = (participant: any) => console.log(LOG, 'Participant Left:', participant?.identity);
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
    // Issue 12: "automatically update the list when devices connect or
    // disconnect" - refresh the cached output list whenever the OS
    // reports a device change, so the picker is never stale when opened.
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

    onParticipantConnected(undefined);
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

  // Issue 4: start/stop the Android foreground service around the actual
  // connected window, not the whole modal lifecycle - no point holding a
  // foreground service open while still ringing.
  useEffect(() => {
    if (status === 'CONNECTED') {
      startCallForegroundService('Call in progress', `Connected with ${remoteParticipant?.name || 'Nurse'}`);
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
    const interval = setInterval(() => {
      tick();
    }, 1000);
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
      localParticipant.setMicrophoneEnabled(next);
    }
  };

  const outputIcon = (deviceId: string) => {
    if (deviceId === 'bluetooth') return 'bluetooth';
    if (deviceId === 'headset') return 'headphones';
    if (deviceId === 'speaker') return 'volume-2';
    return 'phone-call'; // earpiece / default
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

  return (
    <View style={styles.activeContainer}>
      {remoteParticipant?.profile_picture ? (
        <Image source={{ uri: remoteParticipant.profile_picture }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitial}>{(remoteParticipant?.name || 'N')[0]}</Text></View>
      )}
      <Text style={styles.title}>{remoteParticipant?.name || 'Nurse'}</Text>
      {/* Issue 8: hospital affiliation - the specific field that was
          reported missing on the Mother's side. Now sourced directly from
          the backend's ParticipantInfo, same field the Nurse app's own
          profile carries - no separate/duplicated data path. */}
      {!!remoteParticipant?.hospital_affiliation && (
        <View style={styles.hospitalBadge}>
          <Feather name="briefcase" size={13} color="white" style={{ marginRight: 6 }} />
          <Text style={styles.subtitle}>{remoteParticipant.hospital_affiliation}</Text>
        </View>
      )}
      <Text style={styles.status}>{statusLabel}</Text>

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

      <View style={styles.actions}>
        <TouchableOpacity style={styles.muteBtn} onPress={handleOutputPress}>
          <Feather name={outputIcon(selectedOutput) as any} size={20} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.muteBtn, !isMicrophoneEnabled && styles.mutedBtn]}
          onPress={toggleMicrophone}
        >
          <Feather name={isMicrophoneEnabled ? 'mic' : 'mic-off'} size={20} color={isMicrophoneEnabled ? 'white' : '#ef4444'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.hangupBtn} onPress={() => {
            if (callId) hangupCall(callId);
            else endCall('ENDED');
        }}>
          <MaterialIcons name="call-end" size={22} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const CallModals = () => {
  // Issue 7: granular selectors - only re-render when these specific
  // fields change, not on every store update.
  const isOutgoing = useCallStore((s) => s.isOutgoing);
  const isActive = useCallStore((s) => s.isActive);
  const status = useCallStore((s) => s.status);
  const callId = useCallStore((s) => s.callId);
  const roomToken = useCallStore((s) => s.roomToken);
  const livekitUrl = useCallStore((s) => s.livekitUrl);
  const remoteParticipant = useCallStore((s) => s.remoteParticipant);
  const endCall = useCallStore((s) => s.endCall);
  const { hangupCall } = useCall();
  const [micStatus, setMicStatus] = useState<PermissionStatus>('undetermined');
  const [audioSessionReady, setAudioSessionReady] = useState(false);
  const [connectTimedOut, setConnectTimedOut] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useCallLogger();

  const visible = isOutgoing || isActive;
  const micGranted = micStatus === 'granted';

  useEffect(() => {
    // Production permission requirement: onboarding (app/(auth)/permissions.tsx)
    // and a launch-time bootstrap for existing users (NotificationContext)
    // both already resolve microphone permission long before any call
    // starts - so this reads the cached status first instead of always
    // calling requestPermissionsAsync() here, which is what used to make
    // the dialog pop up mid-call. requestMicrophonePermission() is only
    // invoked as a fallback for the genuinely-undetermined case (e.g. a
    // session that predates the bootstrap effect), and it itself no-ops
    // rather than re-prompting if the OS has already permanently denied
    // access - that's surfaced as 'blocked' so the UI can point the user to
    // Settings instead of showing a dead-end "Microphone Required" screen.
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

  // Issue 6 fix: request the call once when this modal first becomes
  // visible with no callId yet is NOT how this works - requestCall() is
  // triggered by app/nurse/connecting.tsx (kept as a thin trigger route)
  // or directly by whatever button starts the call. This modal only
  // reacts to store state, it never initiates a call itself - keeping a
  // single, predictable direction of data flow.

  // Ringback tone (Issue 5: Android only - iOS gets a real ringback via
  // CallKit's startCall(), see hooks/useCall.ts).
  useEffect(() => {
    if (!(isOutgoing && status === 'RINGING') || Platform.OS === 'ios') {
      if (soundRef.current) {
        soundRef.current.stopAsync().then(() => soundRef.current?.unloadAsync());
        soundRef.current = null;
      }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
        const { sound } = await Audio.Sound.createAsync(require('../assets/calling.m4a'), { isLooping: true });
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        await sound.playAsync();
      } catch (e) {
        console.error(LOG, 'Error playing ringback tone', e);
      }
    })();
    return () => {
      cancelled = true;
      if (soundRef.current) {
        soundRef.current.stopAsync().then(() => soundRef.current?.unloadAsync());
        soundRef.current = null;
      }
    };
  }, [isOutgoing, status]);

  if (!visible) return null;

  const handleCancel = () => {
    if (callId) hangupCall(callId);
    else endCall('CANCELLED');
  };

  // Issue 6: single content switch, one Modal, one mount.
  let content: React.ReactNode;

  if (isActive && roomToken && !livekitUrl) {
    content = (
      <View style={styles.centerContent}>
        <Text style={styles.title}>Call Failed</Text>
        <Text style={styles.status}>Could not reach the call server. Please try again.</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => endCall('FAILED')}>
          <Text style={styles.cancelText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (isActive && roomToken && !micGranted) {
    content = (
      <View style={styles.centerContent}>
        <Text style={styles.title}>Microphone Required</Text>
        <Text style={styles.status}>
          {micStatus === 'blocked'
            ? 'Microphone access is turned off for this app. Enable it in Settings to continue.'
            : 'Please allow microphone access to continue the call.'}
        </Text>
        {micStatus === 'blocked' && (
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: '#3b82f6' }]} onPress={openAppSettings}>
            <Text style={styles.cancelText}>Open Settings</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (isActive && roomToken && !audioSessionReady) {
    content = (
      <View style={styles.centerContent}>
        <Text style={styles.title}>Preparing Audio...</Text>
      </View>
    );
  } else if (isActive && roomToken && connectTimedOut) {
    content = (
      <View style={styles.centerContent}>
        <Text style={styles.title}>Connection Failed</Text>
        <Text style={styles.status}>Could not establish a call connection. This usually means the call server isn't reachable from your network.</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (isActive && roomToken && livekitUrl) {
    content = (
      <LiveKitRoom
        serverUrl={livekitUrl}
        token={roomToken}
        connect={true}
        audio={true}
        video={false}
        options={{ adaptiveStream: true, dynacast: true }}
        onConnected={() => console.log(LOG, 'LiveKitRoom onConnected callback fired')}
        onDisconnected={() => console.log(LOG, 'LiveKitRoom onDisconnected callback fired')}
        onError={(e) => console.error(LOG, 'LiveKitRoom onError:', e)}
        onMediaDeviceFailure={(f) => console.error(LOG, 'LiveKitRoom onMediaDeviceFailure:', f)}
      >
        <ActiveCallUI />
      </LiveKitRoom>
    );
  } else {
    // Outgoing/ringing/accepted, not yet connecting - the single unified
    // "calling" screen (Issue 6's exact example flow).
    const label =
      status === 'ACCEPTED' ? `${remoteParticipant?.name || 'A nurse'} accepted - connecting...` :
      remoteParticipant?.name ? `Calling ${remoteParticipant.name}...` :
      'Searching for available nurse...';
    content = (
      <View style={styles.container}>
        <RNImage source={require('../assets/images/talk-to-nurse.png')} style={styles.bgImage} resizeMode="cover" />
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
          <SafeAreaView style={styles.outgoingSafeArea}>
            <View style={styles.header}>
              <View style={styles.badge}>
                <Feather name="phone" size={16} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.badgeText}>Talk to a Nurse</Text>
              </View>
            </View>

            <View style={styles.content}>
              <Text style={styles.outgoingTitle}>{label}</Text>
              <Text style={styles.subtitle}>Please wait while we connect you with a certified maternal nurse</Text>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelBtnFull} onPress={handleCancel}>
                <Feather name="x" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </BlurView>
      </View>
    );
  }

  return (
    <Modal visible animationType="fade">
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bgImage: { ...StyleSheet.absoluteFillObject },
  outgoingSafeArea: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  header: { alignItems: 'center', width: '100%' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  badgeText: { color: '#FFF', fontSize: 16 },
  content: { alignItems: 'center', width: '100%' },
  outgoingTitle: { color: '#FFF', fontSize: 30, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, lineHeight: 36 },
  subtitle: { color: '#FFF', fontSize: 14, textAlign: 'center', opacity: 0.9 },
  footer: { width: '100%', alignItems: 'center' },
  cancelBtnFull: { width: '100%', height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  centerContent: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 24 },
  activeContainer: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 16 },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, marginBottom: 16, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  title: { fontSize: 28, color: '#fff', fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
  hospitalBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 4 },
  status: { fontSize: 16, color: '#94a3b8', marginTop: 8, marginBottom: 50, textAlign: 'center', paddingHorizontal: 20 },
  actions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  hangupBtn: { backgroundColor: '#ef4444', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  muteBtn: { backgroundColor: '#334155', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  mutedBtn: { backgroundColor: '#f59e0b' },
  cancelBtn: { backgroundColor: '#ef4444', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, marginTop: 20 },
  cancelText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  outputPicker: { position: 'absolute', bottom: 140, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 16, padding: 8, minWidth: 200 },
  outputOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  outputOptionSelected: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  outputOptionText: { color: 'white', fontSize: 15, textTransform: 'capitalize' },
});
