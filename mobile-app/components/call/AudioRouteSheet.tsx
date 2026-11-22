import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  /** Distance from the bottom of the screen: the menu opens just above the Audio button. */
  bottom: number;
  left: number;
}

/**
 * The audio output menu (WhatsApp-style popover over the Audio button), shown only when an
 * external device (Bluetooth / wired) is connected. Lists only the routes the OS reports as
 * available, with a tick on the one in use. Tapping outside, picking an option, or the Android
 * back button (handled by the call screen's Modal) closes it.
 *
 * Rows use TouchableOpacity + plain style arrays: NativeWind drops function-form Pressable styles.
 */
export function AudioRouteSheet({ available, current, onSelect, onClose, bottom, left }: Props) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 8, tension: 120 }).start();
  }, [pop]);

  // Phone first, like the OS pickers: Speaker, Phone, then devices.
  const order: AudioRouteKind[] = ['speaker', 'earpiece', 'headset', 'bluetooth'];
  const routes = order.filter((k) => available.includes(k));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close audio menu" />
      <Animated.View
        style={[styles.menu, {
          bottom, left,
          opacity: pop,
          transform: [
            { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
            { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
          ],
        }]}
        accessibilityViewIsModal
      >
        {routes.map((kind, i) => {
          const selected = current === kind;
          return (
            <TouchableOpacity
              key={kind}
              activeOpacity={0.6}
              style={[styles.option, i > 0 && styles.divider]}
              onPress={() => { onSelect(kind); onClose(); }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={ROUTE_LABEL[kind]}
            >
              <View style={styles.tick}>{selected && <Feather name="check" size={18} color="#FFF" />}</View>
              <Feather name={ROUTE_ICON[kind]} size={20} color="#FFF" />
              <Text style={[styles.optionText, selected && { fontWeight: '600' }]}>{ROUTE_LABEL[kind]}</Text>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: {
    position: 'absolute', minWidth: 230, backgroundColor: 'rgba(44,44,46,0.98)', borderRadius: 22,
    paddingVertical: 6, elevation: 16,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingLeft: 10, paddingRight: 22 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
  tick: { width: 22, alignItems: 'center' },
  optionText: { color: '#FFF', fontSize: 17 },
});
