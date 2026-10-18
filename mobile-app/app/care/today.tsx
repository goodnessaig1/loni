import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { HelixaText } from '../../components/HelixaText';
import { CareCard } from '../../components/home/CareCard';
import { CareScreen, Checkbox, Chip } from '../../components/care/CareParts';
import { useTheme } from '../../context/ThemeContext';
import { useTodayPlan, useToggleTask } from '../../hooks/useCare';
import { BRAND } from '../../lib/theme';
import { Reveal, RevealList } from '../../components/motion';
import type { TaskCategory } from '../../api/care';

const TABS: { id: 'all' | TaskCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'body', label: 'Body' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'mind', label: 'Mind' },
];

export default function TodaysCareScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: plan, isLoading, isError, refetch, isRefetching } = useTodayPlan();
  const toggle = useToggleTask();
  const [tab, setTab] = useState<'all' | TaskCategory>('all');

  const tasks = plan?.tasks.filter((t) => tab === 'all' || t.category === tab) ?? [];
  const subtitle = plan
    ? `Hydration, nutrition, exercise, and wellness personalized for ${plan.stage === 'general' ? 'you' : plan.stage === 'postpartum' ? 'your recovery' : `week ${plan.week}`}.`
    : undefined;

  const count = (id: 'all' | TaskCategory) => {
    if (!plan) return '';
    const c = id === 'all' ? { done: plan.done, total: plan.total } : plan.categories[id];
    return c ? ` ${c.done}/${c.total}` : '';
  };

  return (
    <CareScreen title="Today's Care" subtitle={subtitle} isLoading={isLoading} isError={isError} onRetry={refetch} onRefresh={refetch} refreshing={isRefetching}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
        {TABS.map((t) => (
          <Chip key={t.id} label={`${t.label}${count(t.id)}`} selected={tab === t.id} onPress={() => setTab(t.id)} />
        ))}
      </ScrollView>

      <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.card }}>
        {tasks.map((t, i) => (
          <RevealList key={t.key} index={i}>
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: t.done }}
            accessibilityLabel={`${t.title}. ${t.subtitle}`}
            onPress={() =>
              toggle.mutate(
                { key: t.key, done: !t.done },
                { onError: (e: any) => Toast.show({ type: 'error', text1: 'Could not save', text2: e?.response?.data?.message || e?.message }) },
              )
            }
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.divider }}
          >
            <Checkbox checked={t.done} />
            <View style={{ flex: 1 }}>
              <HelixaText style={{ fontSize: 14 }}>{t.title}</HelixaText>
              <HelixaText style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t.subtitle}</HelixaText>
            </View>
            <HelixaText style={{ fontSize: 11, color: t.done ? BRAND.pink : colors.textMuted }}>{t.done ? 'Completed' : 'Pending'}</HelixaText>
          </TouchableOpacity>
          </RevealList>
        ))}
      </View>

      <Reveal index={Math.min(tasks.length, 8)}>
      <View style={{ marginTop: 20 }}>
        <CareCard tone="orange" title="Nutrition Plan" icon="coffee" description="View today's personalized meal recommendations." onPress={() => router.push('/care/nutrition')} />
      </View>
      </Reveal>
    </CareScreen>
  );
}
