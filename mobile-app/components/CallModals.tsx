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
      <Text style={styles.title}>Connected</Text>
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

import { Audio } from 'expo-av';

export const CallModals = () => {
  const { isOutgoing, isActive, callId, roomToken, endCall } = useCallStore();
  const { hangupCall } = useCall();

  useEffect(() => {
    if (isActive) {
      Audio.requestPermissionsAsync().catch(console.error);
    }
  }, [isActive]);

  // Outgoing Call UI
  if (isOutgoing && !isActive && callId) {
    return (
      <Modal visible animationType="fade" transparent>
        <View style={styles.outgoingContainer}>
          <Text style={styles.title}>Calling Nurse...</Text>
          <Text style={styles.status}>Searching for an available nurse</Text>
          <TouchableOpacity style={styles.hangupBtn} onPress={() => hangupCall(callId)}>
            <Text style={styles.btnText}>Cancel</Text>
          </TouchableOpacity>
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
  title: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 10,
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
