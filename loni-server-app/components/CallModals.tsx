import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Image as RNImage, Dimensions, Platform, AppState } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallStore, ConnectionQuality } from '../store/callStore';
import { useCall } from '../hooks/useCall';
import { LiveKitRoom, useRoomContext, useLocalParticipant } from '@livekit/react-native';
import { RoomEvent, ConnectionState, ConnectionQuality as LKConnectionQuality } from 'livekit-client';
import { startCallAudioSession, stopCallAudioSession, listAudioOutputs, selectAudioOutput, showNativeAudioRoutePicker } from '../lib/audioSession';
import { startCallForegroundService, stopCallForegroundService } from '../lib/callForegroundService';
import { PermissionStatus, getMicrophonePermissionStatus, requestMicrophonePermission, openAppSettings } from '../lib/permissions';

const LOG = '[Call/Nurse]';
const CONNECT_TIMEOUT_MS = 20000;

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
  const [selectedOutput, setSelectedOutput] = useState<string>('earpiece');
  const [showOutputPicker, setShowOutputPicker] = useState(false);

  useEffect(() => {
    const onConnected = () => {
      console.log(LOG, 'Room Connected. sid=', room.localParticipant?.sid);
      if (room.remoteParticipants.size >= 1) {
        setConnected();
      }
    };
    const onParticipantConnected = (participant?: any) => {
      if (room.remoteParticipants.size >= 1 && room.state === ConnectionState.Connected) {
        setConnected();
      }
    };
    const onParticipantDisconnected = () => {};
    const onReconnecting = () => setReconnecting();
    const onReconnected = () => setConnected();
    const onDisconnected = (reason: any) => endCall('ENDED');
    const onAudioPlaybackStatusChanged = () => {
      if (!room.canPlaybackAudio) {
        room.startAudio().catch(() => {});
      }
    };
    const onQualityChanged = (quality: LKConnectionQuality, participant: any) => {
      if (participant?.sid === localParticipant?.sid) {
        const mapped: ConnectionQuality =
          quality === LKConnectionQuality.Excellent ? 'excellent' :
          quality === LKConnectionQuality.Good ? 'good' : 'poor';
        setConnectionQuality(mapped);
      }
    };
    const onMediaDevicesChanged = () => {
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
    room.on(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackStatusChanged);
    room.on(RoomEvent.ConnectionQualityChanged, onQualityChanged);
    room.on(RoomEvent.MediaDevicesChanged, onMediaDevicesChanged);

    onParticipantConnected();
    if (!room.canPlaybackAudio) onAudioPlaybackStatusChanged();

    return () => {
      room.off(RoomEvent.Connected, onConnected);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.Reconnecting, onReconnecting);
      room.off(RoomEvent.Reconnected, onReconnected);
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackStatusChanged);
      room.off(RoomEvent.ConnectionQualityChanged, onQualityChanged);
      room.off(RoomEvent.MediaDevicesChanged, onMediaDevicesChanged);
    };
  }, [room]);

  // Bulletproof periodic check for room connection state to start the timer,
  // in case the native SDK fired events too fast or missed them.
  useEffect(() => {
    if (connectedAt) return; // Already connected, timer is running
    const checkInterval = setInterval(() => {
      if (room.state === ConnectionState.Connected && room.remoteParticipants.size >= 1) {
        setConnected();
        clearInterval(checkInterval);
      }
    }, 500);
    return () => clearInterval(checkInterval);
  }, [room, connectedAt, setConnected]);

  useEffect(() => {
    if (status === 'CONNECTED') {
      startCallForegroundService('Call in progress', `Connected with ${remoteParticipant?.name || 'Mother'}`);
    }
    return () => { stopCallForegroundService(); };
  }, [status === 'CONNECTED']);

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
    status === 'CONNECTED' ? 'Call Ongoing' :
    status === 'RECONNECTING' ? 'Reconnecting...' :
    'Connecting...';

  const m = Math.floor(duration / 60).toString();
  const s = `:${(duration % 60) < 10 ? '0' : ''}${duration % 60}`;

  const hasTrimester = remoteParticipant?.trimester || remoteParticipant?.pregnancy_week;
  const specialtyLabel = hasTrimester
    ? `${remoteParticipant.trimester || ''} ${remoteParticipant.pregnancy_week ? `• Week ${remoteParticipant.pregnancy_week}` : ''}`
    : remoteParticipant?.hospital_affiliation || 'Patient';

  return (
    <View style={styles.container}>
      <StatusBar style='light' />
      {remoteParticipant?.profile_picture ? (
        <Image source={{ uri: remoteParticipant.profile_picture }} style={styles.bgImage} contentFit="cover" />
      ) : (
        <View style={[styles.bgImage, { backgroundColor: '#2b2a29' }]} />
      )}

      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.badge}>
              <View style={styles.soundBarsContainer}>
                <View style={[styles.soundBar, { height: 12 }]} />
                <View style={[styles.soundBar, { height: 16 }]} />
                <View style={[styles.soundBar, { height: 10 }]} />
              </View>
              <Text style={styles.badgeText}>{statusLabel}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.iconButton} onPress={handleOutputPress}>
                <Feather name={outputIcon(selectedOutput) as any} size={20} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconButton, !isMicrophoneEnabled && { backgroundColor: '#ef4444' }]} onPress={toggleMicrophone}>
                <Feather name={isMicrophoneEnabled ? "mic" : "mic-off"} size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Center Graphic */}
          <View style={styles.centerGraphic}>
            <View style={styles.visualizerContainer}>
              <View style={[styles.bigBar, { height: 40 }]} />
              <View style={[styles.bigBar, { height: 60 }]} />
              <View style={[styles.bigBar, { height: 90 }]} />
              <View style={[styles.bigBar, { height: 60 }]} />
              <View style={[styles.bigBar, { height: 40 }]} />
            </View>
          </View>

          {/* Participant Info */}
          <View style={styles.infoContainer}>
            <View style={styles.timerContainer}>
              <Text style={styles.timerMinutes}>{m}</Text>
              <Text style={styles.timerSeconds}>{s}</Text>
            </View>
            <Text style={styles.nurseName}>
              {remoteParticipant?.name ? remoteParticipant.name.replace(' ', '\n') : 'A\nMother'}
            </Text>

            <View style={styles.specialtyBadge}>
              <Ionicons name={hasTrimester ? "medical" : "business"} size={14} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.specialtyText}>{specialtyLabel}</Text>
            </View>
          </View>

          {/* Android Audio Output Picker */}
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

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.endCallBtn} onPress={() => {
                if (callId) hangupCall(callId);
                else endCall('ENDED');
            }}>
              <Feather name="phone-off" size={24} color="#FFF" style={{ marginRight: 12 }} />
              <Text style={styles.endCallText}>End Call</Text>
            </TouchableOpacity>

            <Text style={styles.secureText}>This call is confidential and secure</Text>
          </View>

        </SafeAreaView>
      </View>
    </View>
  );
};

