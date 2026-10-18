import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { HelixaText } from '../components/HelixaText';
import { PregnancyCard } from '../components/home/PregnancyCard';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { BRAND } from '../lib/theme';
import { getPregnancyProgress } from '../lib/pregnancy';
import { babyUpdate, changesForYou, MILESTONES, milestoneState } from '../lib/journey';

const GREEN = '#16A34A';
const CORAL = '#FF4D2E';

/** "Your Journey": this week's baby update, what to expect, and the pregnancy milestone timeline. */
export default function JourneyScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const progress = getPregnancyProgress(user);

  if (!progress || progress.kind !== 'pregnant') return <Redirect href="/recovery" />;

  const { week } = progress;
  const changes = changesForYou(week);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ width: 44, height: 44, justifyContent: 'center', marginTop: 8 }}
        >
          <Feather name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>

        <HelixaText weight="bold" style={{ fontSize: 26, marginTop: 6, marginBottom: 8 }}>Your Journey</HelixaText>
        <HelixaText style={{ fontSize: 14, lineHeight: 21, color: colors.textSecondary, marginBottom: 22 }}>{babyUpdate(week)}</HelixaText>

        <PregnancyCard progress={progress} />

        <View style={{ marginTop: 16, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <IconTile name="heart" />
            <HelixaText style={{ fontSize: 15 }}>Changes for you</HelixaText>
          </View>
          <HelixaText style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginBottom: 14 }}>{changes.text}</HelixaText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {changes.chips.map((chip) => (
              <View key={chip} style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
                <HelixaText style={{ fontSize: 12, color: BRAND.pink }}>{chip}</HelixaText>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 12 }}>
          <IconTile name="flag" />
          <HelixaText style={{ fontSize: 15 }}>Milestones</HelixaText>
        </View>

        <View style={{ paddingVertical: 12, paddingHorizontal: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.card }}>
          {MILESTONES.map((m, i) => {
            const state = milestoneState(m.week, week);
            const last = i === MILESTONES.length - 1;
            const fill = state === 'done' ? GREEN : state === 'current' ? CORAL : colors.surface;
            const nextDone = !last && milestoneState(MILESTONES[i + 1].week, week) !== 'upcoming';
            return (
              <View key={m.week} style={{ flexDirection: 'row', gap: 14, minHeight: 64 }} accessible accessibilityLabel={`Week ${m.week}, ${m.title}, ${state}`}>
                <View style={{ alignItems: 'center', width: 30 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: fill, alignItems: 'center', justifyContent: 'center' }}>
                    {state === 'upcoming' ? (
                      <Feather name="more-horizontal" size={14} color={colors.textMuted} />
                    ) : (
                      <Feather name="check" size={16} color="#FFFFFF" />
                    )}
                  </View>
                  {!last && (
                    <View style={{ flex: 1, width: 1.5, marginVertical: 2, backgroundColor: nextDone ? GREEN : colors.divider }} />
                  )}
                </View>
                <View style={{ paddingTop: 1 }}>
                  <HelixaText style={{ fontSize: 12, color: state === 'upcoming' ? colors.textMuted : colors.textSecondary }}>Week {m.week}</HelixaText>
                  <HelixaText
                    style={{
                      fontSize: 15,
                      marginTop: 2,
                      color: state === 'current' ? CORAL : state === 'upcoming' ? colors.textMuted : colors.text,
                    }}
                  >
                    {m.title}
                  </HelixaText>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const IconTile = ({ name }: { name: React.ComponentProps<typeof Feather>['name'] }) => {
  const { colors } = useTheme();
  return (
    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={name} size={18} color={colors.textSecondary} />
    </View>
  );
};
