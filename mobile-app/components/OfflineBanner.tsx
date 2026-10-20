import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useConnectivity } from '../lib/connectivity';

/** A small pill at the top while LONI can't be reached (same file in both apps). */
export function OfflineBanner() {
  const online = useConnectivity((s) => s.online);
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(200)}
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top + 6 }]}
      accessibilityLiveRegion="polite">
      <View style={styles.pill}>
        <Feather name="wifi-off" size={14} color="#FFFFFF" />
        <Text style={styles.text}>You're offline. Reconnecting…</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1000, elevation: 1000 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111827',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
