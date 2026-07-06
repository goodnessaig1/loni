import React, { useEffect } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Image } from 'expo-image';

const AnimatedExpoImage = Animated.createAnimatedComponent(Image);

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CIRCLE_SIZE = 140;
const DRAGGER_SIZE = 60;

interface AnimatedSplashScreenProps {
  onComplete: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ onComplete }) => {
  const logoScale = useSharedValue(0);
  const lineProgress = useSharedValue(0);
  const coverProgress = useSharedValue(0);

  const staticLogoScale = useSharedValue(1);
  const staticLogoX = useSharedValue(0);
  const staticLogoY = useSharedValue(0);

  const lineMaxHeight = (SCREEN_HEIGHT / 2) - (CIRCLE_SIZE / 2) - (DRAGGER_SIZE / 2);

  useEffect(() => {
    // Phase 1: Logo pops in
    logoScale.value = withDelay(
      500,
      withSpring(1, { damping: 18, stiffness: 50 })
    );

    // Phase 2: Line draws down
    lineProgress.value = withDelay(
      2500,
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
    );

    // Phase 3: Assembly moves up and cover wipes up
    coverProgress.value = withDelay(
      4500,
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
    );

    // Phase 4: Static Logo scales up to emphasize it
    staticLogoScale.value = withDelay(
      6800, // Starts right after Phase 3 finishes (4500 + 2000 = 6500) + short pause
      withTiming(2.0, { duration: 1000, easing: Easing.out(Easing.ease) })
    );

    // Phase 5: Static Logo translates to top-left and scales down
    staticLogoScale.value = withDelay(
      8300, // Pause while it's large
      withTiming(0.8, { duration: 1200, easing: Easing.inOut(Easing.ease) })
    );

    // Target X and Y for top-left (assuming 24px padding left, 60px padding top for safe area)
    // Logo original size is 100. Target scale is 0.8 (80x80).
    const targetX = (24 + 40) - (SCREEN_WIDTH / 2);
    const targetY = (60 + 40) - (SCREEN_HEIGHT / 2);

    staticLogoX.value = withDelay(
      8300,
      withTiming(targetX, { duration: 1200, easing: Easing.inOut(Easing.ease) })
    );

    staticLogoY.value = withDelay(
      8300,
      withTiming(targetY, { duration: 1200, easing: Easing.inOut(Easing.ease) }, (finished) => {
        if (finished) {
          // Phase 6: Complete
          setTimeout(() => {
            runOnJS(onComplete)();
          }, 100);
        }
      })
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: logoScale.value }],
    };
  });

  const staticLogoAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: staticLogoX.value },
        { translateY: staticLogoY.value },
        { scale: staticLogoScale.value },
      ],
    };
  });

  const lineStyle = useAnimatedStyle(() => {
    return {
      height: lineMaxHeight * lineProgress.value,
      opacity: lineProgress.value > 0 ? 1 : 0,
    };
  });

  const draggerStyle = useAnimatedStyle(() => {
    return {
      opacity: lineProgress.value >= 0.99 ? 1 : 0,
    };
  });

  const movingAssemblyStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: -coverProgress.value * SCREEN_HEIGHT }],
    };
  });

  const coverStyle = useAnimatedStyle(() => {
    return {
      height: coverProgress.value * SCREEN_HEIGHT,
    };
  });

  return (
    <View style={styles.container}>
      {/* 1. Background (Pink) */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#D62D88' }]} />

      {/* 2. Bottom White Cover acting as a mask for the static logo */}
      <Animated.View style={[styles.bottomCover, coverStyle, { overflow: 'hidden' }]}>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: SCREEN_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
          <AnimatedExpoImage
            source={require('../assets/logo.svg')}
            style={[{ width: 100, height: 100 }, staticLogoAnimatedStyle]}
            contentFit="contain"
          />
        </View>
      </Animated.View>

      {/* 3. Moving Assembly (zIndex 10) */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { zIndex: 10 }, movingAssemblyStyle]}>
        
        {/* Center Circle */}
        <Animated.View style={[styles.centerCircle, logoStyle]}>
          <Image
            source={require('../assets/logo.svg')}
            style={{ width: 80, height: 80 }}
            contentFit="contain"
          />
        </Animated.View>

        {/* The Line */}
        <Animated.View style={[styles.line, lineStyle]} />

        {/* The Dragger */}
        <Animated.View style={[styles.dragger, draggerStyle]} />

      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D62D88',
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
    // Subtle shadow so it looks like it's lifting off the background
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  line: {
    position: 'absolute',
    top: (SCREEN_HEIGHT / 2) + (CIRCLE_SIZE / 2),
    left: (SCREEN_WIDTH / 2) - 2, // 4px wide
    width: 4,
    backgroundColor: 'white',
  },
  bottomCover: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    zIndex: 8,
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
});
