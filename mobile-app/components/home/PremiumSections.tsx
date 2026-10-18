import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HelixaText } from '../HelixaText';
import { CareCard } from './CareCard';
import { useCareOverview } from '../../hooks/useCare';
import { useTheme } from '../../context/ThemeContext';
import { relativeTime } from '../../lib/relativeTime';

/** The LoniPlus block under the home grid: care plan, weekly report, hospital bag, labour prep, recent activity. */
export const PremiumSections = () => {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: o } = useCareOverview();

  const week = o?.week;
  const postpartum = o?.stage === 'postpartum';
  const general = o?.stage === 'general';

  return (
    <View style={{ marginTop: 28, gap: 14 }}>
      <CareCard
        tone="orange"
        title="Today's Care Plan"
        icon="calendar"
        description={`Hydration, nutrition, exercise, and wellness personalized for ${general ? 'you' : postpartum ? 'your recovery' : `week ${week ?? ''}`.trim()}.`}
        meta={o ? `${o.today.done} of ${o.today.total} done today` : undefined}
        onPress={() => router.push('/care/today')}
      />
      <CareCard
        tone="blue"
        title="Weekly Health Report"
        icon="file-text"
        description="Your week at a glance: care completed, observations, and gentle reminders."
        meta={o ? `${o.report.completion_pct}% of your plan this week` : undefined}
        onPress={() => router.push('/care/report')}
      />
      {!general && (
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <CareCard
          compact
          tone="pink"
          title="Hospital Bag"
          icon="briefcase"
          description="Interactive packing checklist"
          meta={o ? `${o.bag.done} of ${o.bag.total} packed` : undefined}
          onPress={() => router.push('/care/hospital-bag')}
        />
        <CareCard
          compact
          tone="blue"
          title="Labour Prep"
          icon="book-open"
          description="Step-by-step preparation guides"
          onPress={() => router.push('/care/labour')}
        />
      </View>
      )}

      {o && o.recent.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <HelixaText style={{ fontSize: 14, marginBottom: 12 }}>This week</HelixaText>
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.card, paddingHorizontal: 14 }}>
            {o.recent.map((r, i) => (
              <View
                key={`${r.key}-${r.at}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.divider }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="check" size={16} color={colors.textSecondary} />
                </View>
                <View>
                  <HelixaText style={{ fontSize: 14 }}>{r.title}</HelixaText>
                  <HelixaText style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{relativeTime(r.at)}</HelixaText>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};
