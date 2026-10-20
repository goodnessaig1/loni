import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Reveal, PressableScale } from '../../components/motion';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  withSequence,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Simple Filled Cloud SVG
const CloudSVG = ({ color = "rgba(255, 255, 255, 0.7)", width = 50, height = 35 }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill={color}>
    <Path d="M17.5 19C19.985 19 22 16.985 22 14.5C22 12.138 20.18 10.202 17.869 10.023C17.433 6.643 14.562 4 11 4C7.134 4 4 7.134 4 11C4 11.234 4.011 11.464 4.034 11.692C1.765 12.158 0 14.126 0 16.5C0 18.985 2.015 21 4.5 21H17.5V19Z" />
  </Svg>
);

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Cloud animations
  const cloud1X = useSharedValue(0);
  const cloud2X = useSharedValue(0);

  useEffect(() => {
    // Float cloud 1 left and right
    cloud1X.value = withRepeat(
      withSequence(
        withTiming(-25, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(25, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // infinite
      true
    );

    // Float cloud 2 left and right (different speed/distance)
    cloud2X.value = withRepeat(
      withSequence(
        withTiming(30, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-30, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedCloud1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: cloud1X.value }]
  }));

  const animatedCloud2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: cloud2X.value }]
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#D62D88" />
      
      {/* Background Image filling the space */}
      <View style={StyleSheet.absoluteFillObject}>
        <Image
          source={require('../../assets/images/service-onboard.png')}
          style={styles.fullImage}
          contentFit="cover"
          contentPosition="top center"
        />
      </View>

      {/* Animated Clouds overlaying the top */}
      <Animated.View style={[styles.cloud, { top: insets.top + 60, left: 20 }, animatedCloud1Style]}>
        <CloudSVG width={65} height={45} color="rgba(255, 255, 255, 0.4)" />
      </Animated.View>
      <Animated.View style={[styles.cloud, { top: insets.top + 90, right: 30 }, animatedCloud2Style]}>
        <CloudSVG width={80} height={55} color="rgba(255, 255, 255, 0.3)" />
      </Animated.View>

      {/* Bottom White Container positioned absolutely at the bottom */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom + 10 : 30 }]}>
        <Reveal index={0}>
          <View style={styles.textContent}>
            <HelixaText style={styles.subtext}>
              Answer requests. Deliver support.
            </HelixaText>
            <CalText style={styles.heading}>
              Support mothers through every urgent moment.
            </CalText>
          </View>
        </Reveal>

        <Reveal index={1}>
          <View style={styles.buttonContainer}>
            <PressableScale
              style={styles.createAccountBtn}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.8}
            >
              <HelixaText weight="bold" style={styles.createAccountText}>Create Account</HelixaText>
            </PressableScale>

            <PressableScale
              style={styles.signInBtn}
              onPress={() => router.push('/(auth)/login')}
              activeOpacity={0.8}
            >
              <HelixaText weight="bold" style={styles.signInText}>Sign In</HelixaText>
            </PressableScale>
          </View>
        </Reveal>

        <Reveal index={2}>
          <View style={styles.footerContainer}>
            <HelixaText style={styles.footerText}>
              By continuing, you agree to our{' '}
              <HelixaText style={styles.footerLink} onPress={() => {}}>Terms of Service</HelixaText>
              {' '}and{' '}
              <HelixaText style={styles.footerLink} onPress={() => {}}>Privacy Policy.</HelixaText>
            </HelixaText>
          </View>
        </Reveal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D62D88', // Match the pink background
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  cloud: {
    position: 'absolute',
    zIndex: 5,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: '55%',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 40,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  textContent: {
    marginBottom: 20,
  },
  subtext: {
    color: '#6B7280',
    fontSize: 16,
    marginBottom: 12,
  },
  heading: {
    color: '#000000',
    fontSize: 34,
    lineHeight: 38,
  },
  buttonContainer: {
    gap: 16,
    marginBottom: 24,
  },
  createAccountBtn: {
    backgroundColor: '#D62D88',
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
  },
  createAccountText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  signInBtn: {
    backgroundColor: '#F3F4F6', // light grey
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
  },
  signInText: {
    color: '#374151',
    fontSize: 16,
  },
  footerContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  footerText: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    color: '#D62D88',
    fontSize: 13,
  }
});
