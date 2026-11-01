import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { PressableScale } from '../../components/motion';

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Same width as `imageWidth` in app.json, so the logo takes over from the native splash without a jump.
const SPLASH_LOGO_WIDTH = 120;
const SPLASH_LOGO_HEIGHT = 100;
const HEADER_LOGO_WIDTH = 80;
const HOLD_MS = 400; // how long the logo rests in the middle
const MOVE_MS = 700;
const CONTENT_RISE = 24;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const logoProgress = useSharedValue(0);
  const contentProgress = useSharedValue(0);

  // From the middle of the screen to the middle of the header's left corner.
  const logoX = 24 + HEADER_LOGO_WIDTH / 2 - SCREEN_WIDTH / 2;
  const logoY = insets.top + 16 + 45 - SCREEN_HEIGHT / 2;
  const logoScale = HEADER_LOGO_WIDTH / SPLASH_LOGO_WIDTH;

  useEffect(() => {
    const move = { duration: MOVE_MS, easing: Easing.inOut(Easing.ease) };
    logoProgress.value = withDelay(HOLD_MS, withTiming(1, move));
    contentProgress.value = withDelay(HOLD_MS + 150, withTiming(1, move));
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: logoProgress.value * logoX },
      { translateY: logoProgress.value * logoY },
      { scale: 1 + logoProgress.value * (logoScale - 1) },
    ],
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentProgress.value,
    transform: [{ translateY: (1 - contentProgress.value) * CONTENT_RISE }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.flex1, contentAnimatedStyle]}>
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
            <PressableScale
              activeOpacity={0.8}
              style={styles.topButton}
              onPress={() => router.push('/(auth)/register')}
            >
              <HelixaText weight="bold" style={styles.topButtonText}>
                This Is{'\n'}Prepared{'\n'}For You
              </HelixaText>
              <Feather name="arrow-right" size={20} color="white" />
            </PressableScale>
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
            <PressableScale
              activeOpacity={0.8}
              style={styles.bottomButton}
              onPress={() => router.push('/(auth)/register')}
            >
              <HelixaText weight="bold" style={styles.bottomButtonText}>
                I was invited
              </HelixaText>
              <Feather name="arrow-right" size={20} color="#D62D88" />
            </PressableScale>
          </View>

        </SafeAreaView>
      </Animated.View>

      {/* The logo the native splash left in the middle, moving to the header */}
      <View style={styles.logoLayer} pointerEvents="none">
        <AnimatedExpoImage
          source={require('../../assets/logo.svg')}
          style={[{ width: SPLASH_LOGO_WIDTH, height: SPLASH_LOGO_HEIGHT }, logoAnimatedStyle]}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  flex1: {
    flex: 1,
  },
  logoLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
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
