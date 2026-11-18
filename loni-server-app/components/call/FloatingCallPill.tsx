import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Keyboard, PanResponder, Pressable, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallStore } from '../../store/callStore';
import { useCallUiStore } from '../../store/callUiStore';
import { formatCallDuration, useCallDuration } from '../../hooks/useCallDuration';
import { toggleMicrophone } from '../../lib/activeRoom';
import { cdnImage } from '../../lib/cdnImage';

/**
 * The minimised call, drawn as the Figma "Dynamic Island" call card: black card, the other
 * person's photo, name and role, a voice indicator, mic and hang-up buttons.
 *
 * - Tap the card: back to the full call screen.
 * - Drag: up and down anywhere inside the safe area (and above the keyboard).
 * - Fling or drag it past a side: it tucks off-screen leaving a small tab, like WhatsApp's call
 *   window. Tap the tab to bring it back.
 *
 * In-app only - this is not OS picture-in-picture. When the app is backgrounded the call is kept
 * alive by the Android foreground service / iOS audio background mode, and the OS shows its own
 * in-call indicator (iOS: the green status-bar pill; Android: the ongoing-call notification).
 *
 * Reads callStore / callUiStore and calls toggleMicrophone (lib/activeRoom) - it never mounts or
 * touches the LiveKit room, so minimising and restoring cannot disconnect the call.
 *
 * Buttons use TouchableOpacity + plain style arrays: NativeWind drops function-form Pressable styles.
 *
 * Same file in mobile-app and loni-server-app.
 */

const CARD_MAX_W = 380;
const CARD_H = 112;
const EDGE = 12;
const TAB_W = 30;
const TAB_H = 84;

const C = {
  card: '#000000',
  text: '#FFFFFF',
  muted: '#A1A1AA',
  chip: '#2C2C2E',
  live: '#34C759',
  hangup: '#EF4444',
};

function statusText(status: string, seconds: number, connected: boolean): string {
  if (status === 'RECONNECTING') return 'Reconnecting…';
  if (connected) return formatCallDuration(seconds);
  if (status === 'RINGING') return 'Calling…';
  if (status === 'ACCEPTED' || status === 'CONNECTING') return 'Connecting…';
  return 'Call';
}

/** Gentle pulse on the voice icon while the call is live, so it reads as "on air". */
function VoiceIndicator({ live }: { live: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!live) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [live, pulse]);
  return (
    <Animated.View style={{ opacity: pulse }} importantForAccessibility="no-hide-descendants">
      <MaterialCommunityIcons name="waveform" size={24} color={live ? C.text : C.muted} />
    </Animated.View>
  );
}

interface Props {
  /** The other person's role, under their name (e.g. "Maternal Health Specialist"). */
  subtitle?: string | null;
  /** Hang up (or cancel, before it connects). */
  onEnd: () => void;
}

