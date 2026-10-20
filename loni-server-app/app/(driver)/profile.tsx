import React from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { useDriverStats } from '../../hooks/useRides';
import { PressableScale, Reveal } from '../../components/motion';

const PINK = '#D62D88';

export default function DriverProfile() {
  const { user, logoutUser } = useAuth();
  const router = useRouter();
  const stats = useDriverStats();
  const dp = (user as any)?.driver_profile || {};

  const vehicle = [dp.vehicle_color, dp.vehicle_brand, dp.vehicle_model].filter(Boolean).join(' ') || 'Vehicle';

  const signOut = () =>
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logoutUser() },
    ]);

  const Row = ({ icon, label, value }: { icon: any; label: string; value: string }) => (
    <View style={styles.row}>
      <Feather name={icon} size={18} color="#6B6B6B" />
      <HelixaText style={styles.rowLabel}>{label}</HelixaText>
      <HelixaText weight="bold" style={styles.rowValue}>{value}</HelixaText>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Reveal index={0}>
        <CalText style={styles.heading}>Profile</CalText>
        </Reveal>

        <Reveal index={1}>
        <View style={styles.card}>
          <View style={styles.avatarRing}>
            <Avatar uri={user?.profilePicture || null} name={user?.name || 'Driver'} style={styles.avatar} />
          </View>
          <View style={styles.nameRow}>
            <HelixaText weight="black" style={styles.name}>{user?.name || 'Driver'}</HelixaText>
            <MaterialCommunityIcons name="check-decagram" size={16} color="#00C300" />
          </View>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <HelixaText style={styles.badgeText}>LONI Verified Driver</HelixaText>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <HelixaText weight="black" style={styles.statValue}>{(stats.data?.rating_avg ?? 0).toFixed(1)}</HelixaText>
              <HelixaText style={styles.statLabel}>Rating</HelixaText>
            </View>
            <View style={styles.stat}>
              <HelixaText weight="black" style={styles.statValue}>{stats.data?.total_trips ?? 0}</HelixaText>
              <HelixaText style={styles.statLabel}>Trips</HelixaText>
            </View>
            <View style={styles.stat}>
              <HelixaText weight="black" style={styles.statValue}>₦{(stats.data?.total_earnings ?? 0).toLocaleString()}</HelixaText>
              <HelixaText style={styles.statLabel}>Earned</HelixaText>
            </View>
          </View>
        </View>
        </Reveal>

        <Reveal index={2}>
        <View style={styles.section}>
          <Row icon="phone" label="Phone" value={user?.phone || '—'} />
          <Row icon="mail" label="Email" value={user?.email || '—'} />
          <Row icon="truck" label="Vehicle" value={vehicle} />
          <Row icon="hash" label="Plate" value={dp.plate_number || '—'} />
        </View>
        </Reveal>

        <Reveal index={3}>
        <PressableScale style={styles.editBtn} onPress={() => router.push('/edit-profile' as any)}>
          <Feather name="edit-2" size={16} color="#111" />
          <HelixaText weight="bold" style={styles.editText}>Edit profile</HelixaText>
        </PressableScale>
        <PressableScale style={styles.editBtn} onPress={() => router.push('/settings' as any)}>
          <Feather name="settings" size={16} color="#111" />
          <HelixaText weight="bold" style={styles.editText}>Settings</HelixaText>
        </PressableScale>
        <PressableScale style={styles.editBtn} onPress={() => router.push('/support' as any)}>
          <Feather name="help-circle" size={16} color="#111" />
          <HelixaText weight="bold" style={styles.editText}>Help & Support</HelixaText>
        </PressableScale>
        </Reveal>

        <Reveal index={4}>
        <PressableScale style={styles.signOut} onPress={signOut}>
          <Feather name="log-out" size={16} color={PINK} />
          <HelixaText weight="bold" style={styles.signOutText}>Sign Out</HelixaText>
        </PressableScale>
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  scroll: { paddingHorizontal: 21, paddingTop: 8, paddingBottom: 120 },
  heading: { fontSize: 24, color: '#000', marginBottom: 16 },
  card: { backgroundColor: '#F9FAFB', borderRadius: 24, padding: 20, alignItems: 'center' },
  avatarRing: { borderWidth: 2, borderColor: PINK, borderRadius: 44, padding: 4 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  name: { fontSize: 18, color: '#000' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#ECFDF3',
    borderRadius: 16, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#12B76A' },
  badgeText: { color: '#027A48', fontSize: 11 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', marginTop: 20 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 16, color: '#000' },
  statLabel: { fontSize: 12, color: '#6B6B6B', marginTop: 4 },
  section: { backgroundColor: '#F9FAFB', borderRadius: 16, marginTop: 16, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  rowLabel: { fontSize: 14, color: '#6B6B6B', flex: 1 },
  rowValue: { fontSize: 14, color: '#111' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 28, paddingVertical: 16, marginTop: 20,
  },
  editText: { fontSize: 15, color: '#111' },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFF1F2', borderRadius: 28, paddingVertical: 16, marginTop: 12,
  },
  signOutText: { fontSize: 15, color: PINK },
});
