import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { CalText } from './CalText';

/** Back chevron + centred title, as on every secondary screen in the Figma. */
export function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} style={styles.side} hitSlop={10}>
        <Feather name="chevron-left" size={26} color="#000000" />
      </Pressable>
      <CalText style={styles.title} numberOfLines={1}>{title}</CalText>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 21, paddingTop: 16, paddingBottom: 8 },
  side: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, color: '#000000', flex: 1, textAlign: 'center' },
});
