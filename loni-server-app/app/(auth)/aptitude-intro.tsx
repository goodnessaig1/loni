import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { Reveal } from '../../components/motion';
import { useAptitudeStatus, useOnboarding } from '../../hooks/useDriverTraining';
import { ONBOARDING_ROUTE } from '../../lib/driverOnboarding';

export default function AptitudeIntroScreen() {
  const { data: status, isLoading, isError, refetch } = useAptitudeStatus();
  const { data: onboarding } = useOnboarding();

  // Can't take the test before finishing training.
  useEffect(() => {
    if (onboarding?.current_step === 'training') {
      router.replace('/(auth)/driver-training');
    }
  }, [onboarding?.current_step]);

  const goNext = () =>
    router.replace(
      onboarding ? ONBOARDING_ROUTE[onboarding.current_step] : '/(auth)/complete-profile-driver'
    );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Feather name="chevron-left" size={28} color="black" />
        </Pressable>
        <CalText style={styles.headerTitle}>Aptitude Test</CalText>
        <View style={styles.backButton} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#D62D88" />
        </View>
      ) : isError || !status ? (
        <View style={styles.centered}>
          <HelixaText style={styles.muted}>{"Couldn't load the assessment. Please try again."}</HelixaText>
          <Pressable onPress={() => refetch()} style={styles.retry}>
            <HelixaText style={styles.retryText}>Retry</HelixaText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.body}>
          <Reveal index={0}>
            <CalText style={styles.heading}>
              {status.passed ? 'Assessment passed' : 'Ready to test your knowledge?'}
            </CalText>
            <HelixaText style={styles.subtitle}>
              {status.passed
                ? 'Great work — you passed the LONI Driver Assessment. Continue your driver verification.'
                : 'Complete the assessment to continue your LONI driver verification.'}
            </HelixaText>
          </Reveal>

          <Reveal index={1}>
            {!status.passed && (
              <>
                <View style={styles.statRow}>
                  <View style={styles.statCard}>
                    <HelixaText style={styles.statLabel}>Questions</HelixaText>
                    <CalText style={styles.statValue}>{status.question_count}</CalText>
                  </View>
                  <View style={styles.statCard}>
                    <HelixaText style={styles.statLabel}>Attempts Remaining</HelixaText>
                    <CalText style={styles.statValue}>{status.attempts_remaining}</CalText>
                  </View>
                </View>

                <View style={styles.infoBox}>
                  <View style={styles.infoBar} />
                  <HelixaText style={styles.infoText}>
                    You need to answer at least {status.pass_score} of {status.question_count} questions
                    correctly to pass. Take your time.
                  </HelixaText>
                </View>
              </>
            )}

            {!status.can_attempt && !status.passed && (
              <View style={styles.blockedBox}>
                <HelixaText style={styles.blockedText}>
                  {`You've used all ${status.max_attempts} attempts. Please contact LONI Driver Support for next steps.`}
                </HelixaText>
              </View>
            )}
          </Reveal>

          <Reveal index={2} style={{ marginTop: 'auto' }}>
            <View style={styles.footer}>
              {status.passed ? (
                <Button title="Continue" onPress={goNext} />
              ) : status.can_attempt ? (
                <Button title="Start Test" onPress={() => router.push('/(auth)/aptitude-test')} />
              ) : (
                <Button title="Back to Training" onPress={() => router.replace('/(auth)/driver-training')} />
              )}
            </View>
          </Reveal>
        </View>
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
  muted: { color: '#6B7280', textAlign: 'center', marginBottom: 12 },
  retry: { paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: '#D62D88', fontWeight: '600' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
  heading: { fontSize: 26, lineHeight: 34, color: '#000000', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 28 },
  statRow: { flexDirection: 'row', gap: 14, marginBottom: 18 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EDEDED',
    borderRadius: 14,
    padding: 16,
  },
  statLabel: { fontSize: 13, color: '#9CA3AF', marginBottom: 12 },
  statValue: { fontSize: 22, color: '#111827' },
  infoBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#EDEDED',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  infoBar: { width: 3, borderRadius: 2, backgroundColor: '#22C55E' },
  infoText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 20 },
  blockedBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
  },
  blockedText: { fontSize: 13, color: '#B42318', lineHeight: 20 },
  footer: { marginTop: 'auto', paddingBottom: 16 },
});
