import React, { useMemo, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { Reveal, RevealList, PressableScale } from '../../components/motion';
import { useTrainingModules, useCompleteModule } from '../../hooks/useDriverTraining';
import { getDriverTrainingImage } from '../../lib/driverTrainingAssets';
import type { TrainingSection } from '../../api/driverTraining';

export default function TrainingModuleScreen() {
  const params = useLocalSearchParams<{ order?: string }>();
  const order = Number(params.order ?? '1');

  const { data, isLoading } = useTrainingModules();
  const { mutateAsync: completeModule, isPending } = useCompleteModule();

  const modules = useMemo(() => data?.modules ?? [], [data?.modules]);
  const mod = useMemo(() => modules.find((m) => m.order === order), [modules, order]);
  const totalModules = data?.progress.total_modules ?? modules.length;
  const alreadyCompleted = mod ? (data?.progress.completed_modules ?? []).includes(mod.id) : false;

  const [readTitles, setReadTitles] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<TrainingSection | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  if (isLoading || !mod) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator color="#D62D88" />
      </SafeAreaView>
    );
  }

  const isChecklist = mod.layout === 'checklist';
  const allRead =
    !isChecklist || mod.sections.every((s) => readTitles.includes(s.title) || alreadyCompleted);
  const moduleDone = alreadyCompleted || justCompleted;
  const nextMod = modules.find((m) => m.order === order + 1);

  const markRead = (title: string) => {
    setReadTitles((prev) => (prev.includes(title) ? prev : [...prev, title]));
  };

  const handleComplete = async () => {
    try {
      await completeModule(mod.id);
      setJustCompleted(true);
      if (!nextMod) {
        setShowCompletionModal(true);
      }
    } catch {
      // error is surfaced by react-query; keep the user on the screen
    }
  };

  const goNext = () => {
    if (nextMod) {
      router.replace({ pathname: '/(auth)/training-module', params: { order: String(nextMod.order) } });
    } else {
      setShowCompletionModal(true);
    }
  };

  const renderFooter = () => {
    if (moduleDone) {
      return (
        <Button
          title={nextMod ? 'Next Module' : 'Continue to Aptitude Test'}
          onPress={nextMod ? goNext : () => setShowCompletionModal(true)}
        />
      );
    }
    return (
      <Button
        title={isChecklist ? 'Mark Complete' : 'Complete Driver Training'}
        onPress={handleComplete}
        disabled={!allRead || isPending}
        isLoading={isPending}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Feather name="chevron-left" size={28} color="black" />
        </Pressable>
        <CalText style={styles.headerTitle}>
          Module {order} of {totalModules}
        </CalText>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Reveal index={0}>
          <CalText style={styles.title}>{mod.title}</CalText>
          <HelixaText style={styles.subtitle}>{mod.subtitle}</HelixaText>
        </Reveal>

        <Reveal index={1}>
          <View style={styles.heroCard}>
            <Image source={getDriverTrainingImage(mod.hero)} style={styles.hero} contentFit="cover" />
          </View>
        </Reveal>

        <Reveal index={2}>
          {isChecklist ? (
            <View style={styles.checklist}>
              {mod.sections.map((section, i) => {
                const read = readTitles.includes(section.title) || moduleDone;
                return (
                  <RevealList key={section.title} index={i}>
                    <PressableScale
                      style={styles.checkRow}
                      onPress={() => setActiveSection(section)}
                    >
                      <View style={[styles.checkbox, read && styles.checkboxDone]}>
                        {read && <Feather name="check" size={14} color="#FFFFFF" />}
                      </View>
                      <HelixaText style={styles.checkLabel}>{section.title}</HelixaText>
                    </PressableScale>
                  </RevealList>
                );
              })}

              {moduleDone && (
                <View style={styles.moduleCompleteBanner}>
                  <View style={[styles.checkbox, styles.checkboxDone]}>
                    <Feather name="check" size={14} color="#FFFFFF" />
                  </View>
                  <HelixaText style={styles.moduleCompleteText}>Module Complete</HelixaText>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.reading}>
              {mod.sections.map((section, idx) => (
                <RevealList key={section.title} index={idx}>
                  <View style={styles.readingSection}>
                    <HelixaText style={styles.readingHeading} weight="bold">
                      {idx + 1}. {section.title}
                    </HelixaText>
                    {!!section.body && <HelixaText style={styles.readingBody}>{section.body}</HelixaText>}
                    {section.bullets?.map((b) => (
                      <View key={b} style={styles.bulletRow}>
                        <HelixaText style={styles.bulletDot}>{'•'}</HelixaText>
                        <HelixaText style={styles.bulletText}>{b}</HelixaText>
                      </View>
                    ))}
                    {!!section.note && (
                      <View style={styles.note}>
                        <HelixaText style={styles.noteText}>{section.note}</HelixaText>
                      </View>
                    )}
                  </View>
                </RevealList>
              ))}
            </View>
          )}
        </Reveal>
      </ScrollView>

      <Reveal index={3}>
        <View style={styles.footer}>{renderFooter()}</View>
      </Reveal>

      {/* Checkpoint detail card */}
      <Modal visible={!!activeSection} transparent animationType="fade" onRequestClose={() => setActiveSection(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActiveSection(null)}>
          <Pressable style={styles.detailWrap} onPress={(e) => e.stopPropagation()}>
            <View style={styles.detailCard}>
              <View style={styles.detailHeaderRow}>
                <View
                  style={[
                    styles.checkbox,
                    activeSection && readTitles.includes(activeSection.title)
                      ? styles.checkboxDone
                      : styles.checkboxDark,
                  ]}
                >
                  {activeSection && readTitles.includes(activeSection.title) && (
                    <Feather name="check" size={14} color="#FFFFFF" />
                  )}
                </View>
                <HelixaText style={styles.detailTitle} weight="bold">
                  {activeSection?.title}
                </HelixaText>
              </View>
              <HelixaText style={styles.detailBody}>{activeSection?.body}</HelixaText>
              <Pressable style={styles.closeButton} onPress={() => setActiveSection(null)} hitSlop={8}>
                <HelixaText style={styles.closeText}>Close</HelixaText>
                <Feather name="x" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
            <Button
              title="Done"
              onPress={() => {
                if (activeSection) markRead(activeSection.title);
                setActiveSection(null);
              }}
              style={styles.detailDone}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Training completed */}
      <Modal visible={showCompletionModal} transparent animationType="slide">
        <View style={styles.completionBackdrop}>
          <View style={styles.completionSheet}>
            <Pressable
              style={styles.completionClose}
              onPress={() => setShowCompletionModal(false)}
              hitSlop={8}
            >
              <Feather name="x" size={22} color="#111827" />
            </Pressable>
            <View style={styles.completionBadge}>
              <Feather name="check" size={28} color="#FFFFFF" />
            </View>
            <CalText style={styles.completionTitle}>{"You're one step closer."}</CalText>
            <HelixaText style={styles.completionSubtitle}>
              {"You've completed the LONI Driver Training."}
            </HelixaText>
            <Button
              title="Take Aptitude Test"
              onPress={() => {
                setShowCompletionModal(false);
                router.replace('/(auth)/aptitude-intro');
              }}
              style={{ marginTop: 24 }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  centered: { alignItems: 'center', justifyContent: 'center' },
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
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },
  title: { fontSize: 24, lineHeight: 30, color: '#000000', marginTop: 8, marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#9CA3AF', lineHeight: 20, marginBottom: 18 },
  heroCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 18, backgroundColor: '#FBF3E6' },
  hero: { width: '100%', height: 180 },
  checklist: { backgroundColor: '#F7F7F7', borderRadius: 16, padding: 12 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxDone: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  checkboxDark: { borderColor: '#6B7280' },
  checkLabel: { flex: 1, fontSize: 15, color: '#111827' },
  moduleCompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FADF',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  moduleCompleteText: { fontSize: 15, color: '#111827' },
  reading: {},
  readingSection: {
    borderWidth: 1,
    borderColor: '#F0F0F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  readingHeading: { fontSize: 15, color: '#111827', marginBottom: 8 },
  readingBody: { fontSize: 14, color: '#6B7280', lineHeight: 21 },
  bulletRow: { flexDirection: 'row', marginTop: 6 },
  bulletDot: { fontSize: 14, color: '#9CA3AF', marginRight: 8, lineHeight: 20 },
  bulletText: { flex: 1, fontSize: 14, color: '#6B7280', lineHeight: 20 },
  note: {
    backgroundColor: '#FBEFDD',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  noteText: { fontSize: 13, color: '#7C4A11', lineHeight: 19 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 110,
  },
  detailWrap: {},
  detailCard: { backgroundColor: '#0A0A0A', borderRadius: 18, padding: 18 },
  detailDone: { marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 28 },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  detailTitle: { flex: 1, fontSize: 15, color: '#FFFFFF' },
  detailBody: { fontSize: 14, color: '#D1D5DB', lineHeight: 21 },
  closeButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#26262A',
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  closeText: { color: '#FFFFFF', fontSize: 14 },
  completionBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  completionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  completionClose: { position: 'absolute', top: 16, right: 16 },
  completionBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#D62D88',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  completionTitle: { fontSize: 22, color: '#000000', marginBottom: 8 },
  completionSubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center' },
});
