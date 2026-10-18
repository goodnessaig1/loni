import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../components/HelixaText';
import { useAuth } from '../hooks/useAuth';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { ActionModal } from '../components/ActionModal';
import { StageChange, useUpdateStage } from '../hooks/useStage';
import { recoveryStageOf, trimesterOf } from '../lib/pregnancy';
import { useTheme } from '../context/ThemeContext';
import type { Palette } from '../lib/theme';

export default function PregnancyStatusScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles({ ...colors, activeCard: isDark ? '#F78BC6' : '#FCE8F3' }), [colors, isDark]);

  // Parse current week from string like "5 weeks" or "18 weeks"
  let currentWeek = 0;
  if (user?.pregnancyWeek) {
    const parsed = parseInt(user.pregnancyWeek.toString().replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed)) currentWeek = parsed;
  }

  // Ensure max 40 for progress bar calculation
  const clampedWeek = Math.min(Math.max(currentWeek, 0), 40);
  const rawProgressPercent = (clampedWeek / 40) * 100;
  const progressPercent = Math.max(rawProgressPercent, 25); // At least 25% to fit text

  // Calculate due date (assuming 280 days from pregnancy start date, or simpler: 40 weeks total)
  // If we don't have pregnancyStartDate on frontend, we can estimate from today + remaining weeks
  let dueDateStr = 'Calculating...';
  if (user?.pregnancyStartDate) {
    // 280 days = 40 weeks * 7 days
    const dueDate = new Date(new Date(user.pregnancyStartDate).getTime() + 280 * 24 * 60 * 60 * 1000);
    dueDateStr = dueDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  } else if (currentWeek > 0) {
    const remainingWeeks = 40 - currentWeek;
    const dueDate = new Date(Date.now() + remainingWeeks * 7 * 24 * 60 * 60 * 1000);
    dueDateStr = dueDate.toISOString().split('T')[0];
  }

  // Loni is for every woman: she may be pregnant, postpartum, trying to conceive, or here for her general health.
  const isGeneral = user?.status === 'general' || user?.status === 'ttc';
  const isPregnant = !isGeneral && user?.status !== 'newMom'; // default to pregnant if undefined

  // For newMom, currentWeek is babyAge
  let currentPostpartumWeek = 0;
  if (!isPregnant && user?.babyAge) {
    const parsed = parseInt(user.babyAge.toString().replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed)) currentPostpartumWeek = parsed;
  }

  const currentTrimester = user?.trimester || 'Unknown';
  const activeTrimester = trimesterOf(currentWeek);
  const activeRecovery = recoveryStageOf(currentPostpartumWeek);

  // A tap only *proposes* a change; nothing happens until it is confirmed in the sheet.
  const [pending, setPending] = useState<StageChange | null>(null);
  const updateStage = useUpdateStage();

  const propose = (change: StageChange) => {
    const same =
      (change.trimester && isPregnant && change.trimester === activeTrimester) ||
      (change.recovery_stage && !isPregnant && change.recovery_stage === activeRecovery) ||
      (change.status === 'general' && isGeneral) ||
      (change.status === 'pregnant' && isPregnant) ||
      (change.status === 'newMom' && !isPregnant && !isGeneral);
    if (!same) setPending(change);
  };

  const confirm = () => {
    if (!pending) return;
    updateStage.mutate(pending, {
      onSuccess: () => setPending(null),
      onError: (e: any) => {
        setPending(null);
        Toast.show({ type: 'error', text1: 'Could not update your stage', text2: e?.response?.data?.message || e?.message });
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background SVG */}
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={isDark ? require('../assets/images/pregnancy-bg-dark.svg') : require('../assets/images/pregnancy-bg.svg')}
          style={styles.bgImage}
          contentFit="cover"
        />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.text} />
        </Pressable>
        <HelixaText style={styles.headerTitle} weight="bold">Pregnancy Status</HelixaText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stage Section */}
        {isGeneral ? (
          <View style={styles.stageSection}>
            <HelixaText style={styles.stageLabel}>Your journey</HelixaText>
            <HelixaText style={styles.stageTitle} weight="bold">{user?.status === 'ttc' ? 'Trying to conceive' : 'Women\'s health'}</HelixaText>
            <HelixaText style={styles.stageSubtitle}>
              {user?.status === 'ttc'
                ? 'Loni is here for your cycle, your questions and the ups and downs.'
                : 'Loni is here for your cycle, your body and your wellbeing.'}
            </HelixaText>
          </View>
        ) : isPregnant ? (
          <View style={styles.stageSection}>
            <HelixaText style={styles.stageLabel}>Current Stage</HelixaText>
            <HelixaText style={styles.stageTitle} weight="bold">{currentTrimester}</HelixaText>
            <HelixaText style={styles.stageSubtitle}>Week {currentWeek} of pregnancy</HelixaText>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }]}>
                <HelixaText style={styles.progressText} numberOfLines={1}>{currentWeek} weeks</HelixaText>
              </View>
              <View style={styles.progressFlag}>
                <Feather name="flag" size={16} color="#D62D88" />
              </View>
            </View>

            <HelixaText style={styles.dueDateText}>Due {dueDateStr}</HelixaText>
          </View>
        ) : (
          <View style={styles.postpartumCard}>
            <Image
              source={require('../assets/images/postpartum.svg')}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <View style={styles.postpartumCardContent}>
              <HelixaText style={styles.postpartumLabel} weight="bold">Current Stage</HelixaText>
              <HelixaText style={styles.postpartumTitle} weight="bold">Postpartum Recovery</HelixaText>
              <HelixaText style={styles.postpartumSubtitle}>Week {currentPostpartumWeek} of recovery</HelixaText>
            </View>
          </View>
        )}

        {/* Toggle Pill */}
        <View style={styles.toggleContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isPregnant }}
            onPress={() => propose({ status: 'pregnant' })}
            style={[styles.toggleButton, isPregnant && styles.toggleActive]}
          >
            <HelixaText style={isPregnant ? styles.toggleTextActive : styles.toggleTextInactive} weight={isPregnant ? "bold" : "regular"}>Pregnancy</HelixaText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !isPregnant && !isGeneral }}
            onPress={() => propose({ status: 'newMom' })}
            style={[styles.toggleButton, !isPregnant && !isGeneral && styles.toggleActive]}
          >
            <HelixaText style={!isPregnant && !isGeneral ? styles.toggleTextActive : styles.toggleTextInactive} weight={!isPregnant && !isGeneral ? "bold" : "regular"}>Postpartum</HelixaText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isGeneral }}
            onPress={() => propose({ status: 'general' })}
            style={[styles.toggleButton, isGeneral && styles.toggleActive]}
          >
            <HelixaText style={isGeneral ? styles.toggleTextActive : styles.toggleTextInactive} weight={isGeneral ? "bold" : "regular"}>Not pregnant</HelixaText>
          </Pressable>
        </View>

        {/* Stage List */}
        <View style={styles.trimestersSection}>
          {!isGeneral && (
          <HelixaText style={styles.sectionTitle} weight="bold">
            {isPregnant ? "Current Trimester" : "Select Recovery Stage"}
          </HelixaText>
          )}

          {isGeneral ? null : isPregnant ? (
            <>
              <TrimesterCard
                title="First Trimester"
                weeks="Weeks 1 - 12"
                isActive={activeTrimester === 1}
                onPress={() => propose({ trimester: 1 })}
              />
              <TrimesterCard
                title="Second Trimester"
                weeks="Weeks 13 - 27"
                isActive={activeTrimester === 2}
                onPress={() => propose({ trimester: 2 })}
              />
              <TrimesterCard
                title="Third Trimester"
                weeks="Weeks 28 - 40"
                isActive={activeTrimester === 3}
                onPress={() => propose({ trimester: 3 })}
              />
            </>
          ) : (
            <>
              <TrimesterCard
                title="Early Recovery"
                weeks="Weeks 1 - 6"
                isActive={activeRecovery === 'early'}
                onPress={() => propose({ recovery_stage: 'early' })}
              />
              <TrimesterCard
                title="Active Recovery"
                weeks="Weeks 7 - 12"
                isActive={activeRecovery === 'active'}
                onPress={() => propose({ recovery_stage: 'active' })}
              />
              <TrimesterCard
                title="Extended Recovery"
                weeks="Weeks 13+"
                isActive={activeRecovery === 'extended'}
                onPress={() => propose({ recovery_stage: 'extended' })}
              />
            </>
          )}
        </View>

        <HelixaText style={styles.footerText}>
          Your stage helps us personalize your care. You can update this anytime, we are always here for you.
        </HelixaText>

      </ScrollView>

      <ActionModal
        visible={!!pending}
        onClose={() => !updateStage.isPending && setPending(null)}
        title={pending?.status ? (pending.status === 'newMom' ? 'Switch to Postpartum?' : pending.status === 'general' ? 'Switch to Women\'s Health?' : 'Switch to Pregnancy?') : 'Update Your Stage?'}
        description={
          pending?.status
            ? (pending.status === 'general' ? 'Loni will focus on your general health, cycle and wellbeing.' : 'Your care plan will adjust to support your new journey.')
            : 'We will update your personalized care plan accordingly.'
        }
        icon={
          <View style={{ width: 96, height: 96, borderRadius: 32, backgroundColor: '#D62D88', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="robot-outline" size={56} color="#FFF" />
          </View>
        }
        primaryButtonText="Confirm"
        onPrimaryPress={confirm}
        isPrimaryLoading={updateStage.isPending}
        secondaryButtonText="Cancel"
        onSecondaryPress={() => setPending(null)}
      />
    </SafeAreaView>
  );
}

