import React from 'react';
import { View, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { Reveal, RevealList, PressableScale } from '../../components/motion';
import { useTrainingModules } from '../../hooks/useDriverTraining';
import { getDriverTrainingImage } from '../../lib/driverTrainingAssets';

export default function DriverTrainingScreen() {
  const { data, isLoading, isError, refetch } = useTrainingModules();

  const modules = data?.modules ?? [];
  const completed = data?.progress.completed_modules ?? [];
  const total = data?.progress.total_modules ?? modules.length;
  const isComplete = data?.progress.completed ?? false;

  const firstIncomplete = modules.find((m) => !completed.includes(m.id));

  const handleStart = () => {
    if (isComplete) {
      router.push('/(auth)/aptitude-intro');
      return;
    }
    const target = firstIncomplete ?? modules[0];
    if (target) {
      router.push({ pathname: '/(auth)/training-module', params: { order: String(target.order) } });
    }
  };

  const progressRatio = total > 0 ? completed.length / total : 0;
  const ctaTitle = isComplete
    ? 'Continue to Aptitude Test'
    : completed.length > 0
      ? 'Continue Training'
      : 'Start Training';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Feather name="chevron-left" size={28} color="black" />
        </Pressable>
        <CalText style={styles.headerTitle}>Driver Training</CalText>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#D62D88" />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <HelixaText style={styles.errorText}>{"Couldn't load the training. Please try again."}</HelixaText>
          <Pressable onPress={() => refetch()} style={styles.retry}>
            <HelixaText style={styles.retryText}>Retry</HelixaText>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Reveal index={0}>
              <View style={styles.heroWrap}>
                <Image
                  source={getDriverTrainingImage('driver-training')}
                  style={styles.hero}
                  contentFit="contain"
                />
              </View>

              <CalText style={styles.heading}>Before your first trip.</CalText>
              <HelixaText style={styles.subtitle}>
                Learn how LONI works, how to safely support mothers, and what to expect on every trip.
              </HelixaText>
            </Reveal>

            <Reveal index={1}>
              <View style={styles.card}>
                <View style={styles.progressRow}>
                  <HelixaText style={styles.progressLabel}>Progress</HelixaText>
                  <HelixaText style={styles.progressCount}>
                    {completed.length}/{total} Modules
                  </HelixaText>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.max(progressRatio * 100, 4)}%` }]} />
                </View>

                {modules.map((mod, i) => {
                  const done = completed.includes(mod.id);
                  return (
                    <RevealList key={mod.id} index={i}>
                      <PressableScale
                        style={styles.moduleRow}
                        onPress={() =>
                          router.push({
                            pathname: '/(auth)/training-module',
                            params: { order: String(mod.order) },
                          })
                        }
                      >
                        <View style={styles.moduleIconWrap}>
                          <Image
                            source={getDriverTrainingImage(mod.icon)}
                            style={styles.moduleIcon}
                            contentFit="cover"
                          />
                        </View>
                        <HelixaText style={styles.moduleTitle} numberOfLines={2}>
                          {mod.title}
                        </HelixaText>
                        {done ? (
                          <Feather name="check-circle" size={20} color="#22C55E" />
                        ) : (
                          <Feather name="chevron-right" size={20} color="#9CA3AF" />
                        )}
                      </PressableScale>
                    </RevealList>
                  );
                })}
              </View>
            </Reveal>
          </ScrollView>

          <Reveal index={2}>
            <View style={styles.footer}>
              <Button title={ctaTitle} onPress={handleStart} />
            </View>
          </Reveal>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, color: '#000000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#6B7280', textAlign: 'center', marginBottom: 12 },
  retry: { paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: '#D62D88', fontWeight: '600' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },
  heroWrap: { alignItems: 'center', marginTop: 8, marginBottom: 8 },
  hero: { width: '100%', height: 220 },
  heading: { fontSize: 26, lineHeight: 32, color: '#000000', textAlign: 'center', marginBottom: 10 },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 16,
    padding: 16,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 14, color: '#374151' },
  progressCount: { fontSize: 14, color: '#374151' },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F6D9E8',
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#D62D88' },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  moduleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  moduleIcon: { width: 40, height: 40 },
  moduleTitle: { flex: 1, fontSize: 15, color: '#111827', marginRight: 8 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
});
