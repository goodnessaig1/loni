import React, { useRef, useState, useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions, Pressable, FlatList, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HelixaText } from '../../components/HelixaText';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import type { Palette } from '../../lib/theme';

const slides = [
  {
    id: '1',
    headingPart1: 'We provide ',
    highlight: 'support',
    headingPart2: ' that moves with urgency.',
    text: 'Request urgent transport, notify loved ones, and stay connected when every second matters.',
    image: require('../../assets/images/onboarding1.png'),
  },
  {
    id: '2',
    headingPart1: 'Talk to a ',
    highlight: 'real',
    headingPart2: ' nurse anytime.',
    text: 'Get calm, trusted support from trained maternal care nurses whenever you feel unsure or overwhelmed.',
    image: require('../../assets/images/onboarding2.svg'),
  },
  {
    id: '3',
    headingPart1: 'Recovery support ',
    highlight: 'beyond',
    headingPart2: ' childbirth.',
    text: 'Daily guidance, wellness check-ins, and simple recovery plans designed for new mothers.',
    image: require('../../assets/images/onboarding3.svg'),
  },
  {
    id: '4',
    headingPart1: 'Your support ',
    highlight: 'system',
    headingPart2: ' stays connected.',
    text: 'Partners and loved ones can stay informed, respond during emergencies, and support your recovery journey.',
    image: require('../../assets/images/onboarding4.svg'),
  }
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / width);
    if (index !== currentIndex && index >= 0 && index < slides.length) {
      setCurrentIndex(index);
    }
  };

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      router.replace('/(tabs)');
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1, animated: true });
    }
  };

  const renderItem = ({ item, index }: { item: typeof slides[0], index: number }) => {
    return (
      <View style={[styles.slideContainer, { width }]}>
        <View style={styles.textContainer}>
          <HelixaText style={styles.heading} weight="bold">
            {item.headingPart1}
            <HelixaText style={styles.highlight} weight="bold">{item.highlight}</HelixaText>
            {item.headingPart2}
          </HelixaText>
          <HelixaText style={styles.subtitle}>{item.text}</HelixaText>
        </View>

        <View style={styles.navRow}>
          {index > 0 ? (
            <Pressable style={styles.navButton} onPress={handlePrev}>
              <Feather name="arrow-left" size={20} color={colors.text} />
            </Pressable>
          ) : <View style={{ width: 48 }} />}

          <Pressable style={styles.navButton} onPress={handleNext}>
            <Feather name="arrow-right" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.imageWrapper}>
          <Image
            source={item.image}
            style={styles.image}
            contentFit="cover"
            transition={300}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
      />

      <View style={styles.footer}>
        {/* Loni logo */}
        <Image source={require('../../assets/logo.svg')} style={styles.logo} contentFit="contain" />

        <Pressable
          style={styles.skipButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <HelixaText style={styles.skipText}>Skip</HelixaText>
          <Feather name="arrow-right" size={16} color="#D62D88" style={{ marginLeft: 4 }} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  slideContainer: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  textContainer: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 34,
    lineHeight: 40,
    color: c.text,
    marginBottom: 16,
    fontWeight: '700'
  },
  highlight: {
    color: '#D62D88',
  },
  subtitle: {
    fontSize: 16,
    color: c.textSecondary,
    lineHeight: 24,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginBottom: 24,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    flex: 1,
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  logo: {
    width: 60,
    height: 40,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.primarySoft,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  skipText: {
    color: '#D62D88',
    fontSize: 15,
    fontWeight: '700',
  }
});
