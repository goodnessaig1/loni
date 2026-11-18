import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { AudioRouteKind } from '../../lib/audioSession';

/** Same file in mobile-app and loni-server-app. */

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export const ROUTE_LABEL: Record<AudioRouteKind, string> = {
  earpiece: 'Phone',
  speaker: 'Speaker',
  bluetooth: 'Bluetooth',
  headset: 'Headphones',
};

export const ROUTE_ICON: Record<AudioRouteKind, FeatherName> = {
  earpiece: 'smartphone',
  speaker: 'volume-2',
  bluetooth: 'bluetooth',
  headset: 'headphones',
};

interface Props {
  available: AudioRouteKind[];
  current: AudioRouteKind | null;
  onSelect: (kind: AudioRouteKind) => void;
  onClose: () => void;
}

/**
 * The audio output menu, shown only when an external device (Bluetooth / wired) is connected.
 * Lists only the routes the OS reports as available. Tapping outside, picking an option, or the
 * Android back button (handled by the call screen's Modal) closes it.
 */
export function AudioRouteSheet({ available, current, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [slide]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close audio menu" />
      <Animated.View
        style={[styles.sheet, {
          paddingBottom: insets.bottom + 16,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        }]}
        accessibilityViewIsModal
      >
        <Text style={styles.title}>Audio</Text>
        {available.map((kind) => {
          const selected = current === kind;
          return (
            <Pressable
              key={kind}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && { opacity: 0.7 }]}
              onPress={() => { onSelect(kind); onClose(); }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={ROUTE_LABEL[kind]}
            >
              <Feather name={ROUTE_ICON[kind]} size={20} color="#FFF" />
              <Text style={styles.optionText}>{ROUTE_LABEL[kind]}</Text>
              {selected && <Feather name="check" size={18} color="#4ADE80" style={{ marginLeft: 'auto' }} />}
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#1E293B',
    borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingHorizontal: 16,
  },
  title: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', marginBottom: 6, marginLeft: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 12, borderRadius: 12 },
  optionSelected: { backgroundColor: 'rgba(255,255,255,0.1)' },
  optionText: { color: '#FFF', fontSize: 16 },
});
