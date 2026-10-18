import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { useAuth } from '../../hooks/useAuth';
import { getPostAuthRoute } from '../../lib/driverOnboarding';

const BRAND = '#D62D88';

/**
 * Figma "You're Ready to Support Mothers" (nurse) / "You're Ready to Drive" (driver):
 * shown once, right after an admin approves the account, then on to the role's dashboard.
 */
export default function ApprovedScreen() {
  const { user, refreshUser } = useAuth();
  const isDriver = user?.user_type === 'driver';

  // The approval may have arrived by push before the cached user was refreshed.
  useEffect(() => {
    if (user && user.account_status !== 'active') refreshUser?.().catch(() => {});
  }, [user?.account_status]);

  const vehicle = [user?.driver_profile?.vehicle_brand, user?.driver_profile?.vehicle_model].filter(Boolean).join(' ');
  const rows: Array<[string, string]> = isDriver
    ? [
        ['Vehicle', vehicle || '—'],
        ['Plate number', user?.driver_profile?.plate_number || '—'],
      ]
    : [
        ['Hospital', user?.nurse_profile?.hospital_affiliation || '—'],
        ['Experience', user?.nurse_profile?.years_of_experience != null ? `${user.nurse_profile.years_of_experience} years` : '—'],
      ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="heart-circle" size={64} color={BRAND} />
          <View style={styles.check}>
            <Feather name="check" size={16} color="#FFF" />
          </View>
        </View>

        <CalText style={styles.heading}>{isDriver ? "You're Ready to Drive" : "You're Ready to Support Mothers"}</CalText>
        <HelixaText style={styles.subtitle}>
          {isDriver
            ? "Your account has been verified. Go online whenever you're available and we'll send nearby emergency requests your way."
            : "Your account has been verified. Go online whenever you're available and mothers who need a nurse can reach you."}
        </HelixaText>

        <View style={styles.card}>
          <View style={styles.cardTop}>
            {user?.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <HelixaText weight="bold" style={{ color: '#FFF' }}>{(user?.name || '?').charAt(0)}</HelixaText>
              </View>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <HelixaText weight="bold" style={styles.name}>{user?.name}</HelixaText>
              <View style={styles.verifiedRow}>
                <View style={styles.dot} />
                <HelixaText style={styles.verified}>Verified</HelixaText>
              </View>
            </View>
          </View>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.row}>
              <HelixaText style={styles.rowLabel}>{label}</HelixaText>
              <HelixaText weight="bold" style={styles.rowValue}>{value}</HelixaText>
            </View>
          ))}
        </View>

        <Button title="Go to Dashboard" onPress={() => router.replace(getPostAuthRoute(user))} style={styles.button} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  badge: { marginBottom: 28 },
  check: {
    position: 'absolute', right: -2, bottom: 2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF',
  },
  heading: { fontSize: 24, lineHeight: 30, color: '#000', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, lineHeight: 22, color: '#6B7280', textAlign: 'center', marginBottom: 28 },
  card: { width: '100%', borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0', padding: 16, marginBottom: 32 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, color: '#111' },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 6 },
  verified: { fontSize: 12, color: '#16A34A' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  rowLabel: { fontSize: 13, color: '#6B7280' },
  rowValue: { fontSize: 13, color: '#111' },
  button: { width: '100%' },
});
