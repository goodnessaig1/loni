import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useCallStore } from '../store/callStore';
import { apiClient } from '../api/client';

const { width, height } = Dimensions.get('window');

export default function IncomingCallScreen() {
  const router = useRouter();
  const { call_id, caller_name, room_name } = useLocalSearchParams<{ call_id: string, caller_name: string, room_name: string }>();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const setCallConnected = useCallStore(state => state.setCallConnected);
  const clearIncomingCall = useCallStore(state => state.clearIncomingCall);

  useEffect(() => {
    async function playRingtone() {
      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          require('../assets/ringtone.mp3'),
          { isLooping: true }
        );
        setSound(newSound);
        await newSound.playAsync();
      } catch (e) {
        console.warn('Could not play ringtone', e);
      }
    }
    playRingtone();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const handleAccept = async () => {
    if (sound) await sound.stopAsync();
    
    try {
      const res = await apiClient.post(`/calls/${call_id}/join`);
      setCallConnected(res.data.token);
      clearIncomingCall();
      // Navigate to the active call screen or back to index which renders CallModals
      router.replace('/'); 
    } catch (e) {
      console.error("Failed to accept call", e);
      router.replace('/');
    }
  };

  const handleDecline = async () => {
    if (sound) await sound.stopAsync();
    try {
      await apiClient.post(`/calls/${call_id}/end`);
    } catch (e) {
      console.error("Failed to decline call", e);
    }
    clearIncomingCall();
    router.replace('/');
  };

  return (
    <LinearGradient
      colors={['#8B7355', '#2F4F4F', '#001F3F']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Image
          source={require('../assets/images/default-avatar.png')} // Replace with actual avatar if available
          style={styles.avatar}
          contentFit="cover"
        />
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
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'white',
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
