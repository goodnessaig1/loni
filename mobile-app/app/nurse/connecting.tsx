import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { HelixaText } from '../../components/HelixaText';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ConnectingNurseScreen() {
  const router = useRouter();
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    let soundObject: Audio.Sound | null = null;
    let isMounted = true;

    async function playSound() {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/calling.m4a'),
          { isLooping: true }
        );
        if (isMounted) {
          soundObject = sound;
          setSound(sound);
          await sound.playAsync();
        } else {
          // If unmounted before loading finishes
          await sound.unloadAsync();
        }
      } catch (e) {
        console.error('Error playing calling sound', e);
      }
    }
    playSound();

    const timeout = setTimeout(() => {
      router.replace('/nurse/call');
    }, 20000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      if (soundObject) {
        soundObject.stopAsync().then(() => soundObject?.unloadAsync());
      }
    };
  }, []);

  const handleCancel = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/talk-to-nurse.png')}
        style={styles.bgImage}
        contentFit="cover"
      />
      
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
        <SafeAreaView style={styles.safeArea}>
          
          <View style={styles.header}>
            <View style={styles.badge}>
              <Feather name="phone" size={16} color="#FFF" style={{ marginRight: 8 }} />
              <HelixaText style={styles.badgeText}>Talk to a Nurse</HelixaText>
            </View>
          </View>

          <View style={styles.content}>
            <HelixaText weight="bold" style={styles.title}>
              Connecting you to{'\n'}a nurse...
            </HelixaText>
            <HelixaText style={styles.subtitle}>
              Please wait while we connect you with a certified maternal nurse
            </HelixaText>
            
            <View style={styles.waitBadge}>
              <HelixaText style={styles.waitText}>
                Average wait time: 30 seconds
              </HelixaText>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.cancelContent}>
                <Feather name="x" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <HelixaText style={styles.cancelText}>Cancel</HelixaText>
              </View>
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    width: '100%',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 16,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    color: '#FFF',
    fontSize: 34,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 40,
  },
  subtitle: {
    color: '#FFF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 20,
    opacity: 0.9,
  },
  waitBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  waitText: {
    color: '#FFF',
    fontSize: 14,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
  },
  cancelBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cancelContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
