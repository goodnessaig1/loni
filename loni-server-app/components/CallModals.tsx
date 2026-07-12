import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Dimensions } from 'react-native';
import { Audio } from 'expo-av';
import { useCallStore, ConnectionQuality } from '../store/callStore';
import { useCall } from '../hooks/useCall';
import { LiveKitRoom, useRoomContext, useLocalParticipant } from '@livekit/react-native';
import { RoomEvent, ConnectionState, ConnectionQuality as LKConnectionQuality, Track } from 'livekit-client';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

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
      if (track.kind === Track.Kind.Audio) {
        console.log('[LiveKit] Remote audio track subscribed');
      }
    };
    const onDisconnected = () => endCall('ENDED');

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.Reconnecting, onReconnecting);
    room.on(RoomEvent.Reconnected, onReconnected);
    room.on(RoomEvent.ConnectionQualityChanged, onQualityChanged);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.Disconnected, onDisconnected);

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
          <TouchableOpacity
            style={[styles.topMuteBtn, !isMicrophoneEnabled && styles.topMutedBtn]}
            onPress={toggleMicrophone}
          >
            <Feather name={isMicrophoneEnabled ? "mic" : "mic-off"} size={20} color={isMicrophoneEnabled ? "white" : "#ef4444"} />
          </TouchableOpacity>
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

export const CallModals = () => {
  const { isIncoming, isActive, remoteParticipant, callId, roomToken, livekitUrl, endCall } = useCallStore();
  const { acceptCall, rejectCall, hangupCall } = useCall();
  const [micGranted, setMicGranted] = useState(false);

  useEffect(() => {
    // Issue 13 fix: request (and gate connecting on) mic permission BEFORE
    // <LiveKitRoom connect={true}> mounts, instead of racing it.
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
      console.error('[CallModals] No livekitUrl from server - cannot connect.');
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
