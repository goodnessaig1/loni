import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../../components/HelixaText';
import { CareScreen, SectionTitle } from '../../components/care/CareParts';
import { useTheme } from '../../context/ThemeContext';
import { useWeeklyReport } from '../../hooks/useCare';
import { BRAND } from '../../lib/theme';
import { Reveal, RevealList } from '../../components/motion';

export default function WeeklyReportScreen() {
  const { colors, isDark } = useTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useWeeklyReport();

  return (
    <CareScreen title="Weekly Report" isLoading={isLoading} isError={isError} onRetry={refetch} onRefresh={refetch} refreshing={isRefetching}>
      {data && (
        <>
          <Reveal index={0}>
          <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: BRAND.pink, backgroundColor: colors.primarySoft }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="heart" size={18} color={BRAND.pink} />
            </View>
            <View style={{ flex: 1 }}>
              <HelixaText weight="bold" style={{ fontSize: 14, color: BRAND.pink }}>Your Weekly Health Report</HelixaText>
              <HelixaText style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 4 }}>
                {data.headline} You completed {data.completion_pct}% of your care plan in the last 7 days.
              </HelixaText>
            </View>
          </View>
          </Reveal>

          <Reveal index={1}>
          <SectionTitle>Observations</SectionTitle>
          </Reveal>
          <View style={{ gap: 10 }}>
            {data.observations.map((o, i) => (
              <RevealList key={o} index={2 + i}>
              <View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.surface }}>
                <HelixaText style={{ fontSize: 12, lineHeight: 19, color: colors.textSecondary }}>{o}</HelixaText>
              </View>
              </RevealList>
            ))}
          </View>

          {data.activities.length > 0 && (
            <>
              <Reveal index={3}>
              <SectionTitle>Completed care activities</SectionTitle>
              </Reveal>
              <View style={{ gap: 10 }}>
                {data.activities.map((a, i) => (
                  <RevealList key={a.key} index={4 + i}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: colors.surface }}>
                    <Feather name="check-circle" size={16} color={colors.textSecondary} />
                    <HelixaText style={{ flex: 1, fontSize: 13 }}>{a.title}</HelixaText>
                    <HelixaText style={{ fontSize: 12, color: colors.textSecondary }}>{a.days_done} of {a.of} days</HelixaText>
                  </View>
                  </RevealList>
                ))}
              </View>
            </>
          )}

          {data.missed.length > 0 && (
            <>
              <Reveal index={5}>
              <SectionTitle>Missed reminders</SectionTitle>
              </Reveal>
              <View style={{ gap: 10 }}>
                {data.missed.map((m, i) => (
                  <RevealList key={m.key} index={6 + i}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: isDark ? '#3A1A22' : '#FFE1E1' }}>
                    <Feather name="clock" size={16} color={isDark ? '#FCA5A5' : '#B91C1C'} />
                    <HelixaText style={{ flex: 1, fontSize: 13 }}>{m.title}</HelixaText>
                    <HelixaText style={{ fontSize: 11, color: isDark ? '#FCA5A5' : '#B91C1C' }}>{m.note}</HelixaText>
                  </View>
                  </RevealList>
                ))}
              </View>
            </>
          )}
        </>
      )}
    </CareScreen>
  );
}
