import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, AppState } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LiveKitRoom } from '@livekit/react-native';
import { useCallStore } from '../store/callStore';
import { useCallUiStore } from '../store/callUiStore';
import { useCall } from '../hooks/useCall';
import { startCallAudioSession, stopCallAudioSession } from '../lib/audioSession';
import { stopCallForegroundService } from '../lib/callForegroundService';
import { startRingback, stopRingback, startRingtone, stopRingtone } from '../lib/callTones';
import { useMicGate } from '../lib/micPermission';
import { router } from 'expo-router';
import { reportCallProblem } from '../lib/callReport';
import { callSoundsEnabled } from '../lib/localPrefs';
import { cdnImage } from '../lib/cdnImage';
import { ROOM_OPTIONS } from '../lib/roomOptions';
import { CallRoomLifecycle } from '../hooks/useCallRoomLifecycle';
import { ActiveCallScreen } from './call/ActiveCallScreen';
import { FloatingCallPill } from './call/FloatingCallPill';
import { MicPermissionSheet } from './call/MicPermissionSheet';

const LOG = '[Call/Nurse]';
const CONNECT_TIMEOUT_MS = 20000;

function useCallLogger() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const store = useCallStore.getState();
      if (store.status === 'IDLE') return;
      if (next === 'background') {
        console.log(LOG, 'Background Transition - app backgrounded during call, status=', store.status);
      } else if (next === 'active') {
        console.log(LOG, 'Foreground Transition - app foregrounded during call, status=', store.status);
      }
    });
    return () => sub.remove();
  }, []);
}

