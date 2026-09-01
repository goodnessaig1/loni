import React from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { useOnboarding } from '../../hooks/useDriverTraining';
import { ONBOARDING_ROUTE } from '../../lib/driverOnboarding';

export default function AptitudeResultScreen() {
  const params = useLocalSearchParams<{
    score?: string;
    total?: string;
    passed?: string;
    attemptsRemaining?: string;
  }>();

  const { data: onboarding } = useOnboarding();
  const passed = params.passed === '1';
  const score = Number(params.score ?? '0');
  const total = Number(params.total ?? '0');
  const attemptsRemaining = Number(params.attemptsRemaining ?? '0');

  const continueVerification = () =>
    router.replace(
      onboarding ? ONBOARDING_ROUTE[onboarding.current_step] : '/(auth)/complete-profile-driver'
    );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <View style={[styles.badge, passed ? styles.badgePass : styles.badgeFail]}>
          <Feather name={passed ? 'check' : 'x'} size={34} color="#FFFFFF" />
        </View>

        <CalText style={styles.title}>
          {passed ? 'You Passed!' : "You Didn't Pass This Attempt"}
        </CalText>
        <HelixaText style={styles.subtitle}>
          {passed
            ? 'Great work — you passed the LONI Driver Assessment.'
            : 'Review your training and try again.'}
        </HelixaText>

        <View style={styles.scorePill}>
          <HelixaText style={styles.scoreText}>
            Score: {score}/{total}
          </HelixaText>
        </View>

        {!passed && (
          <HelixaText style={styles.attemptsText}>
            {attemptsRemaining > 0
              ? `${attemptsRemaining} ${attemptsRemaining === 1 ? 'attempt' : 'attempts'} remaining. Ready when you are.`
              : "You've used all your attempts. Contact LONI Driver Support for next steps."}
          </HelixaText>
        )}
      </View>

      <View style={styles.footer}>
        {passed ? (
          <Button title="Continue Verification" onPress={continueVerification} />
        ) : attemptsRemaining > 0 ? (
          <>
            <Button
              title="Try Again"
              onPress={() => router.replace('/(auth)/aptitude-test')}
              style={{ marginBottom: 12 }}
            />
            <Button
              title="Review Training"
              onPress={() => router.replace('/(auth)/driver-training')}
              style={styles.ghost}
            />
          </>
        ) : (
          <Button
            title="Back to Dashboard"
            onPress={() => router.replace('/(auth)/verification-progress')}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  badgePass: { backgroundColor: '#22C55E' },
  badgeFail: { backgroundColor: '#EF4444' },
  title: { fontSize: 24, color: '#000000', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  scorePill: {
    backgroundColor: '#F3F4F6',
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  scoreText: { fontSize: 14, color: '#374151' },
  attemptsText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  footer: { paddingHorizontal: 24, paddingBottom: 24 },
  ghost: { backgroundColor: '#F9C2D9' },
});
