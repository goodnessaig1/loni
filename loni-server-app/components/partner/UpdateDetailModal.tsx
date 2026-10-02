import React, { useEffect, useState } from 'react';
import { Modal, View, Image, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';
import { HelixaText } from '../HelixaText';
import { CalText } from '../CalText';
import type { PartnerDashboardUpdate } from '../../api/partner';

const IMAGES = [
  require('../../assets/images/partner-fetus.png'),
  require('../../assets/images/partner-pregnant.png'),
];

interface Props {
  visible: boolean;
  onClose: () => void;
  update: PartnerDashboardUpdate | null;
  colors: { bg: string; pill: string };
}

export function UpdateDetailModal({ visible, onClose, update, colors }: Props) {
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);
  const [page, setPage] = useState(0);
  const [zoomed, setZoomed] = useState<number | null>(null);
  const zoom = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible]);

  useEffect(() => {
    zoom.value = withTiming(zoomed !== null ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [zoomed]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height }],
  }));
  const zoomStyle = useAnimatedStyle(() => ({
    opacity: zoom.value,
    transform: [{ scale: 0.9 + zoom.value * 0.1 }],
  }));

  if (!mounted || !update) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdropWrap} onPress={onClose}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <View style={[styles.hero, { backgroundColor: colors.bg }]}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={18} color="#000000" />
          </Pressable>

{/*

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            style={styles.gallery}
          >
            {IMAGES.map((src, i) => (
              <Pressable key={i} style={[styles.galleryPage, { width }]} onPress={() => setZoomed(i)}>
                <Image source={src} style={styles.galleryImage} resizeMode="contain" />
                <View style={styles.zoomHint}>
                  <Feather name="maximize-2" size={12} color="#000000" />
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.dots}>
            {IMAGES.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
*/}
          <View style={[styles.weekPill, { backgroundColor: colors.pill }]}>
            <HelixaText style={styles.weekPillText} weight="bold">Week {update.week}</HelixaText>
          </View>
          <CalText style={styles.title}>{update.title}</CalText>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          <HelixaText style={styles.sectionLabel} weight="bold">What's happening</HelixaText>
          <HelixaText style={styles.bodyText}>{update.body}</HelixaText>

          <HelixaText style={[styles.sectionLabel, styles.sectionLabelSpaced]} weight="bold">What to expect</HelixaText>
          <View style={styles.expectList}>
            {update.expect.map((item, i) => (
              <View key={i} style={styles.expectRow}>
                <View style={styles.expectDot} />
                <HelixaText style={styles.expectText}>{item}</HelixaText>
              </View>
            ))}
          </View>

          <HelixaText style={styles.disclaimer}>
            General guidance to help you support her - not medical advice. For anything specific, her care team is the best source.
          </HelixaText>
        </ScrollView>
      </Animated.View>

      {zoomed !== null && (
        <Pressable style={styles.zoomOverlay} onPress={() => setZoomed(null)}>
          <Animated.View style={[styles.zoomContent, zoomStyle]}>
            <Image source={IMAGES[zoomed]} style={styles.zoomImage} resizeMode="contain" />
          </Animated.View>
        </Pressable>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: StyleSheet.absoluteFillObject,
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '90%',
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: -4 }, shadowRadius: 16, elevation: 12,
  },
  hero: { paddingTop: 20, paddingBottom: 24, paddingHorizontal: 24 },
  closeButton: {
    position: 'absolute', top: 16, right: 16, zIndex: 2, width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  gallery: { marginHorizontal: -24, marginBottom: 12 },
  galleryPage: { alignItems: 'center', justifyContent: 'center', height: 180 },
  galleryImage: { width: '70%', height: '100%' },
  zoomHint: {
    position: 'absolute', bottom: 8, right: 8, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.2)' },
  dotActive: { backgroundColor: '#000000', width: 16 },
  weekPill: { alignSelf: 'flex-start', borderRadius: 62, paddingHorizontal: 13, paddingVertical: 7, marginBottom: 10 },
  weekPillText: { fontSize: 12, color: '#FFFFFF' },
  title: { fontSize: 24, color: '#000000' },
  body: { flexGrow: 0 },
  bodyContent: { padding: 24, paddingBottom: 48 },
  sectionLabel: { fontSize: 13, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLabelSpaced: { marginTop: 24 },
  bodyText: { fontSize: 16, color: '#111827', lineHeight: 24, marginTop: 10 },
  expectList: { gap: 12, marginTop: 12 },
  expectRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  expectDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D62D88', marginTop: 8 },
  expectText: { fontSize: 15, color: '#111827', lineHeight: 21, flex: 1 },
  disclaimer: { fontSize: 12, color: '#9CA3AF', lineHeight: 17, marginTop: 28 },

  zoomOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  zoomContent: { width: '90%', height: '70%' },
  zoomImage: { width: '100%', height: '100%' },
});
