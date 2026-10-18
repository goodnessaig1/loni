import React from 'react';
import { View, ScrollView, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { ScreenHeader } from '../../components/ScreenHeader';
import { partnerApi, PartnerMilestone } from '../../api/partner';

const PINK = '#D62D88';

function Step({ m, last }: { m: PartnerMilestone; last: boolean }) {
  const done = m.state !== 'upcoming';
  return (
    <View style={styles.step}>
      <View style={styles.rail}>
        <View style={[styles.dot, done ? styles.dotDone : styles.dotTodo, m.state === 'current' && styles.dotCurrent]}>
          {done && <Feather name="check" size={12} color="#FFF" />}
        </View>
        {!last && <View style={[styles.line, done ? { backgroundColor: '#22C55E' } : null]} />}
      </View>
      <View style={[styles.stepBody, !done && { opacity: 0.55 }]}>
        <HelixaText style={styles.week} weight="bold">Week {m.week}{m.state === 'current' ? ' · Now' : ''}</HelixaText>
        <HelixaText style={styles.stepTitle} weight="black">{m.title}</HelixaText>
        {m.state === 'current' && (
          <>
            <HelixaText style={styles.stepText}>{m.body}</HelixaText>
            {m.expect.map((e) => (
              <View key={e} style={styles.expectRow}>
                <View style={styles.bullet} />
                <HelixaText style={styles.stepText}>{e}</HelixaText>
              </View>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

/** Figma "Pregnancy Updates": her journey week by week - what has happened, now, and what's next. */
export default function PregnancyUpdatesScreen() {
  const { data, isLoading } = useQuery({ queryKey: ['partner', 'updates'], queryFn: partnerApi.getUpdates });
  const name = data?.inviter_name?.split(' ')[0] ?? 'Her';
  const isRecovery = data?.status === 'newMom';
  const current = data?.milestones.find((m) => m.state === 'current');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={isRecovery ? 'Recovery Updates' : 'Pregnancy Updates'} />
      {isLoading ? (
        <ActivityIndicator color={PINK} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <HelixaText style={styles.intro}>
            Follow {name}'s journey and see what she may be going through each week.
          </HelixaText>

          <View style={styles.hero}>
            <Image source={require('../../assets/images/partner-pregnant.png')} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
            <View style={styles.heroPill}>
              <HelixaText style={styles.heroPillText} weight="bold">
                {data?.week != null ? `${isRecovery ? 'Week' : 'Week'} ${data.week}${data.trimester ? ` · ${data.trimester}` : ''}` : 'Her journey'}
              </HelixaText>
            </View>
            <CalText style={styles.heroTitle}>{current?.title ?? (isRecovery ? 'Her recovery journey' : 'Her pregnancy journey')}</CalText>
          </View>

          {!data?.shared ? (
            <View style={styles.empty}>
              <Feather name="lock" size={18} color="#6B7280" />
              <HelixaText style={styles.emptyText}>{name} isn't sharing updates with you right now.</HelixaText>
            </View>
          ) : !data.milestones.length ? (
            <View style={styles.empty}>
              <HelixaText style={styles.emptyText}>Updates appear here while she is pregnant or recovering after birth.</HelixaText>
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              {data.milestones.map((m, i) => <Step key={m.week} m={m} last={i === data.milestones.length - 1} />)}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 21, paddingBottom: 60 },
  intro: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 16 },
  hero: { height: 170, borderRadius: 20, overflow: 'hidden', justifyContent: 'flex-end', padding: 16, marginBottom: 20 },
  heroPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  heroPillText: { fontSize: 12, color: PINK },
  heroTitle: { fontSize: 20, color: '#FFF' },
  step: { flexDirection: 'row' },
  rail: { width: 28, alignItems: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: '#22C55E' },
  dotTodo: { backgroundColor: '#E5E7EB' },
  dotCurrent: { backgroundColor: PINK },
  line: { width: 2, flex: 1, backgroundColor: '#E5E7EB', marginVertical: 2 },
  stepBody: { flex: 1, paddingLeft: 10, paddingBottom: 22 },
  week: { fontSize: 12, color: PINK },
  stepTitle: { fontSize: 15, color: '#111', marginTop: 2 },
  stepText: { fontSize: 13, color: '#4B5563', lineHeight: 19, marginTop: 6, flex: 1 },
  expectRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: PINK, marginTop: 13 },
  empty: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16 },
  emptyText: { flex: 1, fontSize: 14, color: '#4B5563' },
});
