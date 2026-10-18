import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HelixaText } from '../../components/HelixaText';
import { CareScreen, StageBanner } from '../../components/care/CareParts';
import { useTheme } from '../../context/ThemeContext';
import { useLabourTopics } from '../../hooks/useCare';
import { Reveal, RevealList } from '../../components/motion';

export default function LabourPrepScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useLabourTopics();

  return (
    <CareScreen title="Labour Prep" isLoading={isLoading} isError={isError} onRetry={refetch} onRefresh={refetch} refreshing={isRefetching}>
      {data && (
        <>
          <Reveal index={0}>
          <StageBanner pill="Premium Guide" title="Labour Preparation" />
          </Reveal>
          <View style={{ marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.card }}>
            {data.topics.map((t, i) => (
              <RevealList key={t.slug} index={1 + i}>
              <TouchableOpacity
                activeOpacity={0.7}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/care/labour/[slug]', params: { slug: t.slug } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.divider }}
              >
                <View style={{ flex: 1 }}>
                  <HelixaText style={{ fontSize: 14 }}>{t.title}</HelixaText>
                  <HelixaText style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: 3 }}>{t.summary}</HelixaText>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              </RevealList>
            ))}
          </View>
          <Reveal index={Math.min(1 + data.topics.length, 8)}>
          <HelixaText style={{ fontSize: 11, lineHeight: 17, color: colors.textMuted, marginTop: 14, textAlign: 'center' }}>{data.disclaimer}</HelixaText>
          </Reveal>
        </>
      )}
    </CareScreen>
  );
}
