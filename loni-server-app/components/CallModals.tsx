import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Dimensions } from 'react-native';
import { useCallStore } from '../store/callStore';
import { useCall } from '../hooks/useCall';
import { LiveKitRoom, useRoomContext, useLocalParticipant } from '@livekit/react-native';
import { RoomEvent } from 'livekit-client';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const ActiveCallUI = () => {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const { endCall, callId, callerName } = useCallStore();
  const { hangupCall } = useCall();
  const [connected, setConnected] = useState(room.state === 'connected');
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const onConnStateChanged = () => setConnected(room.state === 'connected');
    room.on(RoomEvent.ConnectionStateChanged, onConnStateChanged);
    return () => { room.off(RoomEvent.ConnectionStateChanged, onConnStateChanged); };
  }, [room]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (connected) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [connected]);

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

  return (
    <LinearGradient colors={['#D8B4A0', '#4A6970', '#0B192C']} style={styles.fullScreen}>
      <SafeAreaView style={styles.activeSafeArea}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.callOngoingPill}>
            <Feather name="bar-chart-2" size={16} color="white" />
            <Text style={styles.callOngoingText}>Call Ongoing</Text>
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
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          <Text style={styles.activeCallerName}>{callerName || "A Mother"}</Text>
          <View style={styles.trimesterBadge}>
            <Text style={styles.trimesterText}>🤰 2nd Trimester</Text>
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.endCallBtn} onPress={() => {
              if (callId) hangupCall(callId);
              else endCall();
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

import { Audio } from 'expo-av';

export const CallModals = () => {
  const { isIncoming, isActive, callerName, callId, roomToken } = useCallStore();
  const { acceptCall, rejectCall } = useCall();
  
  useEffect(() => {
    if (isActive) {
      Audio.requestPermissionsAsync().catch(console.error);
    }
  }, [isActive]);

  // We've removed Audio because Notifee handles the ringing natively!

  const handleAccept = () => {
    if (callId) acceptCall(callId);
  };

  const handleDecline = () => {
    if (callId) rejectCall(callId);
  };

  // Incoming Call UI
  if (isIncoming && !isActive && callId) {
    return (
      <Modal visible animationType="slide" transparent>
        <LinearGradient colors={['#8B7355', '#2F4F4F', '#001F3F']} style={styles.fullScreen}>
          <SafeAreaView style={styles.incomingSafeArea}>
            <View style={styles.incomingHeader}>
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="white" />
              </View>
              <View style={styles.incomingInfo}>
                <Text style={styles.incomingCallerName}>{callerName || "A Mother"}</Text>
                <Text style={styles.connectingText}>connecting...</Text>
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
    return (
      <Modal visible animationType="fade">
        <LiveKitRoom 
          serverUrl={process.env.EXPO_PUBLIC_LIVEKIT_URL || 'ws://192.168.100.132:7880'} 
          token={roomToken} 
          connect={true} 
          audio={true} 
          video={false}
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
