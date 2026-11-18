import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useCallStore } from '../../store/callStore';
import { useCallUiStore } from '../../store/callUiStore';
import { formatCallDuration, useCallDuration } from '../../hooks/useCallDuration';
import { cdnImage } from '../../lib/cdnImage';

/**
 * The minimised call: a small draggable card floating over the app (in-app only - this is not OS
 * picture-in-picture; when the whole app is backgrounded the call is kept alive by the Android
 * foreground service / iOS audio background mode, and the OS shows its own in-call indicator).
 *
 * Tap: back to the full call screen. Drag: anywhere; on release it docks to the nearer side and is
 * kept inside the safe area, above the keyboard, on rotation too.
 *
 * Reads only callStore / callUiStore - it never touches the LiveKit room, so minimising and
 * restoring cannot disconnect the call or change the microphone.
 *
 * Same file in mobile-app and loni-server-app.
 */

const PILL_W = 188;
const PILL_H = 60;
const EDGE = 12;

function statusText(status: string, seconds: number, connected: boolean): string {
  if (status === 'RECONNECTING') return 'Reconnecting…';
  if (connected) return formatCallDuration(seconds);
  if (status === 'RINGING') return 'Calling…';
  if (status === 'ACCEPTED' || status === 'CONNECTING') return 'Connecting…';
  return 'Call';
}

export function FloatingCallPill() {
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

  const bounds = useMemo(() => ({
    minX: insets.left + EDGE,
    maxX: width - insets.right - EDGE - PILL_W,
    minY: insets.top + EDGE,
    maxY: Math.max(insets.top + EDGE, height - insets.bottom - keyboard - EDGE - PILL_H),
  }), [insets, width, height, keyboard]);

  const clampY = (y: number) => Math.min(bounds.maxY, Math.max(bounds.minY, y));
  const docked = { x: pill.side === 'left' ? bounds.minX : bounds.maxX, y: clampY(pill.y) };

  const pos = useRef(new Animated.ValueXY(docked)).current;
  const latest = useRef(docked);
  const dragging = useRef(false);
  useEffect(() => {
    const id = pos.addListener((v) => { latest.current = v; });
    return () => pos.removeListener(id);
  }, [pos]);

  // Re-dock when the screen changes (rotation, keyboard, the pill moved).
  useEffect(() => {
    if (dragging.current) return;
    Animated.spring(pos, { toValue: docked, useNativeDriver: false, friction: 7, tension: 60 }).start();
  }, [docked.x, docked.y]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collapse animation: the card grows in where the full screen went.
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(appear, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }).start();
  }, [appear]);

  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  const responder = useMemo(() => PanResponder.create({
    // Taps go to the Pressable; only a real drag is taken over.
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
      const b = boundsRef.current;
      const centreX = latest.current.x + PILL_W / 2 + g.vx * 80;
      const side: 'left' | 'right' = centreX < (b.minX + b.maxX + PILL_W) / 2 ? 'left' : 'right';
      const y = Math.min(b.maxY, Math.max(b.minY, latest.current.y + g.vy * 60));
      setPill({ side, y });
      Animated.spring(pos, {
        toValue: { x: side === 'left' ? b.minX : b.maxX, y },
        useNativeDriver: false, friction: 7, tension: 60,
      }).start();
    },
    onPanResponderTerminate: () => {
      pos.flattenOffset();
      dragging.current = false;
    },
  }), [pos, setPill]);

  const name = remote?.name || 'Call';
  const label = statusText(status, seconds, !!connectedAt && status !== 'RECONNECTING');
  const live = status === 'CONNECTED';

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        {...responder.panHandlers}
        style={[styles.pill, { transform: [...pos.getTranslateTransform()] }]}
      >
        <Animated.View style={{ flex: 1, opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
          <Pressable
            onPress={expand}
            style={styles.inner}
            accessibilityRole="button"
            accessibilityLabel={`Return to call with ${name}, ${label}`}
            accessibilityHint="Opens the full call screen. Drag to move."
          >
            <View style={styles.avatar}>
              {remote?.profile_picture ? (
                <Image source={{ uri: cdnImage(remote.profile_picture, 96) }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <Text style={styles.avatarInitial}>{name[0]?.toUpperCase()}</Text>
              )}
              <View style={[styles.dot, { backgroundColor: live ? '#34C759' : status === 'RECONNECTING' ? '#F59E0B' : '#94A3B8' }]} />
            </View>
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              <Text style={styles.status} numberOfLines={1}>{label}</Text>
            </View>
            {micMuted && <Feather name="mic-off" size={16} color="#FCA5A5" style={{ marginLeft: 4 }} />}
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute', left: 0, top: 0, width: PILL_W, height: PILL_H, borderRadius: PILL_H / 2,
    backgroundColor: '#14532D', elevation: 12, zIndex: 9999,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  inner: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarInitial: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  dot: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#14532D' },
  text: { flex: 1, marginLeft: 10 },
  name: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  status: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontVariant: ['tabular-nums'] },
});
