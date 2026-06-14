import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  Easing
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CIRCLE_SIZE = 140;
const DRAGGER_SIZE = 60;

export default function OnboardingScreen() {
  const router = useRouter();

  // --- SPLASH SCREEN ANIMATION STATE ---
  const logoScale = useSharedValue(0);
  const lineProgress = useSharedValue(0);
  const coverProgress = useSharedValue(0);

  const staticLogoScale = useSharedValue(1.8);
  const staticLogoX = useSharedValue(0);
  const staticLogoY = useSharedValue(0);

  const contentOpacity = useSharedValue(0);

  const lineMaxHeight = (SCREEN_HEIGHT / 2) - (CIRCLE_SIZE / 2) - (DRAGGER_SIZE / 2);

  useEffect(() => {
    // Phase 1: Logo pops in
    logoScale.value = withDelay(500, withSpring(1, { damping: 18, stiffness: 50 }));

    // Phase 2: Line draws down
    lineProgress.value = withDelay(2500, withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }));

    // Phase 3: Assembly moves up and cover wipes up
    coverProgress.value = withDelay(4500, withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }));

    // Phase 4 & 5: Static Logo starts big (1.8), then scales back down to normal size (0.8) while moving
    staticLogoScale.value = withDelay(8000, withTiming(0.8, { duration: 1200, easing: Easing.inOut(Easing.ease) }));

    const targetX = (24 + 40) - (SCREEN_WIDTH / 2); // 40 is half of 80x80 logo (100 * 0.8 = 80)
    const targetY = (48 + 40) - (SCREEN_HEIGHT / 2); // Y target

    staticLogoX.value = withDelay(8000, withTiming(targetX, { duration: 1200, easing: Easing.inOut(Easing.ease) }));
    staticLogoY.value = withDelay(8000, withTiming(targetY, { duration: 1200, easing: Easing.inOut(Easing.ease) }));

    // Phase 6: Fade in the rest of the Onboarding content
    contentOpacity.value = withDelay(8800, withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const staticLogoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: staticLogoX.value },
      { translateY: staticLogoY.value },
      { scale: staticLogoScale.value },
    ],
  }));

  const lineStyle = useAnimatedStyle(() => ({
    height: lineMaxHeight * lineProgress.value,
    opacity: lineProgress.value > 0 ? 1 : 0,
  }));

  const draggerStyle = useAnimatedStyle(() => ({
    opacity: lineProgress.value >= 0.99 ? 1 : 0,
  }));

  const movingAssemblyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -coverProgress.value * SCREEN_HEIGHT }],
  }));

  const coverStyle = useAnimatedStyle(() => ({
    height: coverProgress.value * SCREEN_HEIGHT,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* 1. Splash Background (Pink) */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#D62D88' }]} />

      {/* 2. Bottom White Cover acting as a mask for the static logo AND background for onboarding */}
      <Animated.View style={[styles.bottomCover, coverStyle, { overflow: 'hidden' }]}>

        {/* Static Logo that moves to the top left */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: SCREEN_HEIGHT, alignItems: 'center', justifyContent: 'center', zIndex: 20 }} pointerEvents="none">
          <AnimatedExpoImage
            source={require('../../assets/logo.svg')}
            style={[{ width: 100, height: 100 }, staticLogoAnimatedStyle]}
            contentFit="contain"
          />
        </View>

        {/* --- ONBOARDING CONTENT (Fades in at the end) --- */}
        <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0, height: SCREEN_HEIGHT }, contentAnimatedStyle]}>
          <SafeAreaView style={styles.content}>

            {/* Header spacer to leave room for the logo */}
            <View style={styles.header}>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => router.push('/(auth)/login' as any)} // Use 'as any' temporarily if login route is not typed yet
              >
                <HelixaText style={styles.loginText}>
                  Already have an account? <HelixaText style={styles.loginTextBold} weight="bold">Log in</HelixaText>
                </HelixaText>
              </TouchableOpacity>
            </View>

            {/* Top Button */}
            <View style={styles.topButtonContainer}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.topButton}
                onPress={() => router.push('/(auth)/register')}
              >
                <HelixaText weight="bold" style={styles.topButtonText}>
                  This Is{'\n'}Prepared{'\n'}For You
                </HelixaText>
                <Feather name="arrow-right" size={20} color="white" />
              </TouchableOpacity>
            </View>

            {/* Main Text Content */}
            <View style={styles.mainTextWrapper}>

              <View style={styles.subtextContainer}>
                <HelixaText style={styles.subtext}>
                  We're here for you through{'\n'}pregnancy, recovery, and{'\n'}every urgent moment.
                </HelixaText>
              </View>

              <View style={styles.headingContainer}>
                <CalText style={styles.heading}>
                  You're{'\n'}Not Alone.
                </CalText>
              </View>

            </View>

            {/* Main Image */}
            <View style={styles.imageContainer}>
              <View style={styles.imageWrapper}>
                <Image
                  source={require('../../assets/images/onboarding-lady.jpg')}
                  style={styles.image}
                  contentFit="cover"
                />
              </View>
            </View>

            {/* Bottom Button */}
            <View style={styles.bottomButtonContainer}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.bottomButton}
                onPress={() => router.push('/(auth)/register')}
              >
                <HelixaText weight="bold" style={styles.bottomButtonText}>
                  I was invited
                </HelixaText>
                <Feather name="arrow-right" size={20} color="#D62D88" />
              </TouchableOpacity>
            </View>

          </SafeAreaView>
        </Animated.View>

      </Animated.View>

      {/* 3. Moving Assembly (Center Circle, Line, Dragger) */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { zIndex: 10 }, movingAssemblyStyle]} pointerEvents="none">
        <Animated.View style={[styles.centerCircle, logoStyle]}>
          <Image
            source={require('../../assets/logo.svg')}
            style={{ width: 80, height: 80 }}
            contentFit="contain"
          />
        </Animated.View>
        <Animated.View style={[styles.line, lineStyle]} />
        <Animated.View style={[styles.dragger, draggerStyle]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D62D88',
  },
  bottomCover: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    zIndex: 8,
  },
  centerCircle: {
    position: 'absolute',
    top: (SCREEN_HEIGHT / 2) - (CIRCLE_SIZE / 2),
    left: (SCREEN_WIDTH / 2) - (CIRCLE_SIZE / 2),
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  line: {
    position: 'absolute',
    top: (SCREEN_HEIGHT / 2) + (CIRCLE_SIZE / 2),
    left: (SCREEN_WIDTH / 2) - 2,
    width: 4,
    backgroundColor: 'white',
  },
  dragger: {
    position: 'absolute',
    top: SCREEN_HEIGHT - (DRAGGER_SIZE / 2),
    left: (SCREEN_WIDTH / 2) - (DRAGGER_SIZE / 2),
    width: DRAGGER_SIZE,
    height: DRAGGER_SIZE,
    borderRadius: DRAGGER_SIZE / 2,
    backgroundColor: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 16, // Reduced to push button up
    height: 90,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: 15,
    color: '#6B7280',
  },
  loginTextBold: {
    fontSize: 15,
    color: '#D62D88',
  },
  topButtonContainer: {
    alignItems: 'flex-start',
    marginBottom: 40, // Increased to push the heading text down
  },
  topButton: {
    backgroundColor: '#D62D88',
    borderRadius: 9999,
    paddingHorizontal: 28,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Pushes text and arrow to edges
    width: 210, // Exact width to match mockup proportion
  },
  topButtonText: {
    color: 'white',
    fontSize: 15, // Slightly larger
    lineHeight: 20, // Better vertical spacing
  },
  mainTextWrapper: {
    marginBottom: 22,
  },
  subtextContainer: {
    alignItems: 'flex-end', // Aligns the text to the right
    // marginBottom: 4, // Slight gap before heading
  },
  subtext: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
  },
  headingContainer: {
    // Fills width natively
  },
  heading: {
    color: '#D62D88',
    fontSize: 38,
    lineHeight: 42,
  },
  imageContainer: {
    flex: 1,
    marginBottom: 24,
  },
  imageWrapper: {
    flex: 1,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6', // Tailwind gray-100 to see if container is there
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  bottomButtonContainer: {
    alignItems: 'flex-end',
  },
  bottomButton: {
    backgroundColor: '#D62D8826',
    borderRadius: 9999,
    paddingHorizontal: 32,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomButtonText: {
    color: '#D62D88',
    fontSize: 16,
    marginRight: 12,
  },
});
