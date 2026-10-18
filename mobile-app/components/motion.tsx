/**
 * Shared motion kit (same file in loni-server-app/components/motion.tsx).
 *
 *  <Reveal index={n}>        content fades, rises and settles in, staggered by its position on the screen
 *  <RevealList index={i}>    same for list rows (stagger capped, so long lists don't wait)
 *  <PressableScale ...>      a Pressable that gently shrinks while pressed - use for cards and big buttons
 *  layoutSpring              smooth re-flow when items are added / removed (`layout={layoutSpring}`)
 *
 * Reveals play every time their screen comes into view (first open, switching back to a tab, returning
 * from another screen) - not only when first created. Tab screens are created once at launch, often
 * behind the splash, so a create-time animation was never actually seen. Nothing is re-created, so
 * scroll position and form state are kept.
 *
 * Everything runs on the UI thread (Reanimated) and is skipped when the phone has "Reduce motion" on.
 */
import React, { useCallback } from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  Easing,
  LinearTransition,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const STEP_MS = 80;          // gap between consecutive sections
const DURATION_MS = 560;
const RISE_PX = 26;          // how far content travels up as it appears
const MAX_LIST_STAGGER = 8;  // rows after this appear without waiting

export const layoutSpring = LinearTransition.springify().damping(20).stiffness(180).reduceMotion(ReduceMotion.System);

/** Drives one reveal: 0 -> 1 each time the screen gains focus. */
function useReveal(delayMs: number) {
  const reduce = useReducedMotion();
  const progress = useSharedValue(reduce ? 1 : 0);

  useFocusEffect(
    useCallback(() => {
      if (reduce) {
        progress.value = 1;
        return;
      }
      cancelAnimation(progress);
      progress.value = 0;
      progress.value = withDelay(delayMs, withTiming(1, { duration: DURATION_MS, easing: Easing.out(Easing.cubic) }));
    }, [delayMs, reduce]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * RISE_PX },
      { scale: 0.97 + progress.value * 0.03 },
    ],
  }));
}

type RevealProps = {
  index?: number;
  /** extra delay before this group starts (ms) */
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
};

export function Reveal({ index = 0, delay = 0, style, children, pointerEvents }: RevealProps) {
  const animated = useReveal(delay + index * STEP_MS);
  return (
    <Animated.View style={[style, animated]} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}

export function RevealList({ index = 0, delay = 0, style, children }: RevealProps) {
  // Only the first rows are staggered; rows created later (scrolling a long list) appear straight away.
  const animated = useReveal(index < MAX_LIST_STAGGER ? delay + index * STEP_MS : 0);
  return (
    <Animated.View layout={layoutSpring} style={[style, animated]}>
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** how far it shrinks while held (default 0.96) */
  scaleTo?: number;
  /** dim slightly while held, like TouchableOpacity */
  activeOpacity?: number;
};

export function PressableScale({ style, scaleTo = 0.96, activeOpacity = 0.9, onPressIn, onPressOut, children, ...rest }: PressableScaleProps) {
  const pressed = useSharedValue(0);
  // Keep the element's own opacity (e.g. a dimmed disabled button) and dim relative to it while held.
  const baseOpacity = (StyleSheet.flatten(style)?.opacity as number | undefined) ?? 1;
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(pressed.value ? scaleTo : 1, { damping: 15, stiffness: 300, mass: 0.6 }) }],
    opacity: baseOpacity * withTiming(pressed.value ? activeOpacity : 1, { duration: 110 }),
  }), [baseOpacity, scaleTo, activeOpacity]);
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => { pressed.value = 1; onPressIn?.(e); }}
      onPressOut={(e) => { pressed.value = 0; onPressOut?.(e); }}
      style={[style, animated]}>
      {children as React.ReactNode}
    </AnimatedPressable>
  );
}
