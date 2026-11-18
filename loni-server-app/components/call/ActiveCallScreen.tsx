import React from 'react';
import { ImageSourcePropType, Image as RNImage, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalParticipant, useParticipant, useRemoteParticipants, useTrackVolume } from '@livekit/react-native';
import { LocalAudioTrack, Participant, RemoteAudioTrack, Track } from 'livekit-client';
import { useCallStore } from '../../store/callStore';
import { useCallUiStore } from '../../store/callUiStore';
import { useAudioRoute } from '../../hooks/useAudioRoute';
import { useMicPermissionStatus } from '../../hooks/useMicPermissionStatus';
import { formatCallDuration, useCallDuration } from '../../hooks/useCallDuration';
import { toggleMicrophone } from '../../lib/activeRoom';
import { cdnImage } from '../../lib/cdnImage';
import { CallControls } from './CallControls';
import { AudioRouteSheet } from './AudioRouteSheet';
import { MicPermissionSheet } from './MicPermissionSheet';

/**
 * The full-screen active call. Must be rendered inside <LiveKitRoom> (it reads the room for the
 * voice meter and the other person's mute state) but owns no connection logic - that is
 * useCallRoomLifecycle, mounted beside it - so it can be shown and hidden (minimised) freely.
 *
 * Small pieces that change often (timer, voice meter, status) are their own components so a tick
 * re-renders a line of text, not the screen.
 *
 * Same file in mobile-app and loni-server-app.
 */

type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface Props {
  /** Shown when the other person's name is not known yet. */
  fallbackName: string;
  subtitle?: { icon: FeatherName; label: string } | null;
  /** Background when the other person has no photo: an image, or a plain colour if omitted. */
  fallbackBackground?: ImageSourcePropType | null;
  onEnd: () => void;
}

function CallTimer() {
  const connectedAt = useCallStore((s) => s.connectedAt);
  const seconds = useCallDuration(connectedAt);
  return (
    <Text style={styles.timer} accessibilityLabel={`Call duration ${formatCallDuration(seconds)}`}>
      {formatCallDuration(seconds)}
    </Text>
  );
}

