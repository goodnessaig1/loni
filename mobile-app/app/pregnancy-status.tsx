import React from 'react';
import { View, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../components/HelixaText';
import { useAuth } from '../hooks/useAuth';
import { Image } from 'expo-image';

export default function PregnancyStatusScreen() {
  const { user } = useAuth();

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

  const currentTrimester = user?.trimester || 'Unknown';

  return (
    <SafeAreaView style={styles.container}>
      {/* Background SVG */}
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={require('../assets/images/pregnancy-bg.svg')}
          style={styles.bgImage}
          contentFit="cover"
        />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#000" />
        </Pressable>
        <HelixaText style={styles.headerTitle} weight="bold">Pregnancy Status</HelixaText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stage Section */}
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

        {/* Toggle Pill */}
        <View style={styles.toggleContainer}>
          <View style={[styles.toggleButton, styles.toggleActive]}>
            <HelixaText style={styles.toggleTextActive} weight="bold">Pregnancy</HelixaText>
          </View>
          <View style={styles.toggleButton}>
            <HelixaText style={styles.toggleTextInactive}>Postpartum</HelixaText>
          </View>
        </View>

        {/* Trimesters List */}
        <View style={styles.trimestersSection}>
          <HelixaText style={styles.sectionTitle} weight="bold">Current Trimester</HelixaText>

          <TrimesterCard
            title="First Trimester"
            weeks="Weeks 1 - 12"
            isActive={currentTrimester.startsWith('1st')}
          />
          <TrimesterCard
            title="Second Trimester"
            weeks="Weeks 13 - 27"
            isActive={currentTrimester.startsWith('2nd')}
          />
          <TrimesterCard
            title="Third Trimester"
            weeks="Weeks 28 - 40"
            isActive={currentTrimester.startsWith('3rd')}
          />
        </View>

        <HelixaText style={styles.footerText}>
          Your stage helps us personalize your care. You can update this anytime, we are always here for you.
        </HelixaText>

      </ScrollView>
    </SafeAreaView>
  );
}

function TrimesterCard({ title, weeks, isActive }: { title: string, weeks: string, isActive: boolean }) {
  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      <View style={styles.cardLeft}>
        <View style={styles.iconCircle}>
          <Feather name="smile" size={20} color="#D62D88" />
        </View>
        <View>
          <HelixaText style={styles.cardTitle} weight="bold">{title}</HelixaText>
          <HelixaText style={styles.cardSubtitle}>{weeks}</HelixaText>
        </View>
      </View>
      {isActive && (
        <View style={styles.checkCircle}>
          <Feather name="check" size={14} color="#FFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    color: '#000000',
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
    color: '#6B7280',
    marginBottom: 4,
  },
  stageTitle: {
    fontSize: 28,
    color: '#000000',
    marginBottom: 8,
  },
  stageSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
    height: 48,
    backgroundColor: '#FCE8F3', // Light pink background
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
    color: '#6B7280',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    padding: 4,
    alignSelf: 'center',
    marginBottom: 40,
    width: '80%',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 20,
  },
  toggleActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleTextActive: {
    color: '#000000',
    fontSize: 14,
  },
  toggleTextInactive: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  trimestersSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F3F3',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardActive: {
    backgroundColor: '#FCE8F3',
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    color: '#000000',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
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
    color: '#9CA3AF',
    lineHeight: 20,
    paddingHorizontal: 20,
  }
});
