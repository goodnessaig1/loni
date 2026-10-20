import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../HelixaText';
import { babySize, trimesterOf, type PregnancyProgress } from '../../lib/pregnancy';

interface PregnancyCardProps {
  progress: PregnancyProgress;
  /** Omit to render a plain (non-tappable) card, e.g. on the Journey screen. */
  onPress?: () => void;
}

const PILL = {
  backgroundColor: 'rgba(255,255,255,0.22)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.45)',
  borderRadius: 999,
  paddingHorizontal: 14,
  paddingVertical: 7,
  alignSelf: 'flex-start' as const,
};

/** Hero card on the home screen: where the mother is in her pregnancy (or postpartum) journey. */
export const PregnancyCard = ({ progress, onPress }: PregnancyCardProps) => {
  const { kind, week, daysUntilDue } = progress;
  const pregnant = kind === 'pregnant';

  const stage = pregnant ? `Week ${week} · Trimester ${trimesterOf(week)}` : `Week ${week} · Postpartum`;
  const title = pregnant
    ? `Your Baby Is The Size Of ${babySize(week)}`
    : `Your Baby Is ${week} ${week === 1 ? 'Week' : 'Weeks'} Old`;
  const footer = pregnant
    ? daysUntilDue === 0
      ? 'Your due date is here'
      : `${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'} until your due date`
    : 'See your recovery progress';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={`${stage}. ${title}. ${footer}`}
      style={styles.card}
    >
      <Image source={require('../../assets/images/baby-feet.png')} style={StyleSheet.absoluteFill} contentFit="cover" />
      {/* Keeps the white copy readable over the bright blanket. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.22)', 'rgba(0,0,0,0.05)', 'rgba(120,20,70,0.35)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={PILL}>
        <HelixaText style={{ color: '#FFFFFF', fontSize: 14 }}>{stage}</HelixaText>
      </View>

      <View style={styles.bottom}>
        <HelixaText weight="bold" style={styles.title}>
          {title}
        </HelixaText>
        <View style={[PILL, { marginTop: 14 }]}>
          <HelixaText style={{ color: '#FFFFFF', fontSize: 14 }}>{footer}</HelixaText>
        </View>
      </View>

      {onPress && (
        <View style={styles.tab}>
          <View style={styles.arrow}>
            <Feather name="arrow-right" size={20} color="#FFFFFF" />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    height: 216,
    borderRadius: 28,
    overflow: 'hidden',
    padding: 20,
    justifyContent: 'space-between',
    backgroundColor: '#F4A6C8',
  },
  bottom: { maxWidth: '78%' },
  title: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  // The translucent "peek" tab on the right edge with the forward arrow.
  tab: {
    position: 'absolute',
    right: 0,
    top: 80,
    width: 78,
    height: 130,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
