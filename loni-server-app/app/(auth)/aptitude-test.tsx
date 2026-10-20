import React, { useMemo, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { Reveal, RevealList, PressableScale } from '../../components/motion';
import { useAptitudeQuestions, useSubmitAptitude } from '../../hooks/useDriverTraining';

const PAGE_SIZE = 5;

export default function AptitudeTestScreen() {
  const { data, isLoading, isError } = useAptitudeQuestions();
  const { mutateAsync: submit, isPending } = useSubmitAptitude();

  const questions = useMemo(() => data?.questions ?? [], [data?.questions]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
  const pageQuestions = useMemo(
    () => questions.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [questions, page]
  );
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length && questions.length > 0;
  const isLastPage = page >= pageCount - 1;

  const select = (questionId: number, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    try {
      const payload = questions.map((q) => ({
        question_id: q.id,
        selected_index: answers[q.id],
      }));
      const result = await submit(payload);
      router.replace({
        pathname: '/(auth)/aptitude-result',
        params: {
          score: String(result.score),
          total: String(result.total),
          passed: result.passed ? '1' : '0',
          attemptsRemaining: String(result.status.attempts_remaining),
        },
      });
    } catch (e: any) {
      Alert.alert('Could not submit', e?.message ?? 'Please try again.');
    }
  };

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
      ) : isError || questions.length === 0 ? (
        <View style={styles.centered}>
          <HelixaText style={styles.muted}>
            {"The assessment isn't available right now. Please try again later."}
          </HelixaText>
          <Pressable onPress={() => router.replace('/(auth)/aptitude-intro')} style={styles.retry}>
            <HelixaText style={styles.retryText}>Go back</HelixaText>
          </Pressable>
        </View>
      ) : (
        <>
          <Reveal index={0}>
            <View style={styles.progressBarWrap}>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${(answeredCount / questions.length) * 100}%` }]}
                />
              </View>
              <HelixaText style={styles.progressText}>
                {answeredCount}/{questions.length} answered
              </HelixaText>
            </View>
          </Reveal>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {pageQuestions.map((q, idx) => {
              const number = page * PAGE_SIZE + idx + 1;
              return (
                <RevealList key={q.id} index={idx + 1}>
                  <View style={styles.questionCard}>
                    <HelixaText style={styles.questionText}>
                      <HelixaText style={styles.qNumber} weight="bold">{`Q${number}.  `}</HelixaText>
                      {q.question}
                    </HelixaText>
                    {q.options.map((option, optIdx) => {
                      const selected = answers[q.id] === optIdx;
                      return (
                        <PressableScale
                          key={optIdx}
                          style={[styles.option, selected && styles.optionSelected]}
                          onPress={() => select(q.id, optIdx)}
                        >
                          <HelixaText style={[styles.optionText, selected && styles.optionTextSelected]}>
                            {option}
                          </HelixaText>
                          {selected && <Feather name="check" size={18} color="#D62D88" />}
                        </PressableScale>
                      );
                    })}
                  </View>
                </RevealList>
              );
            })}
          </ScrollView>

          <Reveal index={2}>
            <View style={styles.footer}>
              {page > 0 && (
                <PressableScale style={styles.secondaryButton} onPress={() => setPage((p) => p - 1)}>
                  <Feather name="arrow-left" size={16} color="#111827" />
                  <HelixaText style={styles.secondaryText}>Previous</HelixaText>
                </PressableScale>
              )}
              {isLastPage ? (
                <Button
                  title="Submit Test"
                  onPress={handleSubmit}
                  disabled={!allAnswered || isPending}
                  isLoading={isPending}
                  style={styles.primaryFlex}
                />
              ) : (
                <Button
                  title="Next"
                  onPress={() => setPage((p) => p + 1)}
                  style={styles.primaryFlex}
                />
              )}
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
  muted: { color: '#6B7280', textAlign: 'center', marginBottom: 12 },
  retry: { paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { color: '#D62D88', fontWeight: '600' },
  progressBarWrap: { paddingHorizontal: 24, paddingTop: 6, paddingBottom: 10 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F1F1',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#D62D88' },
  progressText: { fontSize: 12, color: '#9CA3AF' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },
  questionCard: {
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  questionText: { fontSize: 15, color: '#111827', lineHeight: 22, marginBottom: 14 },
  qNumber: { color: '#D62D88' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  optionSelected: { borderColor: '#D62D88', backgroundColor: '#FDF2F8' },
  optionText: { flex: 1, fontSize: 14, color: '#374151', marginRight: 8 },
  optionTextSelected: { color: '#9D174D' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  primaryFlex: { flex: 1 },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 9999,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  secondaryText: { fontSize: 14, color: '#111827', fontWeight: '600' },
});