function TrimesterCard({ title, weeks, isActive, onPress }: { title: string, weeks: string, isActive: boolean, onPress: () => void }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles({ ...colors, activeCard: isDark ? '#F78BC6' : '#FCE8F3' }), [colors, isDark]);
  // The highlighted row is a bright pink in dark mode, so its text must stay dark there.
  const onActive = isActive && isDark ? { color: '#1B1B1F' } : undefined;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={[styles.card, isActive && styles.cardActive]}
    >
      <View style={styles.cardLeft}>
        <View style={styles.iconCircle}>
          <Feather name="smile" size={20} color="#D62D88" />
        </View>
        <View>
          <HelixaText style={[styles.cardTitle, onActive]} weight="bold">{title}</HelixaText>
          <HelixaText style={[styles.cardSubtitle, onActive && { color: '#4B4B52' }]}>{weeks}</HelixaText>
        </View>
      </View>
      {isActive && (
        <View style={styles.checkCircle}>
          <Feather name="check" size={14} color="#FFF" />
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (c: Palette & { activeCard: string }) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  bgImage: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.bg,
  },
  headerTitle: {
    fontSize: 18,
    color: c.text,
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  stageSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  stageLabel: {
    fontSize: 14,
    color: c.textSecondary,
    marginBottom: 4,
  },
  stageTitle: {
    fontSize: 28,
    color: c.text,
    marginBottom: 8,
  },
  stageSubtitle: {
    fontSize: 15,
    color: c.textSecondary,
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
    height: 48,
    backgroundColor: c.primarySoft, // Light pink background
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#D62D88',
    borderRadius: 24,
    justifyContent: 'center',
    paddingLeft: 16,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  progressFlag: {
    position: 'absolute',
    right: 16,
  },
  dueDateText: {
    marginTop: 16,
    fontSize: 14,
    color: c.textSecondary,
  },
  postpartumCard: {
    marginTop: 24,
    marginBottom: 32,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FCE8F3', // fallback color
    minHeight: 140,
  },
  postpartumCardContent: {
    padding: 24,
    justifyContent: 'center',
    flex: 1,
  },
  postpartumLabel: {
    fontSize: 14,
    color: '#1E3A8A', // Dark blue text for label
    marginBottom: 16,
    fontWeight: 'semibold'
  },
  postpartumTitle: {
    fontSize: 24,
    color: '#000000',
    marginBottom: 8,
  },
  postpartumSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: 24,
    padding: 4,
    alignSelf: 'center',
    marginBottom: 40,
    width: '100%',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  toggleActive: {
    backgroundColor: c.elevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleTextActive: {
    color: c.text,
    fontSize: 14,
  },
  toggleTextInactive: {
    color: c.textMuted,
    fontSize: 14,
  },
  trimestersSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    color: c.text,
    marginBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardActive: {
    backgroundColor: c.activeCard,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    color: c.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: c.textSecondary,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D62D88',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 20,
    paddingHorizontal: 20,
  }
});
