import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { AudioRouteKind } from '../../lib/audioSession';
import { ROUTE_LABEL } from './AudioRouteSheet';

/**
 * The call's controls: one dark panel at the bottom of the screen (away from the earpiece and the
 * top microphone, inside the thumb's reach), WhatsApp-style round buttons:
 *   off  - dark glass circle, white icon
 *   on   - solid white circle, black icon   (speaker on, muted, external audio in use)
 *   end  - solid red circle
 *
 * NativeWind (jsxImportSource) drops a Pressable `style` given as a function, which is why the
 * earlier buttons showed no circle at all and an "on" icon turned black on nothing. Buttons here
 * use TouchableOpacity with plain style arrays.
 *
 * Audio: with only the phone itself (earpiece + speaker) it is a Speaker on/off toggle. Only when
 * the OS reports a Bluetooth or wired device does it become an "Audio" menu, listing what is there.
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
type McName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Icon = { feather: FeatherName } | { mc: McName };

const ROUTE_BUTTON_ICON: Record<AudioRouteKind, Icon> = {
  earpiece: { feather: 'smartphone' },
  speaker: { mc: 'volume-high' },
  bluetooth: { mc: 'bluetooth-audio' },
  headset: { mc: 'headphones' },
};

function ControlButton({ icon, label, on, danger, onPress, accessibilityLabel, badge }: {
  icon: Icon; label: string; on?: boolean; danger?: boolean; onPress: () => void; accessibilityLabel: string; badge?: boolean;
}) {
  const color = danger ? '#FFF' : on ? '#111' : '#FFF';
  return (
    <View style={styles.control}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        hitSlop={6}
        style={[styles.button, on && styles.buttonOn, danger && styles.buttonDanger]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ selected: !!on }}
      >
        {'feather' in icon
          ? <Feather name={icon.feather} size={26} color={color} />
          : <MaterialCommunityIcons name={icon.mc} size={28} color={color} />}
        {badge && <View style={styles.badge}><Text style={styles.badgeText}>!</Text></View>}
      </TouchableOpacity>
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
      icon={current ? ROUTE_BUTTON_ICON[current] : { mc: 'volume-high' }}
      label="Audio"
      // Like WhatsApp: lit whenever sound is NOT coming from the phone's earpiece.
      on={!!current && current !== 'earpiece'}
      onPress={onOpenRouteMenu}
      accessibilityLabel={`Audio output: ${current ? ROUTE_LABEL[current] : 'unknown'}. Choose output`}
    />
  ) : (
    <ControlButton
      icon={{ mc: 'volume-high' }}
      label="Speaker"
      on={onSpeaker}
      onPress={() => { if (canToggleSpeaker) onSelectRoute(onSpeaker ? 'earpiece' : 'speaker'); }}
      accessibilityLabel={onSpeaker ? 'Speaker on. Switch to phone earpiece' : 'Speaker off. Switch to loudspeaker'}
    />
  );

  return (
    <View style={styles.panel}>
      {audio}
      <ControlButton
        icon={{ mc: micMuted || micUnavailable ? 'microphone-off' : 'microphone' }}
        label={micUnavailable ? 'Mic off' : micMuted ? 'Unmute' : 'Mute'}
        on={micMuted && !micUnavailable}
        badge={micUnavailable}
        onPress={onToggleMic}
        accessibilityLabel={micUnavailable ? 'Microphone not allowed. Allow microphone' : micMuted ? 'Muted. Unmute microphone' : 'Mute microphone'}
      />
      <ControlButton icon={{ mc: 'phone-hangup' }} label="End" danger onPress={onEnd} accessibilityLabel="End call" />
    </View>
  );
}

/** Height of the panel, so overlays (the audio menu) can sit just above it. */
export const CALL_CONTROLS_HEIGHT = 128;

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-start', width: '100%',
    backgroundColor: 'rgba(28,28,30,0.92)', borderRadius: 32, paddingTop: 18, paddingBottom: 14,
    minHeight: CALL_CONTROLS_HEIGHT,
  },
  control: { alignItems: 'center', width: 88 },
  button: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: '#3A3A3C',
    justifyContent: 'center', alignItems: 'center',
  },
  buttonOn: { backgroundColor: '#F5F5F5' },
  buttonDanger: { backgroundColor: '#E5243B' },
  label: { color: '#FFF', fontSize: 14, marginTop: 8 },
  badge: {
    position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: '#F59E0B',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1C1C1E',
  },
  badgeText: { color: '#000', fontSize: 12, fontWeight: '800' },
});
