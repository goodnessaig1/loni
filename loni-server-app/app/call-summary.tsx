import React from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { CalText } from '../components/CalText';
import { HelixaText } from '../components/HelixaText';
import { Button } from '../components/Button';
import { Avatar } from '../components/Avatar';
import { Reveal } from '../components/motion';

function duration(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Figma "Support session ended successfully" - shown to the nurse after a connected call. */
export default function CallSummaryScreen() {
  const { name, picture, trimester, seconds } = useLocalSearchParams<{
    callId: string; name?: string; picture?: string; trimester?: string; seconds?: string;
  }>();
  const secs = Number(seconds) || 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Reveal index={0}>
          <View style={styles.badgeOuter}>
            <View style={styles.badgeInner}>
              <MaterialCommunityIcons name="check-decagram" size={56} color="#D62D88" />
            </View>
          </View>
        </Reveal>
        <Reveal index={1} style={{ alignItems: 'center' }}>
          <View style={styles.pill}>
            <Feather name="check" size={12} color="#D62D88" />
            <HelixaText style={styles.pillText} weight="bold">Completed</HelixaText>
          </View>
          <CalText style={styles.title}>Support session ended successfully</CalText>
        </Reveal>

        <Reveal index={2} style={{ width: '100%' }}>
          <View style={styles.card}>
            <View style={styles.person}>
              <Avatar uri={picture || undefined} name={name || 'Mother'} style={styles.avatar} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <HelixaText weight="bold" style={styles.name}>{name || 'Mother'}</HelixaText>
                {!!trimester && trimester !== 'Unknown' && <HelixaText style={styles.sub}>{trimester}</HelixaText>}
              </View>
              <View style={styles.tag}>
                <HelixaText style={styles.tagText} weight="bold">Voice call</HelixaText>
              </View>
            </View>
            <View style={styles.row}>
              <HelixaText style={styles.label}>Duration</HelixaText>
              <HelixaText weight="bold" style={styles.value}>{duration(secs)}</HelixaText>
            </View>
            <View style={styles.row}>
              <HelixaText style={styles.label}>Ended</HelixaText>
              <HelixaText weight="bold" style={styles.value}>{format(new Date(), 'hh:mm a')}</HelixaText>
            </View>
          </View>
        </Reveal>
      </View>

      <Reveal index={3}>
        <Button title="Back to Dashboard" onPress={() => router.replace('/(tabs)')} style={styles.button} />
      </Reveal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 24 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badgeOuter: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#FDF0F7', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  badgeInner: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#FBE1EF', alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FDF0F7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginBottom: 12 },
  pillText: { color: '#D62D88', fontSize: 12 },
  title: { fontSize: 22, lineHeight: 28, textAlign: 'center', color: '#111827', marginBottom: 28 },
  card: { width: '100%', borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0', padding: 16 },
  person: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  name: { fontSize: 15, color: '#111827' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  tag: { backgroundColor: '#FDF0F7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagText: { color: '#D62D88', fontSize: 11 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  label: { fontSize: 13, color: '#6B7280' },
  value: { fontSize: 13, color: '#111827' },
  button: { marginBottom: 24 },
});
