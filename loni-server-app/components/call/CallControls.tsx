import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { AudioRouteKind } from '../../lib/audioSession';
import { ROUTE_ICON, ROUTE_LABEL } from './AudioRouteSheet';

/**
 * The call's controls, at the bottom of the screen - away from the earpiece and the top-of-phone
 * microphone, inside the thumb's reach, above the home indicator / navigation bar. 64pt targets
 * (over the 44pt iOS / 48dp Android minimum), spaced so a slightly-off tap hits nothing else.
 *
 * Audio: with only the phone itself (earpiece + speaker) it is a plain Speaker on/off toggle. Only
 * when the OS reports a Bluetooth or wired device does it become a menu, listing what is there.
 *
 * Same file in mobile-app and loni-server-app.
 */

interface Props {
  available: AudioRouteKind[];
  current: AudioRouteKind | null;
  onSelectRoute: (kind: AudioRouteKind) => void;
  onOpenRouteMenu: () => void;
  micMuted: boolean;
  /** The OS permission is missing: the button explains and offers to fix it. */
  micUnavailable: boolean;
  onToggleMic: () => void;
  onEnd: () => void;
}

type FeatherName = React.ComponentProps<typeof Feather>['name'];

function ControlButton({ icon, label, active, danger, onPress, accessibilityLabel, badge }: {
  icon: FeatherName; label: string; active?: boolean; danger?: boolean; onPress: () => void; accessibilityLabel: string; badge?: boolean;
}) {
  return (
    <View style={styles.control}>
      <Pressable
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => [
          styles.button,
          active && styles.buttonActive,
          danger && styles.buttonDanger,
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: !!active }}
      >
        <Feather name={icon} size={26} color={active && !danger ? '#0F172A' : '#FFF'} />
        {badge && <View style={styles.badge}><Text style={styles.badgeText}>!</Text></View>}
      </Pressable>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function CallControls({ available, current, onSelectRoute, onOpenRouteMenu, micMuted, micUnavailable, onToggleMic, onEnd }: Props) {
  const hasExternal = available.includes('bluetooth') || available.includes('headset');
  const canToggleSpeaker = available.length === 0 || (available.includes('earpiece') && available.includes('speaker'));
  const onSpeaker = current === 'speaker';

  const audio = hasExternal ? (
    <ControlButton
      icon={current ? ROUTE_ICON[current] : 'volume-1'}
      label={current ? ROUTE_LABEL[current] : 'Audio'}
      active={current === 'speaker'}
      onPress={onOpenRouteMenu}
      accessibilityLabel={`Audio output: ${current ? ROUTE_LABEL[current] : 'unknown'}. Choose output`}
    />
  ) : (
    <ControlButton
      icon="volume-2"
      label="Speaker"
      active={onSpeaker}
      onPress={() => { if (canToggleSpeaker) onSelectRoute(onSpeaker ? 'earpiece' : 'speaker'); }}
      accessibilityLabel={onSpeaker ? 'Speaker on. Switch to phone earpiece' : 'Speaker off. Switch to loudspeaker'}
    />
  );

  return (
    <View style={styles.row}>
      {audio}
      <ControlButton
        icon={micMuted || micUnavailable ? 'mic-off' : 'mic'}
        label={micUnavailable ? 'Mic off' : micMuted ? 'Unmute' : 'Mute'}
        active={micMuted && !micUnavailable}
        badge={micUnavailable}
        onPress={onToggleMic}
        accessibilityLabel={micUnavailable ? 'Microphone not allowed. Allow microphone' : micMuted ? 'Unmute microphone' : 'Mute microphone'}
      />
      <ControlButton icon="phone-off" label="End" danger onPress={onEnd} accessibilityLabel="End call" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start', width: '100%' },
  control: { alignItems: 'center', width: 88 },
  button: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  buttonActive: { backgroundColor: '#FFF' },
  buttonDanger: { backgroundColor: '#FF3B30' },
  label: { color: '#FFF', fontSize: 13, marginTop: 8, opacity: 0.9 },
  badge: {
    position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F59E0B',
    justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { color: '#000', fontSize: 13, fontWeight: '800' },
});
