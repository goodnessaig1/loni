import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { ScreenHeader } from '../../components/ScreenHeader';
import { LEGAL } from '../../lib/legal';
import { Reveal, RevealList } from '../../components/motion';

/** /legal/privacy and /legal/terms */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = LEGAL[doc === 'terms' ? 'terms' : 'privacy'];
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Reveal index={0}>
        <ScreenHeader title={content.title} />
      </Reveal>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Reveal index={1}>
          <HelixaText style={styles.updated}>Last updated {content.updated}</HelixaText>
          <HelixaText style={styles.p}>{content.intro}</HelixaText>
        </Reveal>
        {content.sections.map((s, i) => (
          <RevealList key={s.title} index={i} delay={140}>
            <View style={styles.section}>
              <CalText style={styles.h}>{`${i + 1}. ${s.title}`}</CalText>
              {s.paragraphs.map((p, j) => <HelixaText key={j} style={styles.p}>{p}</HelixaText>)}
            </View>
          </RevealList>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 21, paddingTop: 8, paddingBottom: 48 },
  updated: { fontSize: 12, color: '#9CA3AF', marginBottom: 16 },
  section: { borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 12, padding: 16, marginTop: 14 },
  h: { fontSize: 16, color: '#111827', marginBottom: 8 },
  p: { fontSize: 14, lineHeight: 21, color: '#4B5563', marginBottom: 8 },
});