function StatusBadge() {
  const status = useCallStore((s) => s.status);
  const quality = useCallStore((s) => s.connectionQuality);
  const bars = quality === 'excellent' ? 3 : quality === 'good' ? 2 : 1;
  const label = status === 'CONNECTED' ? 'Call ongoing' : status === 'RECONNECTING' ? 'Reconnecting…' : 'Connecting…';
  return (
    <View style={styles.badge} accessibilityRole="text" accessibilityLabel={`${label}, connection ${quality}`}>
      <View style={styles.bars}>
        {[8, 12, 16].map((h, i) => (
          <View key={h} style={[styles.bar, { height: h, opacity: bars > i ? 1 : 0.3 }]} />
        ))}
      </View>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function VoiceVisualizer() {
  const { localParticipant } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const localMic = localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined;
  const remoteMic = remotes[0]?.getTrackPublication(Track.Source.Microphone)?.track as RemoteAudioTrack | undefined;
  const vol = Math.max(useTrackVolume(localMic) || 0, useTrackVolume(remoteMic) || 0);
  return (
    <View style={styles.visualizer} importantForAccessibility="no-hide-descendants">
      {[[40, 0.5], [60, 0.8], [90, 1.5], [60, 0.8], [40, 0.5]].map(([h, k], i) => (
        <View key={i} style={[styles.bigBar, { height: h * (1 + vol * k) }]} />
      ))}
    </View>
  );
}

function RemoteMutedBadgeFor({ participant }: { participant: Participant }) {
  const { microphonePublication } = useParticipant(participant);
  if (microphonePublication && !microphonePublication.isMuted) return null;
  return (
    <View style={[styles.chip, styles.chipDanger]}>
      <Feather name="mic-off" size={14} color="#FFF" style={{ marginRight: 6 }} />
      <Text style={styles.chipText}>Muted</Text>
    </View>
  );
}

function RemoteMutedBadge() {
  const remotes = useRemoteParticipants();
  return remotes[0] ? <RemoteMutedBadgeFor participant={remotes[0]} /> : null;
}

export function ActiveCallScreen({ fallbackName, subtitle, fallbackBackground, onEnd }: Props) {
  const insets = useSafeAreaInsets();
  const remote = useCallStore((s) => s.remoteParticipant);
  const micMuted = useCallStore((s) => s.micMuted);
  const minimise = useCallUiStore((s) => s.minimise);
  const routeSheetOpen = useCallUiStore((s) => s.routeSheetOpen);
  const setRouteSheetOpen = useCallUiStore((s) => s.setRouteSheetOpen);
  const route = useAudioRoute(true);
  const mic = useMicPermissionStatus();
  const micUnavailable = mic !== null && mic !== 'granted';

  const name = remote?.name || fallbackName;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {remote?.profile_picture ? (
        <Image source={{ uri: cdnImage(remote.profile_picture, 400) }} style={styles.bg} contentFit="cover" />
      ) : fallbackBackground ? (
        <RNImage source={fallbackBackground} style={styles.bg} resizeMode="cover" />
      ) : (
        <View style={[styles.bg, { backgroundColor: '#2B2A29' }]} />
      )}
      <View style={styles.overlay} />

      <View style={[styles.content, {
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 20,
        paddingLeft: insets.left + 20,
        paddingRight: insets.right + 20,
      }]}>
        <View style={styles.header}>
          <Pressable
            onPress={minimise}
            hitSlop={8}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Minimise call"
            accessibilityHint="Keeps the call going while you use the app"
          >
            <Feather name="chevron-down" size={26} color="#FFF" />
          </Pressable>
          <StatusBadge />
          <View style={{ width: 48 }} />
        </View>

        <View style={styles.middle}>
          <VoiceVisualizer />
        </View>

        <View style={styles.info}>
          <CallTimer />
          <Text style={styles.name} numberOfLines={2}>{name}</Text>
          <View style={styles.chips}>
            <RemoteMutedBadge />
            {!!subtitle?.label && (
              <View style={styles.chip}>
                <Feather name={subtitle.icon} size={14} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.chipText} numberOfLines={1}>{subtitle.label}</Text>
              </View>
            )}
          </View>
        </View>

        {micUnavailable && (
          <Pressable style={styles.micBanner} onPress={toggleMicrophone} accessibilityRole="button">
            <Feather name="alert-triangle" size={18} color="#FDE68A" />
            <Text style={styles.micBannerText}>Your microphone is off, so {name.split(' ')[0]} cannot hear you.</Text>
            <Text style={styles.micBannerAction}>Allow</Text>
          </Pressable>
        )}

        <CallControls
          available={route.available}
          current={route.current}
          onSelectRoute={route.select}
          onOpenRouteMenu={() => setRouteSheetOpen(true)}
          micMuted={micMuted}
          micUnavailable={micUnavailable}
          onToggleMic={toggleMicrophone}
          onEnd={onEnd}
        />
        <Text style={styles.secure}>This call is confidential and secure</Text>
      </View>

      {routeSheetOpen && (
        <AudioRouteSheet
          available={route.available}
          current={route.current}
          onSelect={route.select}
          onClose={() => setRouteSheetOpen(false)}
        />
      )}
      <MicPermissionSheet />
    </View>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  content: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', marginRight: 8 },
  bar: { width: 3, backgroundColor: '#FFF', marginHorizontal: 1, borderRadius: 2 },
  badgeText: { color: '#FFF', fontSize: 15, fontWeight: '500' },
  middle: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  visualizer: { flexDirection: 'row', alignItems: 'center', height: 200 },
  bigBar: { width: 6, backgroundColor: '#FFF', marginHorizontal: 6, borderRadius: 4 },
  info: { width: '100%', marginBottom: 24 },
  timer: { color: '#FFF', fontSize: 22, fontVariant: ['tabular-nums'], marginBottom: 6, ...shadow },
  name: { color: '#FFF', fontSize: 40, lineHeight: 46, fontWeight: 'bold', marginBottom: 12, ...shadow },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14,
    paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', maxWidth: '100%',
  },
  chipDanger: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  chipText: { color: '#FFF', fontSize: 14 },
  micBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(120,53,15,0.85)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20, minHeight: 48,
  },
  micBannerText: { flex: 1, color: '#FFF', fontSize: 14 },
  micBannerAction: { color: '#FDE68A', fontSize: 15, fontWeight: '700' },
  secure: { color: '#FFF', fontSize: 13, opacity: 0.7, textAlign: 'center', marginTop: 20 },
});
