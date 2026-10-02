import React from 'react';
import { View, Image, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { CalText } from '../CalText';
import { HelixaText } from '../HelixaText';
import { relativeTimeWithClock } from '../../lib/relativeTime';

interface Props {
  inviterName: string;
  rideId: number;
  requestedAt: string | null;
  style?: object;
}

export function EmergencyAlertCard({ inviterName, rideId, requestedAt, style }: Props) {
  return (
    <Pressable
      style={[styles.alertCard, style]}
      onPress={() => router.push(`/partner/ride/${rideId}` as any)}
    >
      <View style={styles.alertTextBlock}>
        <CalText style={styles.alertTitle}>Emergency alert</CalText>
        <HelixaText style={styles.alertBody} weight="bold">
          {inviterName} may need your help.
        </HelixaText>
        <HelixaText style={styles.alertTime} weight="bold">
          {relativeTimeWithClock(requestedAt)}
        </HelixaText>
        <View style={styles.alertButton}>
          <HelixaText style={styles.alertButtonText} weight="black">Open emergency alert</HelixaText>
        </View>
      </View>
      <Image source={require('../../assets/images/partner-3d-alert.png')} style={styles.alertImage} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  alertCard: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(250,53,50,0.24)',
    borderRadius: 25,
    padding: 18,
    overflow: 'visible',
  },
  alertTextBlock: { gap: 14 },
  alertTitle: { fontSize: 16, color: '#FFFFFF' },
  alertBody: { fontSize: 15, color: '#FFFFFF', opacity: 0.84, marginTop: 2 },
  alertTime: { fontSize: 13, color: '#FFFFFF', opacity: 0.84 },
  alertButton: {
    backgroundColor: '#FFFFFF', borderRadius: 26, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
  },
  alertButtonText: { fontSize: 13, color: '#000000' },
  alertImage: {
    position: 'absolute', top: -26, right: -12, width: 92, height: 94,
    transform: [{ rotate: '6deg' }],
  },
});
