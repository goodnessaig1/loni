import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { HelixaText } from '../../components/HelixaText';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CalText } from 'components/CalText';

export default function CallOngoingScreen() {
  const router = useRouter();
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return {
      minutes: m.toString(),
      seconds: `:${s < 10 ? '0' : ''}${s}`
    };
  };

  const timeParts = formatTime(secondsElapsed);

  const handleEndCall = () => {
    // Go back to the screen before the call
    router.back();
  };

  return (
    <View style={styles.container}>
      <StatusBar style='light' />
      <Image
        source={require('../../assets/images/nurse-img.png')}
        style={styles.bgImage}
        contentFit="cover"
      />

      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>

          <View style={styles.header}>
            <View style={styles.badge}>
              <View style={styles.soundBarsContainer}>
                <View style={[styles.soundBar, { height: 12 }]} />
                <View style={[styles.soundBar, { height: 16 }]} />
                <View style={[styles.soundBar, { height: 10 }]} />
              </View>
              <HelixaText style={styles.badgeText}>Call Ongoing</HelixaText>
            </View>

            <TouchableOpacity style={styles.iconButton}>
              <Feather name="mic" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.centerGraphic}>
            {/* Visualizer graphic over the nurse's chest per mockup */}
            <View style={styles.visualizerContainer}>
              <View style={[styles.bigBar, { height: 40 }]} />
              <View style={[styles.bigBar, { height: 60 }]} />
              <View style={[styles.bigBar, { height: 90 }]} />
              <View style={[styles.bigBar, { height: 60 }]} />
              <View style={[styles.bigBar, { height: 40 }]} />
            </View>
          </View>

          <View style={styles.infoContainer}>
            <View style={styles.timerContainer}>
              <CalText style={styles.timerMinutes}>
                {timeParts.minutes}
              </CalText>
              <CalText style={styles.timerSeconds}>
                {timeParts.seconds}
              </CalText>
            </View>
            <CalText style={styles.nurseName}>
              Micheal{'\n'}Gracia
            </CalText>

            <View style={styles.specialtyBadge}>
              <Feather name="settings" size={14} color="#FFF" style={{ marginRight: 6 }} />
              <HelixaText style={styles.specialtyText}>Maternal Health Specialist</HelixaText>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
              <Feather name="phone-off" size={24} color="#FFF" style={{ marginRight: 12 }} />
              <HelixaText style={styles.endCallText}>End Call</HelixaText>
            </TouchableOpacity>

            <HelixaText style={styles.secureText}>
              This call is confidential and secure
            </HelixaText>
          </View>

        </SafeAreaView>
      </View>
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // subtle dark overlay to make text readable
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  soundBarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  soundBar: {
    width: 2,
    backgroundColor: '#FFF',
    marginHorizontal: 1.5,
    borderRadius: 2,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerGraphic: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visualizerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bigBar: {
    width: 6,
    backgroundColor: '#FFF',
    marginHorizontal: 6,
    borderRadius: 4,
  },
  infoContainer: {
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 40,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  timerMinutes: {
    color: '#FFF',
    fontSize: 24,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  timerSeconds: {
    color: '#FFF',
    fontSize: 18,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  nurseName: {
    color: '#FFF',
    fontSize: 48,
    lineHeight: 52,
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  specialtyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  specialtyText: {
    color: '#FFF',
    fontSize: 14,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
  },
  endCallBtn: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 56,
    borderRadius: 28,
    marginBottom: 24,
  },
  endCallText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secureText: {
    color: '#FFF',
    fontSize: 14,
    opacity: 0.8,
  },
});
