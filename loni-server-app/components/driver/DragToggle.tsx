import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { HelixaText } from '../HelixaText';
import { dragFeedback } from '../../lib/dragFeedback';

/**
 * "Drag to go offline / online" slider on the driver dashboard's pink card
 * (Figma 828:12346). Slide-to-confirm: the knob must be dragged past the
 * mid-point before the toggle fires, so availability can't be flipped by an
 * accidental tap. Built on RN PanResponder + Animated (no gesture dep).
 *
 * The knob ALWAYS rests on the left; you drag it right to perform the
 * action the label names. On a completed drag we fire `onToggle(!value)` and
 * spring the knob home; the label then updates for the new state.
 *
 * Feel: a brand-tinted progress trail follows the knob, the knob lifts
 * while held, and `lib/dragFeedback` fires haptics at each detent, a firmer
 * bump at the commit threshold, and a success buzz + soft chime on toggle.
 *
 * Colours are themed by the caller (pink/white online, greyscale offline).
 */
const KNOB = 46;
const PAD = 5;
const TRACK_H = KNOB + PAD * 2;
const COMMIT = 0.6;          // fraction of travel needed to fire the toggle
const DETENTS = [0.33, 0.66]; // haptic tick points while sliding

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export interface DragToggleColors {
  track: string;
  knob: string;
  knobIcon: string;
  label: string;
  chevron: string;
}

const ONLINE_COLORS: DragToggleColors = {
  track: 'rgba(255,255,255,0.30)',
  knob: '#D62D88',
  knobIcon: '#FFFFFF',
  label: '#FFFFFF',
  chevron: 'rgba(255,255,255,0.8)',
};

export function DragToggle({
  value,
  onToggle,
  disabled,
  colors = ONLINE_COLORS,
  sound = true,
}: {
  value: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  colors?: DragToggleColors;
  sound?: boolean;
}) {
  const [trackW, setTrackW] = useState(0);
  const maxX = Math.max(1, trackW - KNOB - PAD * 2);

  const x = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;
  const valueRef = useRef(value);
  const maxRef = useRef(maxX);
  const detentRef = useRef(0);
  const armedRef = useRef(false);

  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { maxRef.current = maxX; }, [maxX]);

  const springHome = () => {
    Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 2, speed: 16 }).start();
    Animated.spring(press, { toValue: 0, useNativeDriver: true, speed: 20 }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        !disabled && Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        detentRef.current = 0;
        armedRef.current = false;
        Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
        dragFeedback.start();
      },
      onPanResponderMove: (_e, g) => {
        const mx = maxRef.current;
        const px = clamp(g.dx, 0, mx);
        x.setValue(px);
        const frac = px / mx;
        while (detentRef.current < DETENTS.length && frac >= DETENTS[detentRef.current]) {
          detentRef.current += 1;
          dragFeedback.tick();
        }
        if (!armedRef.current && frac >= COMMIT) {
          armedRef.current = true;
          dragFeedback.armed();
        } else if (armedRef.current && frac < COMMIT - 0.06) {
          armedRef.current = false;
        }
      },
      onPanResponderRelease: (_e, g) => {
        const mx = maxRef.current;
        const end = clamp(g.dx, 0, mx);
        if (end > mx * COMMIT) {
          onToggle(!valueRef.current);
          dragFeedback.commit(sound);
        } else if (end > 8) {
          dragFeedback.cancel();
        }
        springHome();
      },
      onPanResponderTerminate: springHome,
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);

  const fillScale = x.interpolate({
    inputRange: [0, maxX],
    outputRange: [(KNOB + PAD) / Math.max(trackW, 1), 1],
    extrapolate: 'clamp',
  });
  const knobScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View
      style={[styles.track, { backgroundColor: colors.track }]}
      onLayout={onLayout}
      {...pan.panHandlers}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fill,
          { backgroundColor: colors.knob, transform: [{ scaleX: fillScale }] },
        ]}
      />
      <HelixaText weight="black" style={[styles.label, { color: colors.label }]}>
        {value ? 'Drag to go offline' : 'Drag to go online'}
      </HelixaText>
      <Feather name="chevrons-right" size={22} color={colors.chevron} style={styles.chevrons} />
      <Animated.View
        style={[
          styles.knob,
          { backgroundColor: colors.knob, transform: [{ translateX: x }, { scale: knobScale }] },
        ]}>
        <MaterialCommunityIcons
          name={value ? 'map-marker-off-outline' : 'map-marker-outline'}
          size={20}
          color={colors.knobIcon}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '74%',
    alignSelf: 'stretch',
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    opacity: 0.22,
    transformOrigin: 'left center',
  },
  label: {
    fontSize: 14,
    textAlign: 'center',
    marginLeft: KNOB,      // visually centre the label in the space right of the knob
    marginRight: 34,
  },
  chevrons: {
    position: 'absolute',
    right: 18,
  },
  knob: {
    position: 'absolute',
    left: PAD,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