export const CallModals = () => {
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

  const visible = isActive;
  const micGranted = micStatus === 'granted';

  useEffect(() => {
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
        .then((res) => { if (!cancelled) setMicStatus(res); })
        .catch((e) => { if (!cancelled) setMicStatus('denied'); });
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
        setConnectTimedOut(true);
      }
    }, CONNECT_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [isActive, roomToken, callId, status === 'CONNECTED']);

  const handleAccept = () => {
    if (callId) acceptCall(callId);
  };

  const handleDecline = () => {
    if (callId) rejectCall(callId);
  };

  let content: React.ReactNode;

  // INCOMING CALL (WhatsApp Style)
  if (isIncoming && !isActive && callId) {
    const hasTrimester = remoteParticipant?.trimester || remoteParticipant?.pregnancy_week;
    const specialtyLabel = hasTrimester
      ? `${remoteParticipant.trimester || ''} ${remoteParticipant.pregnancy_week ? `• Week ${remoteParticipant.pregnancy_week}` : ''}`
      : remoteParticipant?.hospital_affiliation || '';

    content = (
      <View style={styles.incomingContainer}>
        <StatusBar style='light' />
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill}>
          <SafeAreaView style={styles.incomingSafeArea}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <View style={styles.incomingAvatarPlaceholder}>
                {remoteParticipant?.profile_picture ? (
                  <Image source={{ uri: remoteParticipant.profile_picture }} style={styles.incomingAvatar} contentFit="cover" />
                ) : (
                  <Text style={styles.incomingAvatarInitial}>{(remoteParticipant?.name || 'M')[0]}</Text>
                )}
              </View>
              <Text style={styles.incomingName}>{remoteParticipant?.name || 'Incoming Call'}</Text>
              
              {!!specialtyLabel && (
                <Text style={styles.incomingSubtitle}>{specialtyLabel}</Text>
              )}
            </View>

            <View style={styles.incomingActions}>
              <View style={styles.incomingActionWrapper}>
                <TouchableOpacity style={[styles.incomingBtn, styles.declineBtn]} onPress={handleDecline}>
                  <MaterialIcons name="call-end" size={32} color="white" />
                </TouchableOpacity>
                <Text style={styles.incomingActionLabel}>Decline</Text>
              </View>

              <View style={styles.incomingActionWrapper}>
                <TouchableOpacity style={[styles.incomingBtn, styles.acceptBtnUI]} onPress={handleAccept}>
                  <Feather name="phone" size={32} color="white" />
                </TouchableOpacity>
                <Text style={styles.incomingActionLabel}>Answer</Text>
              </View>
            </View>
          </SafeAreaView>
        </BlurView>
      </View>
    );
  } else if (isActive && roomToken) {
    if (!livekitUrl) {
      content = (
        <View style={styles.centerContent}>
          <Text style={styles.title}>Call Failed</Text>
          <Text style={styles.statusText}>Could not reach the call server. Please try again.</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => endCall('FAILED')}>
            <Text style={styles.cancelText}>Close</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (!micGranted) {
      content = (
        <View style={styles.centerContent}>
          <Text style={styles.title}>Microphone Required</Text>
          <Text style={styles.statusText}>Please allow microphone access to continue.</Text>
          {micStatus === 'blocked' && (
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: '#3b82f6' }]} onPress={openAppSettings}>
              <Text style={styles.cancelText}>Open Settings</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelBtn} onPress={() => {
            if (callId) hangupCall(callId); else endCall('ENDED');
          }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (!audioSessionReady) {
      content = (
        <View style={styles.centerContent}>
          <Text style={styles.title}>Preparing Audio...</Text>
        </View>
      );
    } else if (connectTimedOut) {
      content = (
        <View style={styles.centerContent}>
          <Text style={styles.title}>Connection Failed</Text>
          <Text style={styles.statusText}>Could not establish a connection.</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => {
            if (callId) hangupCall(callId); else endCall('FAILED');
          }}>
            <Text style={styles.cancelText}>Close</Text>
          </TouchableOpacity>
        </View>
      );
    } else {
      content = (
        <LiveKitRoom
          serverUrl={livekitUrl}
          token={roomToken}
          connect={true}
          audio={true}
          video={false}
          options={{ adaptiveStream: true, dynacast: true }}
        >
          <ActiveCallUI />
        </LiveKitRoom>
      );
    }
  }

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" transparent>
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bgImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  safeArea: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.4)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  soundBarsContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  soundBar: { width: 2, backgroundColor: '#FFF', marginHorizontal: 1.5, borderRadius: 2 },
  badgeText: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  iconButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center' },
  centerGraphic: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  visualizerContainer: { flexDirection: 'row', alignItems: 'center' },
  bigBar: { width: 6, backgroundColor: '#FFF', marginHorizontal: 6, borderRadius: 4 },
  infoContainer: { alignItems: 'flex-start', width: '100%', marginBottom: 40 },
  timerContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  timerMinutes: { color: '#FFF', fontSize: 24, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  timerSeconds: { color: '#FFF', fontSize: 18, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  nurseName: { color: '#FFF', fontSize: 48, lineHeight: 52, marginBottom: 16, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  specialtyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  specialtyText: { color: '#FFF', fontSize: 14 },
  footer: { width: '100%', alignItems: 'center' },
  endCallBtn: { backgroundColor: '#FF3B30', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 200, height: 56, borderRadius: 28, marginBottom: 24 },
  endCallText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  secureText: { color: '#FFF', fontSize: 14, opacity: 0.8 },
  outputPicker: { position: 'absolute', bottom: 140, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 16, padding: 8, minWidth: 200 },
  outputOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  outputOptionSelected: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  outputOptionText: { color: 'white', fontSize: 15, textTransform: 'capitalize' },
  centerContent: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, color: '#fff', fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
  statusText: { fontSize: 16, color: '#94a3b8', marginTop: 8, marginBottom: 50, textAlign: 'center' },
  cancelBtn: { backgroundColor: '#ef4444', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, marginTop: 20 },
  cancelText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  
  // INCOMING STYLES
  incomingContainer: { flex: 1, backgroundColor: '#111' },
  incomingSafeArea: { flex: 1, justifyContent: 'space-between', paddingBottom: 60, paddingTop: 80 },
  incomingAvatarPlaceholder: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 24 },
  incomingAvatar: { width: '100%', height: '100%', borderRadius: 70 },
  incomingAvatarInitial: { color: '#FFF', fontSize: 48, fontWeight: 'bold' },
  incomingName: { color: 'white', fontSize: 36, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  incomingSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 20, textAlign: 'center' },
  incomingActions: { flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: 20 },
  incomingActionWrapper: { alignItems: 'center' },
  incomingBtn: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  declineBtn: { backgroundColor: '#FF3B30' },
  acceptBtnUI: { backgroundColor: '#34C759' },
  incomingActionLabel: { color: 'white', fontSize: 18, fontWeight: '500' }
});
