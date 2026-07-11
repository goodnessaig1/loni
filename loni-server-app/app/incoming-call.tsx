import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../store/callStore';
import { apiClient } from '../api/client';

const { width, height } = Dimensions.get('window');

export default function IncomingCallScreen() {
  const router = useRouter();
  const { call_id, caller_name, room_name, profile_picture } = useLocalSearchParams<{ call_id: string, caller_name: string, room_name: string, profile_picture?: string }>();
  const setCallConnected = useCallStore(state => state.setCallConnected);
  const endCall = useCallStore(state => state.endCall);

  const handleAccept = async () => {
    try {
      const res = await apiClient.post(`/calls/${call_id}/join`);
      setCallConnected(res.data.token);
      router.replace('/'); 
    } catch (e) {
      console.error("Failed to accept call", e);
      router.replace('/');
    }
  };

  const handleDecline = async () => {
    try {
      await apiClient.post(`/calls/${call_id}/end`);
    } catch (e) {
      console.error("Failed to decline call", e);
    }
    endCall();
    router.replace('/');
  };

  return (
    <LinearGradient
      colors={['#8B7355', '#2F4F4F', '#001F3F']}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {profile_picture ? (
            <Image
              source={{ uri: profile_picture }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={40} color="white" />
            </View>
          )}
        </View>
        <View style={styles.callerInfo}>
          <Text style={styles.callerName}>{caller_name || 'Unknown Caller'}</Text>
          <Text style={styles.statusText}>connecting...</Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <View style={styles.buttonWrapper}>
          <TouchableOpacity style={[styles.actionButton, styles.declineButton]} onPress={handleDecline}>
            <MaterialIcons name="call-end" size={32} color="white" />
          </TouchableOpacity>
          <Text style={styles.buttonLabel}>Decline</Text>
        </View>

        <View style={styles.buttonWrapper}>
          <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={handleAccept}>
            <Feather name="phone" size={32} color="white" />
          </TouchableOpacity>
          <Text style={styles.buttonLabel}>Accept</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: height * 0.15,
    paddingBottom: height * 0.1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 30,
    gap: 20
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
  },
  callerInfo: {
    justifyContent: 'center',
  },
  callerName: {
    fontFamily: 'Helixa-Bold',
    fontSize: 28,
    color: 'white',
    marginBottom: 4,
  },
  statusText: {
    fontFamily: 'Helixa-Regular',
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 20,
  },
  buttonWrapper: {
    alignItems: 'center',
  },
  actionButton: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  buttonLabel: {
    fontFamily: 'Helixa-Regular',
    color: 'white',
    fontSize: 16,
  }
});
