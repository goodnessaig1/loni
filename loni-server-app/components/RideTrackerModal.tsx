import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { HelixaText } from './HelixaText';
import { useRouter } from 'expo-router';

// Helper to simulate the state transitions
export type RideState = 'finding' | 'dispatching' | 'accepted';

interface RideTrackerModalProps {
  onClose: () => void;
}

export default function RideTrackerModal({ onClose }: RideTrackerModalProps) {
  const router = useRouter();
  const [rideState, setRideState] = useState<RideState>('finding');

  useEffect(() => {
    // Simulate finding a driver
    const timer1 = setTimeout(() => {
      setRideState('dispatching');
    }, 3000);

    // Simulate driver accepting
    const timer2 = setTimeout(() => {
      setRideState('accepted');
    }, 6000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const handleTalkToNurse = () => {
    // Go to nurse connecting screen while keeping modal alive in background if possible,
    // but since modal is on index, we just navigate.
    router.push('/nurse/connecting');
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Header content depends on state */}
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Feather name="truck" size={24} color="#FFF" />
          </View>
          <View style={styles.headerText}>
            {rideState === 'finding' && (
              <>
                <HelixaText weight="bold" style={styles.title}>Finding the nearest driver...</HelixaText>
                <HelixaText style={styles.subtitle}>We're locating the fastest available ride for you right now.</HelixaText>
              </>
            )}
            {rideState === 'dispatching' && (
              <>
                <HelixaText weight="bold" style={styles.title}>Help is on the way</HelixaText>
                <HelixaText style={styles.subtitle}>David accepted your request and is heading to your location.</HelixaText>
              </>
            )}
            {rideState === 'accepted' && (
              <>
                <HelixaText weight="bold" style={styles.title}>Help is on the way</HelixaText>
                <HelixaText style={styles.subtitle}>David accepted your request and is heading to your location.</HelixaText>
              </>
            )}
          </View>
          <TouchableOpacity style={styles.expandBtn}>
            <Feather name="maximize-2" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Driver Details (only when accepted) */}
        {rideState === 'accepted' && (
          <View style={styles.driverSection}>
            <View style={styles.driverInfo}>
              <View style={styles.driverAvatar}>
                {/* Placeholder for driver image */}
                <Image
                  source={{ uri: 'https://i.pravatar.cc/150?u=david' }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                  contentFit="cover"
                />
              </View>
              <View>
                <HelixaText weight="bold" style={styles.carName}>Toyota Camry</HelixaText>
                <HelixaText style={styles.etaText}>12min | 3.2 miles</HelixaText>
              </View>
            </View>
            <TouchableOpacity style={styles.callDriverBtn}>
              <Feather name="phone" size={14} color="#FFF" style={{ marginRight: 6 }} />
              <HelixaText style={styles.callDriverText}>Call Driver</HelixaText>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Row */}
        <View style={styles.actionRow}>
          <HelixaText style={styles.whileYouWaitText}>While you wait</HelixaText>
          <TouchableOpacity style={styles.talkToNurseBtn} onPress={handleTalkToNurse}>
            <Feather name="phone-call" size={16} color="#FFF" style={{ marginRight: 8 }} />
            <HelixaText style={styles.talkToNurseText}>Talk to a Nurse</HelixaText>
          </TouchableOpacity>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Feather name="x" size={16} color="#FFF" style={{ marginRight: 8 }} />
          <HelixaText style={styles.cancelBtnText}>Cancel Request</HelixaText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50, // Below status bar
    left: 16,
    right: 16,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  card: {
    backgroundColor: '#000000', // Very dark or black from mockup
    borderRadius: 24,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    marginBottom: 4,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 20,
  },
  expandBtn: {
    padding: 4,
  },
  driverSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D62D88',
    marginRight: 12,
    overflow: 'hidden',
  },
  carName: {
    color: '#FFF',
    fontSize: 16,
    marginBottom: 2,
  },
  etaText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  callDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  callDriverText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
  },
  whileYouWaitText: {
    color: '#D1D5DB',
    fontSize: 14,
  },
  talkToNurseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  talkToNurseText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B91C1C',
    paddingVertical: 12,
    borderRadius: 24,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  cancelBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
