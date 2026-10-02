import React, { useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { CustomSwitch } from '../../components/CustomSwitch';
import { ChangePasswordModal } from '../../components/profile/ChangePasswordModal';
import { useAuth } from '../../hooks/useAuth';

function Row({
  title, subtitle, value, onValueChange,
}: { title: string; subtitle: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardText}>
        <HelixaText style={styles.cardTitle} weight="bold">{title}</HelixaText>
        <HelixaText style={styles.cardSubtitle}>{subtitle}</HelixaText>
      </View>
      <CustomSwitch value={value} onValueChange={onValueChange} activeColor="#000000" />
    </View>
  );
}

export default function PartnerSettingsScreen() {
  const { logoutUser } = useAuth();
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);

  const signOut = () =>
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logoutUser() },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#000000" />
        </Pressable>
        <CalText style={styles.headerTitle}>Settings</CalText>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <HelixaText style={styles.sectionLabel} weight="bold">Notifications</HelixaText>
        <View style={styles.group}>
          <Row
            title="Push notifications"
            subtitle="New requests and trip updates"
            value={pushNotifications}
            onValueChange={setPushNotifications}
          />
          <Row
            title="Email updates"
            subtitle="Receipts and account summaries"
            value={emailUpdates}
            onValueChange={setEmailUpdates}
          />
          <Row
            title="SMS alerts"
            subtitle="Critical trip and safety alerts"
            value={smsAlerts}
            onValueChange={setSmsAlerts}
          />
        </View>

        <HelixaText style={styles.sectionLabel} weight="bold">Account</HelixaText>
        <View style={styles.group}>
          <Pressable style={styles.linkCard} onPress={() => setChangePasswordVisible(true)}>
            <HelixaText style={styles.cardTitle} weight="bold">Change password</HelixaText>
            <Feather name="chevron-right" size={20} color="#6B6B6B" />
          </Pressable>
        </View>

        <HelixaText style={styles.sectionLabel} weight="bold">About</HelixaText>
        <View style={styles.group}>
          <View style={styles.linkCard}>
            <HelixaText style={styles.cardTitle} weight="bold">App version</HelixaText>
            <HelixaText style={styles.versionText}>V1</HelixaText>
          </View>
        </View>

        <Pressable style={styles.signOut} onPress={signOut}>
          <Feather name="log-out" size={16} color="#D62D88" />
          <HelixaText weight="bold" style={styles.signOutText}>Sign Out</HelixaText>
        </Pressable>
      </ScrollView>

      <ChangePasswordModal visible={changePasswordVisible} onClose={() => setChangePasswordVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 21, paddingTop: 16,
  },
  backButton: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, color: '#000000' },
  scroll: { paddingHorizontal: 21, paddingTop: 24, paddingBottom: 60 },
  sectionLabel: { fontSize: 16, color: '#000000', marginBottom: 12 },
  group: { gap: 12, marginBottom: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 32,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDEFF2', borderRadius: 11,
    paddingHorizontal: 18, paddingVertical: 14,
    shadowColor: '#101828', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1,
  },
  cardText: { flex: 1, gap: 7 },
  cardTitle: { fontSize: 15, color: '#000000' },
  cardSubtitle: { fontSize: 14, color: '#535862' },
  linkCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDEFF2', borderRadius: 11,
    paddingHorizontal: 18, paddingVertical: 24,
    shadowColor: '#101828', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1,
  },
  versionText: { fontSize: 14, color: '#535862' },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFF1F2', borderRadius: 28, paddingVertical: 16, marginTop: 12,
  },
  signOutText: { fontSize: 15, color: '#D62D88' },
});
