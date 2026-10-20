import React from 'react';
import { View, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { HelixaText } from '../components/HelixaText';
import { CustomSwitch } from '../components/CustomSwitch';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../hooks/useAuth';
import { useAccountSettings, useUpdateSetting } from '../hooks/useAccount';
import type { AccountPrefs } from '../api/account';
import { PressableScale, Reveal } from '../components/motion';

type Key = keyof AccountPrefs;

/**
 * Which switches each role sees. Every one is honoured: `incoming_calls` and `push` by the server
 * (account module + NotificationService), `call_sounds` by this device's ringtone (lib/localPrefs.ts).
 * Safety pushes (emergency alerts, ride and call events) always go out.
 */
const PUSH_NOTE = 'Emergency alerts and call or trip updates always come through';
const ROWS: Record<string, Array<{ key: Key; title: string; subtitle: string; disabled?: boolean }>> = {
  nurse: [
    { key: 'incoming_calls', title: 'Incoming calls', subtitle: 'Ring me when a mother needs a nurse' },
    { key: 'call_sounds', title: 'Call sounds', subtitle: 'Play a ringtone for incoming calls' },
    { key: 'push', title: 'Other notifications', subtitle: PUSH_NOTE },
  ],
  driver: [
    { key: 'call_sounds', title: 'Call sounds', subtitle: 'Play a ringtone when a passenger calls' },
    { key: 'push', title: 'Other notifications', subtitle: PUSH_NOTE },
  ],
  partner: [
    { key: 'push', title: 'Push notifications', subtitle: "Her pregnancy updates. Emergency alerts always come through" },
    { key: 'sms_alerts', title: 'SMS alerts', subtitle: 'Coming soon', disabled: true },
  ],
};

function Toggle({ title, subtitle, value, disabled, onChange }: {
  title: string; subtitle: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={[styles.card, disabled && { opacity: 0.5 }]}>
      <View style={styles.cardText}>
        <HelixaText style={styles.cardTitle} weight="bold">{title}</HelixaText>
        <HelixaText style={styles.cardSubtitle}>{subtitle}</HelixaText>
      </View>
      <CustomSwitch value={value} onValueChange={disabled ? () => {} : onChange} activeColor="#000000" />
    </View>
  );
}

function Link({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable style={styles.linkCard} onPress={onPress}>
      <HelixaText style={styles.cardTitle} weight="bold">{title}</HelixaText>
      <Feather name="chevron-right" size={20} color="#6B6B6B" />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user, logoutUser } = useAuth();
  const { data: prefs } = useAccountSettings();
  const update = useUpdateSetting();
  const rows = ROWS[user?.user_type ?? ''] ?? ROWS.partner;

  const set = (key: Key, value: boolean) =>
    update.mutate({ [key]: value }, {
      onError: () => Toast.show({ type: 'error', text1: 'Could not save that setting', text2: 'Check your connection and try again.' }),
    });

  const signOut = () =>
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logoutUser() },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Reveal index={0}>
        <ScreenHeader title="Settings" />
      </Reveal>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Reveal index={1}>
          <HelixaText style={styles.sectionLabel} weight="bold">Notifications</HelixaText>
          <View style={styles.group}>
            {rows.map((r) => (
              <Toggle key={r.key} title={r.title} subtitle={r.subtitle} disabled={r.disabled || !prefs}
                value={!!prefs?.[r.key]} onChange={(v) => set(r.key, v)} />
            ))}
          </View>
        </Reveal>

        <Reveal index={2}>
          <HelixaText style={styles.sectionLabel} weight="bold">Account</HelixaText>
          <View style={styles.group}>
            <Link title="Change password" onPress={() => router.push('/change-password' as any)} />
            <Link title="Help & Support" onPress={() => router.push('/support' as any)} />
          </View>
        </Reveal>

        <Reveal index={3}>
          <HelixaText style={styles.sectionLabel} weight="bold">About</HelixaText>
          <View style={styles.group}>
            <Link title="Privacy Policy" onPress={() => router.push('/legal/privacy' as any)} />
            <Link title="Terms of Service" onPress={() => router.push('/legal/terms' as any)} />
            <View style={styles.linkCard}>
              <HelixaText style={styles.cardTitle} weight="bold">App version</HelixaText>
              <HelixaText style={styles.versionText}>{Constants.expoConfig?.version ?? '1.0.0'}</HelixaText>
            </View>
          </View>
        </Reveal>

        <Reveal index={4}>
          <PressableScale style={styles.signOut} onPress={signOut}>
            <Feather name="log-out" size={16} color="#D62D88" />
            <HelixaText weight="bold" style={styles.signOutText}>Sign Out</HelixaText>
          </PressableScale>
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  );
}

const shadow = { shadowColor: '#101828', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1 };
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 21, paddingTop: 16, paddingBottom: 60 },
  sectionLabel: { fontSize: 16, color: '#000000', marginBottom: 12 },
  group: { gap: 12, marginBottom: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDEFF2', borderRadius: 11,
    paddingHorizontal: 18, paddingVertical: 14, ...shadow,
  },
  cardText: { flex: 1, gap: 6 },
  cardTitle: { fontSize: 15, color: '#000000' },
  cardSubtitle: { fontSize: 13, color: '#535862' },
  linkCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDEFF2', borderRadius: 11,
    paddingHorizontal: 18, paddingVertical: 20, ...shadow,
  },
  versionText: { fontSize: 14, color: '#535862' },
  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFF1F2', borderRadius: 28, paddingVertical: 16, marginTop: 12,
  },
  signOutText: { fontSize: 15, color: '#D62D88' },
});