export function FloatingCallPill({ subtitle, onEnd }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const remote = useCallStore((s) => s.remoteParticipant);
  const status = useCallStore((s) => s.status);
  const connectedAt = useCallStore((s) => s.connectedAt);
  const micMuted = useCallStore((s) => s.micMuted);
  const pill = useCallUiStore((s) => s.pill);
  const expand = useCallUiStore((s) => s.expand);
  const setPill = useCallUiStore((s) => s.setPill);
  const seconds = useCallDuration(connectedAt);
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const cardW = Math.min(CARD_MAX_W, width - insets.left - insets.right - EDGE * 2);
  const geo = useMemo(() => ({
    centreX: insets.left + (width - insets.left - insets.right - cardW) / 2,
    leftX: -cardW - 8,
    rightX: width + 8,
    minY: insets.top + 8,
    maxY: Math.max(insets.top + 8, height - insets.bottom - keyboard - EDGE - CARD_H),
  }), [insets, width, height, keyboard, cardW]);

  const clampY = (y: number) => Math.min(geo.maxY, Math.max(geo.minY, y));
  const targetX = (t: 'left' | 'right' | null) => (t === 'left' ? geo.leftX : t === 'right' ? geo.rightX : geo.centreX);
  const target = { x: targetX(pill.tucked), y: clampY(pill.y) };

  const pos = useRef(new Animated.ValueXY(target)).current;
  const latest = useRef(target);
  const dragging = useRef(false);
  useEffect(() => {
    const id = pos.addListener((v) => { latest.current = v; });
    return () => pos.removeListener(id);
  }, [pos]);

  // Settle whenever the target changes (tuck / untuck, rotation, keyboard).
  useEffect(() => {
    if (dragging.current) return;
    Animated.spring(pos, { toValue: target, useNativeDriver: false, friction: 8, tension: 70 }).start();
  }, [target.x, target.y]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collapse animation: the card grows in where the full screen went.
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(appear, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }).start();
  }, [appear]);

  const geoRef = useRef(geo);
  geoRef.current = geo;
  const cardWRef = useRef(cardW);
  cardWRef.current = cardW;

  const responder = useMemo(() => PanResponder.create({
    // Taps go to the card / buttons; only a real drag is taken over.
    onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
    onPanResponderGrant: () => {
      dragging.current = true;
      pos.setOffset(latest.current);
      pos.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_e, g) => {
      pos.flattenOffset();
      dragging.current = false;
      const b = geoRef.current;
      const w = cardWRef.current;
      // Far enough (or flung hard enough) sideways: tuck it away on that side.
      const far = Math.abs(g.dx) > w * 0.35 || Math.abs(g.vx) > 0.9;
      const tucked: 'left' | 'right' | null = far && Math.abs(g.dx) > Math.abs(g.dy) ? (g.dx < 0 ? 'left' : 'right') : null;
      const y = Math.min(b.maxY, Math.max(b.minY, latest.current.y + g.vy * 40));
      setPill({ y, tucked });
      Animated.spring(pos, {
        toValue: { x: tucked === 'left' ? b.leftX : tucked === 'right' ? b.rightX : b.centreX, y },
        useNativeDriver: false, friction: 8, tension: 70,
      }).start();
    },
    onPanResponderTerminate: () => {
      pos.flattenOffset();
      dragging.current = false;
      const p = useCallUiStore.getState().pill;
      const b = geoRef.current;
      Animated.spring(pos, {
        toValue: { x: p.tucked === 'left' ? b.leftX : p.tucked === 'right' ? b.rightX : b.centreX, y: Math.min(b.maxY, Math.max(b.minY, p.y)) },
        useNativeDriver: false,
      }).start();
    },
  }), [pos, setPill]);

  const name = remote?.name || 'Call';
  const connected = !!connectedAt && status !== 'RECONNECTING';
  const label = statusText(status, seconds, connected);
  const live = status === 'CONNECTED';
  const role = subtitle || label;

  const tabY = clampY(pill.y) + CARD_H / 2 - TAB_H / 2;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        {...responder.panHandlers}
        style={[styles.card, { width: cardW, transform: [...pos.getTranslateTransform()] }]}
      >
        <Animated.View style={{ flex: 1, opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>
          <Pressable
            onPress={expand}
            style={styles.inner}
            accessibilityRole="button"
            accessibilityLabel={`Return to call with ${name}, ${label}`}
            accessibilityHint="Opens the full call screen. Drag up or down to move, or to the side to hide."
          >
            <View style={styles.row}>
              <View style={styles.avatar}>
                {remote?.profile_picture ? (
                  <Image source={{ uri: cdnImage(remote.profile_picture, 96) }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarInitial}>{name[0]?.toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.text}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <Text style={styles.role} numberOfLines={1}>{role}</Text>
              </View>
              <VoiceIndicator live={live && !micMuted} />
            </View>

            <View style={[styles.row, { marginTop: 8 }]}>
              <View style={styles.statusWrap}>
                <View style={[styles.dot, { backgroundColor: live ? C.live : status === 'RECONNECTING' ? '#F59E0B' : C.muted }]} />
                <Text style={styles.status} numberOfLines={1}>{subtitle ? label : ''}</Text>
              </View>
              <TouchableOpacity
                onPress={toggleMicrophone}
                activeOpacity={0.7}
                hitSlop={6}
                style={[styles.round, micMuted ? styles.roundMuted : styles.roundMic]}
                accessibilityRole="button"
                accessibilityLabel={micMuted ? 'Muted. Unmute microphone' : 'Mute microphone'}
                accessibilityState={{ selected: micMuted }}
              >
                <MaterialCommunityIcons name={micMuted ? 'microphone-off' : 'microphone'} size={20} color={micMuted ? C.text : '#000'} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onEnd}
                activeOpacity={0.7}
                hitSlop={6}
                style={[styles.round, styles.roundEnd]}
                accessibilityRole="button"
                accessibilityLabel={connected ? 'End call' : 'Cancel call'}
              >
                <MaterialCommunityIcons name="phone-hangup" size={20} color={C.text} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Animated.View>

      {pill.tucked && (
        <TouchableOpacity
          onPress={() => setPill({ ...pill, tucked: null })}
          activeOpacity={0.8}
          style={[
            styles.tab,
            { top: tabY },
            pill.tucked === 'left'
              ? { left: 0, borderTopRightRadius: 16, borderBottomRightRadius: 16 }
              : { right: 0, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Show call with ${name}`}
        >
          <Feather name={pill.tucked === 'left' ? 'chevron-right' : 'chevron-left'} size={22} color={C.text} />
          <View style={[styles.tabDot, { backgroundColor: live ? C.live : C.muted }]} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute', left: 0, top: 0, height: CARD_H, borderRadius: 28,
    backgroundColor: C.card, elevation: 14, zIndex: 9999,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
  inner: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.chip, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarInitial: { color: C.text, fontSize: 17, fontWeight: '700' },
  text: { flex: 1, marginLeft: 10, marginRight: 8 },
  name: { color: C.text, fontSize: 15, fontWeight: '600' },
  role: { color: C.muted, fontSize: 12, marginTop: 1, fontVariant: ['tabular-nums'] },
  statusWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  status: { color: C.text, fontSize: 13, fontVariant: ['tabular-nums'] },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  roundMic: { backgroundColor: C.text },
  roundMuted: { backgroundColor: '#3A3A3C' },
  roundEnd: { backgroundColor: C.hangup },
  tab: {
    position: 'absolute', width: TAB_W, height: TAB_H, backgroundColor: 'rgba(28,28,30,0.92)',
    alignItems: 'center', justifyContent: 'center', elevation: 14, zIndex: 9999,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  tabDot: { position: 'absolute', top: 8, width: 6, height: 6, borderRadius: 3 },
});