export const CallModals = () => {
  const isIncoming = useCallStore((s) => s.isIncoming);
  const isOutgoing = useCallStore((s) => s.isOutgoing);
  const kind = useCallStore((s) => s.kind);
  const isActive = useCallStore((s) => s.isActive);
  const status = useCallStore((s) => s.status);
  const remoteParticipant = useCallStore((s) => s.remoteParticipant);
  const callId = useCallStore((s) => s.callId);
  const roomToken = useCallStore((s) => s.roomToken);
  const livekitUrl = useCallStore((s) => s.livekitUrl);
  const endCall = useCallStore((s) => s.endCall);
  const { acceptCall, rejectCall, hangupCall } = useCall();
  const [audioSessionReady, setAudioSessionReady] = useState(false);
  const [connectTimedOut, setConnectTimedOut] = useState(false);
  const minimised = useCallUiStore((s) => s.minimised);
  const micGateOpen = useMicGate((s) => s.open);

  useCallLogger();

  // The call is over (or never started): release the foreground service and its notification.
  useEffect(() => {
    if (!isActive && !isOutgoing) stopCallForegroundService();
  }, [isActive, isOutgoing]);

  // A finished call never leaves the next one minimised or with a menu open. (After a call the store
  // can move straight on to the next queued request, so this follows the call id, not just IDLE.)
  useEffect(() => {
    useCallUiStore.getState().reset();
  }, [callId]);

  // Remember the call while it is live so its summary can be shown once it ends
  // (Figma "Support session ended successfully"). Only nurse sessions get a summary.
  const connectedAt = useCallStore((s) => s.connectedAt);
  const last = useRef<{ id: number; name: string; picture?: string | null; trimester?: string | null; startedAt: number; kind: string } | null>(null);
  if (callId && connectedAt && remoteParticipant) {
    last.current = {
      id: callId, name: remoteParticipant.name, picture: remoteParticipant.profile_picture,
      trimester: remoteParticipant.trimester, startedAt: connectedAt, kind,
    };
  }
  useEffect(() => {
    // The call is over once the store has moved off it (IDLE, or on to the next queued request).
    if (!last.current || (callId === last.current.id && status !== 'IDLE')) return;
    const done = last.current;
    last.current = null;
    if (done.kind !== 'nurse') return;
    router.push({
      pathname: '/call-summary',
      params: {
        callId: String(done.id),
        name: done.name,
        picture: done.picture ?? '',
        trimester: done.trimester ?? '',
        seconds: String(Math.max(0, Math.round((Date.now() - done.startedAt) / 1000))),
      },
    } as any);
  }, [status, callId]);

  // Ring while a request is waiting and we're not already on a call - the WebSocket path has no
  // notification sound of its own. Honours Settings > Call sounds (lib/localPrefs.ts).
  const waiting = useCallStore((s) => s.incomingRequests.length > 0);
  const ringing = waiting && !isActive && !isOutgoing;
  useEffect(() => {
    if (!ringing) return;
    let stopped = false;
    callSoundsEnabled().then((on) => {
      if (on && !stopped) startRingtone();
    });
    // Never ring longer than the server's 45s ring timeout.
    const cap = setTimeout(stopRingtone, 45_000);
    return () => {
      stopped = true;
      clearTimeout(cap);
      stopRingtone();
    };
  }, [ringing]);

  // A driver calling the passenger hears a ringback tone (not a ringtone) while it rings.
  const ringingOut = isOutgoing && !isActive && status === 'RINGING';
  useEffect(() => {
    if (!ringingOut) return;
    startRingback();
    return () => { stopRingback(); };
  }, [ringingOut]);

  // Nurses pick up open requests from their dashboard card; a call from the passenger of a ride
  // (or one this user is placing) takes the screen so it can be answered or cancelled.
  const visible = isActive || isOutgoing || (isIncoming && kind === 'ride');

  // Audio session: started as soon as there is a room to join - with or without the microphone
  // (no permission means joining muted, not failing), released when the call is over.
  useEffect(() => {
    if (!isActive || !roomToken) {
      setAudioSessionReady(false);
      return;
    }
    let cancelled = false;
    startCallAudioSession().then((ok) => {
      if (!cancelled) setAudioSessionReady(ok);
    });
    return () => { cancelled = true; };
  }, [isActive, roomToken]);

  useEffect(() => {
    if (!isActive) stopCallAudioSession();
  }, [isActive]);

  useEffect(() => {
    setConnectTimedOut(false);
    if (!isActive || !roomToken || status === 'CONNECTED') return;
    const timer = setTimeout(() => {
      const current = useCallStore.getState();
      if (current.callId === callId && current.status !== 'CONNECTED' && current.isActive) {
        setConnectTimedOut(true);
        reportCallProblem(callId, 'connect_timeout', `no connection after ${CONNECT_TIMEOUT_MS}ms, status=${current.status}`);
      }
    }, CONNECT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isActive, roomToken, callId, status === 'CONNECTED']);

  const handleAccept = () => {
    if (callId) acceptCall(callId);
  };
  const handleDecline = () => {
    if (callId) rejectCall(callId);
  };
  const handleEnd = () => {
    if (callId) hangupCall(callId); else endCall('ENDED');
  };

  const incomingScreen = visible && isIncoming && !isActive && !!callId;
  const roomReady = isActive && !!roomToken && !!livekitUrl && audioSessionReady && !connectTimedOut;

  const hasTrimester = remoteParticipant?.trimester || remoteParticipant?.pregnancy_week;
  const trimesterLabel = hasTrimester
    ? `${remoteParticipant?.trimester || ''} ${remoteParticipant?.pregnancy_week ? `• Week ${remoteParticipant.pregnancy_week}` : ''}`.trim()
    : '';

  // ---- The room: mounted ONCE per call. Full screen and minimised are views of the same
  // <LiveKitRoom>, so switching never disconnects the call or touches the microphone. ----
  const roomModalVisible = roomReady && !minimised;
  const room = roomReady ? (
    <LiveKitRoom serverUrl={livekitUrl!} token={roomToken!} connect audio={false} video={false} options={ROOM_OPTIONS}>
      <CallRoomLifecycle />
      <Modal
        visible={roomModalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => {
          const ui = useCallUiStore.getState();
          if (useMicGate.getState().open) useMicGate.getState().finish('cancelled');
          else if (ui.routeSheetOpen) ui.setRouteSheetOpen(false);
          else ui.minimise();
        }}
      >
        <ActiveCallScreen
          fallbackName={kind === 'ride' ? 'Your passenger' : 'A mother'}
          subtitle={hasTrimester
            ? { icon: 'heart', label: trimesterLabel }
            : remoteParticipant?.hospital_affiliation ? { icon: 'briefcase', label: remoteParticipant.hospital_affiliation }
            : kind === 'ride' ? { icon: 'navigation', label: 'Your passenger' } : null}
          onEnd={handleEnd}
        />
      </Modal>
    </LiveKitRoom>
  ) : null;

  // ---- Everything before the room (ringing, connecting, problems). ----
  let content: React.ReactNode = null;
  if (!visible || roomReady) {
    content = null;
  } else if (incomingScreen) {
    const specialtyLabel = kind === 'ride' ? 'Your passenger' : trimesterLabel || remoteParticipant?.hospital_affiliation || '';
    content = (
      <View style={styles.incomingContainer}>
        <StatusBar style='light' />
        <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill}>
          <SafeAreaView style={styles.incomingSafeArea}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <View style={styles.incomingAvatarPlaceholder}>
                {remoteParticipant?.profile_picture ? (
                  <Image source={{ uri: cdnImage(remoteParticipant.profile_picture, 400) }} style={styles.incomingAvatar} contentFit="cover" />
                ) : (
                  <Text style={styles.incomingAvatarInitial}>{(remoteParticipant?.name || 'M')[0]}</Text>
                )}
              </View>
              <Text style={styles.incomingName}>{remoteParticipant?.name || 'Incoming Call'}</Text>
              {!!specialtyLabel && <Text style={styles.incomingSubtitle}>{specialtyLabel}</Text>}
            </View>

            <View style={styles.incomingActions}>
              <View style={styles.incomingActionWrapper}>
                <TouchableOpacity style={[styles.incomingBtn, styles.declineBtn]} onPress={handleDecline} accessibilityRole="button" accessibilityLabel="Decline call">
                  <MaterialIcons name="call-end" size={32} color="white" />
                </TouchableOpacity>
                <Text style={styles.incomingActionLabel}>Decline</Text>
              </View>
              <View style={styles.incomingActionWrapper}>
                <TouchableOpacity style={[styles.incomingBtn, styles.acceptBtnUI]} onPress={handleAccept} accessibilityRole="button" accessibilityLabel="Answer call">
                  <Feather name="phone" size={32} color="white" />
                </TouchableOpacity>
                <Text style={styles.incomingActionLabel}>Answer</Text>
              </View>
            </View>
          </SafeAreaView>
        </BlurView>
      </View>
    );
  } else if (isOutgoing && !isActive) {
    content = (
      <View style={styles.centerContent}>
        <StatusBar style='light' />
        <TouchableOpacity
          style={[styles.iconButton, styles.minimiseCorner]}
          onPress={() => useCallUiStore.getState().minimise()}
          accessibilityRole="button"
          accessibilityLabel="Minimise call"
        >
          <Feather name="chevron-down" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {status === 'ACCEPTED' || status === 'CONNECTING' ? 'Connecting…' : `Calling ${remoteParticipant?.name || 'your passenger'}…`}
        </Text>
        <Text style={styles.statusText}>{kind === 'ride' ? 'Ringing your passenger' : 'Ringing'}</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => { if (callId) hangupCall(callId); else endCall('CANCELLED'); }} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (isActive && roomToken && !livekitUrl) {
    content = (
      <View style={styles.centerContent}>
        <Text style={styles.title}>Call Failed</Text>
        <Text style={styles.statusText}>Could not reach the call server. Please try again.</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => { if (callId) hangupCall(callId); else endCall('FAILED'); }}>
          <Text style={styles.cancelText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (isActive && roomToken && connectTimedOut) {
    content = (
      <View style={styles.centerContent}>
        <Text style={styles.title}>Connection Failed</Text>
        <Text style={styles.statusText}>Could not establish a connection.</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => { if (callId) hangupCall(callId); else endCall('FAILED'); }}>
          <Text style={styles.cancelText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (isActive && roomToken) {
    content = (
      <View style={styles.centerContent}>
        <Text style={styles.title}>Preparing Audio...</Text>
      </View>
    );
  }

  const preRoomVisible = !!content && (incomingScreen || !minimised);
  const pillVisible = visible && minimised && !incomingScreen;
  // The permission sheet goes inside whichever call Modal is up; with none (answering from the
  // dashboard card) it gets its own.
  const ownGateModal = micGateOpen && !preRoomVisible && !roomModalVisible;

  return (
    <>
      {room}
      {preRoomVisible && (
        <Modal
          visible
          animationType="fade"
          transparent
          statusBarTranslucent
          onRequestClose={() => {
            if (useMicGate.getState().open) useMicGate.getState().finish('cancelled');
            else if (!incomingScreen) useCallUiStore.getState().minimise();
          }}
        >
          {content}
          <MicPermissionSheet />
        </Modal>
      )}
      {pillVisible && (
        <FloatingCallPill
          subtitle={trimesterLabel || (kind === 'ride' ? 'Your passenger' : 'Mother')}
          onEnd={handleEnd}
        />
      )}
      {ownGateModal && (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => useMicGate.getState().finish('cancelled')}>
          <MicPermissionSheet />
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bgImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  safeArea: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.4)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  soundBarsContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  soundBar: { width: 2, backgroundColor: '#FFF', marginHorizontal: 1.5, borderRadius: 2 },
  badgeText: { color: '#FFF', fontSize: 16, fontWeight: '500' },
  minimiseCorner: { position: 'absolute', top: 56, left: 20 },
  iconButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center' },
  centerGraphic: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  visualizerContainer: { flexDirection: 'row', alignItems: 'center' },
  bigBar: { width: 6, backgroundColor: '#FFF', marginHorizontal: 6, borderRadius: 4 },
  infoContainer: { alignItems: 'flex-start', width: '100%', marginBottom: 40 },
  timerContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  timerMinutes: { color: '#FFF', fontSize: 24, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  timerSeconds: { color: '#FFF', fontSize: 18, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  nurseName: { color: '#FFF', fontSize: 48, lineHeight: 52, marginBottom: 16, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  specialtyBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.15)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  specialtyText: { color: '#FFF', fontSize: 14 },
  footer: { width: '100%', alignItems: 'center' },
  endCallBtn: { backgroundColor: '#FF3B30', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 200, height: 56, borderRadius: 28, marginBottom: 24 },
  endCallText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  secureText: { color: '#FFF', fontSize: 14, opacity: 0.8 },
  outputPicker: { position: 'absolute', bottom: 140, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 16, padding: 8, minWidth: 200 },
  outputOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  outputOptionSelected: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10 },
  outputOptionText: { color: 'white', fontSize: 15, textTransform: 'capitalize' },
  centerContent: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, color: '#fff', fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
  statusText: { fontSize: 16, color: '#94a3b8', marginTop: 8, marginBottom: 50, textAlign: 'center' },
  cancelBtn: { backgroundColor: '#ef4444', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, marginTop: 20 },
  cancelText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  
  // INCOMING STYLES
  incomingContainer: { flex: 1, backgroundColor: '#111' },
  incomingSafeArea: { flex: 1, justifyContent: 'space-between', paddingBottom: 60, paddingTop: 80 },
  incomingAvatarPlaceholder: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 24 },
  incomingAvatar: { width: '100%', height: '100%', borderRadius: 70 },
  incomingAvatarInitial: { color: '#FFF', fontSize: 48, fontWeight: 'bold' },
  incomingName: { color: 'white', fontSize: 36, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  incomingSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 20, textAlign: 'center' },
  incomingActions: { flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: 20 },
  incomingActionWrapper: { alignItems: 'center' },
  incomingBtn: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  declineBtn: { backgroundColor: '#FF3B30' },
  acceptBtnUI: { backgroundColor: '#34C759' },
  incomingActionLabel: { color: 'white', fontSize: 18, fontWeight: '500' }
});
