import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView } from 'react-native';
import { useCallStore } from '../store/callStore';
import { useCall } from '../hooks/useCall';
import { LiveKitRoom, useRoomContext, useLocalParticipant } from '@livekit/react-native';
import { RoomEvent } from 'livekit-client';

const ActiveCallUI = () => {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const { endCall, callId, callerName } = useCallStore();
  const { hangupCall } = useCall();
  const [connected, setConnected] = useState(room.state === 'connected');

  useEffect(() => {
    const onConnStateChanged = () => setConnected(room.state === 'connected');
    room.on(RoomEvent.ConnectionStateChanged, onConnStateChanged);
    return () => { room.off(RoomEvent.ConnectionStateChanged, onConnStateChanged); };
  }, [room]);

  const toggleMicrophone = () => {
    if (localParticipant) {
      localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    }
  };

  return (
    <SafeAreaView style={styles.activeContainer}>
      <Text style={styles.activeTitle}>Connected with {callerName || "User"}</Text>
      <Text style={styles.status}>{connected ? "Connected (Secure)" : "Connecting..."}</Text>
      
      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.muteBtn, !isMicrophoneEnabled && styles.mutedBtn]} 
          onPress={toggleMicrophone}
        >
          <Text style={styles.btnText}>{isMicrophoneEnabled ? "Mute" : "Unmute"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.hangupBtn} onPress={() => {
            if (callId) hangupCall(callId);
            else endCall();
        }}>
          <Text style={styles.btnText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export const CallModals = () => {
  const { isIncoming, isActive, callerName, callId, roomToken } = useCallStore();
  const { acceptCall, rejectCall } = useCall();

  // Incoming Call UI
  if (isIncoming && !isActive && callId) {
    return (
      <Modal visible animationType="slide" transparent>
        <View style={styles.incomingContainer}>
          <Text style={styles.callerName}>{callerName || "A Mother"} is calling...</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectCall(callId)}>
              <Text style={styles.btnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptCall(callId)}>
              <Text style={styles.btnText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  incomingContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callerName: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 40,
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
  },
  acceptBtn: {
    backgroundColor: '#4ade80',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  hangupBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  muteBtn: {
    backgroundColor: '#374151',
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
  activeContainer: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTitle: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 10,
  },
  status: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 50,
  }
});
