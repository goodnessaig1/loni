import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { HelixaText } from '../../../components/HelixaText';
import { CareScreen } from '../../../components/care/CareParts';
import { useTheme } from '../../../context/ThemeContext';
import { useLabourTopic } from '../../../hooks/useCare';
import { Reveal, RevealList } from '../../../components/motion';

export default function LabourTopicScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { data, isLoading, isError, refetch } = useLabourTopic(String(slug));

  return (
    <CareScreen title={data?.title ?? 'Labour Prep'} subtitle={data?.intro} isLoading={isLoading} isError={isError} onRetry={refetch}>
      {data && (
        <>
          <View style={{ gap: 12 }}>
            {data.sections.map((s, i) => (
              <RevealList key={s.heading} index={i}>
              <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.card }}>
                <HelixaText weight="bold" style={{ fontSize: 14, marginBottom: 8 }}>{s.heading}</HelixaText>
                <HelixaText style={{ fontSize: 13, lineHeight: 21, color: colors.textSecondary }}>{s.body}</HelixaText>
              </View>
              </RevealList>
            ))}
          </View>
          <Reveal index={Math.min(data.sections.length, 8)}>
          <HelixaText style={{ fontSize: 11, lineHeight: 17, color: colors.textMuted, marginTop: 16, textAlign: 'center' }}>{data.disclaimer}</HelixaText>
          </Reveal>
        </>
      )}
    </CareScreen>
  );
}
