import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../../components/HelixaText';
import { CareScreen, SectionTitle, StageBanner } from '../../components/care/CareParts';
import { useTheme } from '../../context/ThemeContext';
import { useNutrition } from '../../hooks/useCare';
import { BRAND } from '../../lib/theme';
import { Reveal, RevealList } from '../../components/motion';

export default function NutritionScreen() {
  const { colors, isDark } = useTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useNutrition();

  const Card = ({ children }: { children: React.ReactNode }) => (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.card, padding: 16, marginBottom: 12 }}>{children}</View>
  );

  return (
    <CareScreen title="Nutrition Plan" isLoading={isLoading} isError={isError} onRetry={refetch} onRefresh={refetch} refreshing={isRefetching}>
      {data && (
        <>
          <Reveal index={0}>
          <StageBanner pill={data.stage === 'pregnancy' ? `Week ${data.week}` : data.stage === 'general' ? 'Wellness' : 'Recovery'} title="Today's Nutrition" />
          </Reveal>

          <View style={{ marginTop: 16 }}>
            <Reveal index={1}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="droplet" size={18} color={BRAND.pink} />
                </View>
                <HelixaText style={{ fontSize: 15 }}>{data.hydration.title}</HelixaText>
              </View>
              <View style={{ marginTop: 14, padding: 12, borderRadius: 10, backgroundColor: colors.surface }}>
                <HelixaText style={{ fontSize: 13 }}>
                  {data.hydration.goal_cups} cups ({data.hydration.liters} liters){' '}
                  <HelixaText style={{ fontSize: 12, color: colors.textSecondary }}>{data.hydration.note}</HelixaText>
                </HelixaText>
              </View>
            </Card>
            </Reveal>

            {data.meals.map((m, i) => (
              <RevealList key={m.slot} index={2 + i}>
              <Card>
                <HelixaText style={{ fontSize: 10, letterSpacing: 1, color: colors.textMuted }}>{m.slot.toUpperCase()}</HelixaText>
                <HelixaText weight="bold" style={{ fontSize: 15, marginTop: 6 }}>{m.name}</HelixaText>
                <HelixaText style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 6 }}>{m.description}</HelixaText>
              </Card>
              </RevealList>
            ))}
          </View>

          <Reveal index={3}>
          <SectionTitle>Healthy Snacks</SectionTitle>
          </Reveal>
          {data.snacks.map((s, i) => (
            <RevealList key={s.name} index={4 + i}>
            <Card>
              <HelixaText weight="bold" style={{ fontSize: 14 }}>{s.name}</HelixaText>
              <HelixaText style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 6 }}>{s.description}</HelixaText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {s.tags.map((t) => (
                  <View key={t} style={{ backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                    <HelixaText style={{ fontSize: 11, color: colors.textSecondary }}>{t}</HelixaText>
                  </View>
                ))}
              </View>
            </Card>
            </RevealList>
          ))}

          <Reveal index={5}>
          <View style={{ marginTop: 14, borderRadius: 16, padding: 16, backgroundColor: isDark ? '#3A1A22' : '#FFD9D9' }}>
            <HelixaText weight="bold" style={{ fontSize: 14, marginBottom: 12, color: isDark ? '#FCA5A5' : '#7F1D1D' }}>Foods to avoid</HelixaText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {data.avoid.map((f) => (
                <View key={f} style={{ backgroundColor: isDark ? '#4A242D' : '#FFF1F1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <HelixaText style={{ fontSize: 11, color: isDark ? '#FCA5A5' : '#7F1D1D' }}>{f}</HelixaText>
                </View>
              ))}
            </View>
          </View>
          </Reveal>
        </>
      )}
    </CareScreen>
  );
}
