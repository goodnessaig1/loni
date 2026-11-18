import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Image as RNImage, AppState } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallStore } from '../store/callStore';
import { useCallUiStore } from '../store/callUiStore';
import { useCall } from '../hooks/useCall';
import { LiveKitRoom } from '@livekit/react-native';
import { startCallAudioSession, stopCallAudioSession } from '../lib/audioSession';
import { stopCallForegroundService } from '../lib/callForegroundService';
import { startRingback, stopRingback, startRingtone, stopRingtone } from '../lib/callTones';
import { useMicGate } from '../lib/micPermission';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { reportCallProblem } from '../lib/callReport';
import { useRideStore } from '../store/rideStore';
import { cdnImage } from '../lib/cdnImage';
import { CallRoomLifecycle } from '../hooks/useCallRoomLifecycle';
import { ActiveCallScreen } from './call/ActiveCallScreen';
import { FloatingCallPill } from './call/FloatingCallPill';
import { MicPermissionSheet } from './call/MicPermissionSheet';
import { ROOM_OPTIONS } from '../lib/roomOptions';

const RIDE_LIVE = ['SEARCHING', 'DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS'];

const LOG = '[Call/Mother]';
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
  const isOutgoing = useCallStore((s) => s.isOutgoing);
  const isIncoming = useCallStore((s) => s.isIncoming);
  const isActive = useCallStore((s) => s.isActive);
  const status = useCallStore((s) => s.status);
  const callId = useCallStore((s) => s.callId);
  const roomToken = useCallStore((s) => s.roomToken);
  const livekitUrl = useCallStore((s) => s.livekitUrl);
  const remoteParticipant = useCallStore((s) => s.remoteParticipant);
  const callerName = useCallStore((s) => s.callerName);
  const kind = useCallStore((s) => s.kind);
  const endCall = useCallStore((s) => s.endCall);
  const { hangupCall, acceptCall, rejectCall } = useCall();
  const router = useRouter();
  // While an emergency ride is live, the ride card shows the call inline (Figma "ride pill" states),
  // so the full-screen call UI stays out of the way. Incoming calls still take the screen so she can answer.
  const rideLive = useRideStore((s) => RIDE_LIVE.includes(s.ride?.status ?? s.status));
  const lastKind = useRef(kind);
  
  const wasConnected = useRef(false);
  const lastCallId = useRef<number | null>(null);
  const lastNurseName = useRef<string | null>(null);
  const lastConnectedAt = useRef<number | null>(null);

  const lastAvatar = useRef<string | null>(null);
  const [audioSessionReady, setAudioSessionReady] = useState(false);
  const [connectTimedOut, setConnectTimedOut] = useState(false);
  const minimised = useCallUiStore((s) => s.minimised);
  const micGateOpen = useMicGate((s) => s.open);

  useCallLogger();

  // A finished call never leaves the next one minimised or with a menu open.
  useEffect(() => {
    if (status === 'IDLE') useCallUiStore.getState().reset();
  }, [status]);

  // The call is over (or never started): release the foreground service and its notification.
  useEffect(() => {
    if (!isActive && !isOutgoing) stopCallForegroundService();
  }, [isActive, isOutgoing]);

  // Track call ID, nurse name, and connected state while call is active
  if (callId) {
    lastCallId.current = callId;
  }
  if (remoteParticipant?.name || callerName) {
    lastNurseName.current = remoteParticipant?.name || callerName;
  }
  if (remoteParticipant?.profile_picture) lastAvatar.current = remoteParticipant.profile_picture;
  if (status !== 'IDLE') {
    lastKind.current = kind;
  }
  const currentConnectedAt = useCallStore.getState().connectedAt;
  if (currentConnectedAt) {
    lastConnectedAt.current = currentConnectedAt;
  }
  // Only a call that actually connected gets the rating screen.
  if (status === 'CONNECTED' || currentConnectedAt) {
    wasConnected.current = true;
  }

  // Tell her why the call screen went away when nobody answered.
  const lastEventStatus = useCallStore((s) => s.lastEventStatus);
  const wasRinging = useRef(false);
  if (isOutgoing && status === 'RINGING') wasRinging.current = true;
  useEffect(() => {
    if (status !== 'IDLE' || !wasRinging.current) return;
    wasRinging.current = false;
    if (wasConnected.current) return;
    const who = lastKind.current === 'ride' ? 'Your driver' : 'No nurse';
    const msg: Record<string, [string, string]> = {
      TIMEOUT: [lastKind.current === 'ride' ? 'Your driver did not answer' : 'No nurse answered', 'Please try again in a moment.'],
      REJECTED: [lastKind.current === 'ride' ? 'Your driver declined the call' : 'No nurse could take your call', 'Please try again in a few minutes.'],
      MISSED: [`${who} could be reached`, 'Please try again in a moment.'],
      FAILED: ['The call could not be connected', 'Check your connection and try again.'],
    };
    const m = lastEventStatus ? msg[lastEventStatus] : undefined;
    if (m) Toast.show({ type: 'info', text1: m[0], text2: m[1] });
  }, [status, lastEventStatus]);

  useEffect(() => {
    // When the call terminates (status transitions to IDLE) and was previously connected/active, route to rating
    if (status === 'IDLE' && wasConnected.current && lastCallId.current) {
      const idToRate = lastCallId.current;
      const nurseNameToRate = lastNurseName.current;
      const avatarToPass = lastAvatar.current;
      lastAvatar.current = null;
      
      let durationStr = '';
      if (lastConnectedAt.current) {
        const diffInSeconds = Math.max(0, Math.floor((Date.now() - lastConnectedAt.current) / 1000));
        if (diffInSeconds < 60) {
          durationStr = `${diffInSeconds} secs`;
        } else {
          const mins = Math.floor(diffInSeconds / 60);
          const secs = diffInSeconds % 60;
          durationStr = secs > 0 ? `${mins} min${mins > 1 ? 's' : ''} ${secs} sec${secs > 1 ? 's' : ''}` : `${mins} min${mins > 1 ? 's' : ''}`;
        }
      }

      wasConnected.current = false;
      lastCallId.current = null;
      lastNurseName.current = null;
      lastConnectedAt.current = null;
      // Only nurse sessions are rated; a call with her driver just ends.
      if (lastKind.current === 'ride') return;

      console.log(LOG, 'Call ended, navigating to nurse rating screen for callId:', idToRate);
      router.push({
        pathname: '/nurse/rating',
        params: {
          callId: String(idToRate),
          name: nurseNameToRate || 'Nurse',
          avatar: avatarToPass || '',
          duration: durationStr,
        },
      });
    }
  }, [status, router]);

  const visible = isOutgoing || isIncoming || isActive;

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

  // Ringing sounds. The CALLER hears a ringback tone (never a ringtone - see lib/callTones.ts); only
  // the RECEIVER's phone rings. InCallManager is never start()ed (lib/audioSession.ts).
  const ringingOut = isOutgoing && !isActive && status === 'RINGING';
  const ringingIn = isIncoming && !isActive && !isOutgoing && status === 'INCOMING';
  useEffect(() => {
    if (!ringingOut) return;
    startRingback();
    return () => { stopRingback(); };
  }, [ringingOut]);
  useEffect(() => {
    if (!ringingIn) return;
    startRingtone();
    return () => stopRingtone();
  }, [ringingIn]);

  const handleCancel = () => {
    if (callId) hangupCall(callId);
    else endCall('CANCELLED');
  };
  const handleAccept = () => {
    if (callId) acceptCall(callId);
  };
  const handleDecline = () => {
    if (callId) rejectCall(callId);
  };

  const incomingScreen = visible && isIncoming && !isActive && !!callId;
  // While an emergency ride is live the ride card shows the call; an incoming call still takes the screen.
  const compact = rideLive && !incomingScreen;
  const roomReady = isActive && !!roomToken && !!livekitUrl && audioSessionReady && !connectTimedOut;

  // ---- The room: mounted ONCE per call, whatever is on screen. ----
  // Full screen, minimised and the ride card are views of the same <LiveKitRoom>, so switching
  // between them never disconnects the call or touches the microphone. Context reaches the call
  // screen through its <Modal>.
  const roomModalVisible = roomReady && !compact && !minimised;
  const room = roomReady ? (
    <LiveKitRoom serverUrl={livekitUrl!} token={roomToken!} connect audio={false} video={false} options={ROOM_OPTIONS}>
      <CallRoomLifecycle />
      {!compact && (
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
            fallbackName={kind === 'ride' ? 'Your driver' : 'Your nurse'}
            fallbackBackground={require('../assets/images/nurse-img.png')}
            subtitle={remoteParticipant?.hospital_affiliation ? { icon: 'briefcase', label: remoteParticipant.hospital_affiliation } : null}
            onEnd={handleCancel}
          />
        </Modal>
      )}
    </LiveKitRoom>
  ) : null;

  // ---- Everything before the room (ringing, connecting, problems). ----
  let content: React.ReactNode = null;
  if (!visible || roomReady) {
    content = null;
  } else if (incomingScreen) {
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
                  <Text style={styles.incomingAvatarInitial}>{(remoteParticipant?.name || 'N')[0]}</Text>
                )}
              </View>
              <Text style={styles.incomingName}>{remoteParticipant?.name || 'Incoming Call'}</Text>
              {!!remoteParticipant?.hospital_affiliation && (
                <Text style={styles.incomingSubtitle}>{remoteParticipant.hospital_affiliation}</Text>
              )}
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
  } else if (compact) {
    content = null; // ringing / connecting: the ride card shows it
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
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (isActive && roomToken && !audioSessionReady) {
    content = (
      <View style={styles.centerContent}>
        <Text style={styles.title}>Preparing Audio...</Text>
      </View>
    );
  } else {
    // OUTGOING CALL
    const who = kind === 'ride' ? 'Your driver' : 'A nurse';
    const label =
      status === 'ACCEPTED' || status === 'CONNECTING' ? `${remoteParticipant?.name || who} accepted - connecting...` :
      remoteParticipant?.name ? `Calling ${remoteParticipant.name}...` :
      kind === 'ride' ? 'Calling your driver...' : 'Searching for available nurse...';
    content = (
      <View style={styles.container}>
        <RNImage source={require('../assets/images/talk-to-nurse.png')} style={styles.bgImage} resizeMode="cover" />
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
          <SafeAreaView style={styles.outgoingSafeArea}>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => useCallUiStore.getState().minimise()}
                accessibilityRole="button"
                accessibilityLabel="Minimise call"
              >
                <Feather name="chevron-down" size={24} color="#FFF" />
              </TouchableOpacity>
              <View style={styles.badge}>
                <Feather name="phone" size={16} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.badgeText}>{kind === 'ride' ? 'Call Driver' : 'Talk to a Nurse'}</Text>
              </View>
              <View style={{ width: 48 }} />
            </View>
            <View style={styles.content}>
              <Text style={styles.outgoingTitle}>{label}</Text>
              <Text style={styles.subtitle}>{kind === 'ride' ? 'Please wait while we connect you with your driver' : 'Please wait while we connect you with a certified maternal nurse'}</Text>
            </View>
            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelBtnFull} onPress={handleCancel} accessibilityRole="button">
                <Feather name="x" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </BlurView>
      </View>
    );
  }

  const preRoomVisible = !!content && (incomingScreen || !minimised);
  const pillVisible = visible && minimised && !compact && !incomingScreen;
  // The permission sheet goes inside whichever call Modal is up; with none (placing a call, or a
  // nurse answering from her dashboard) it gets its own.
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
      {pillVisible && <FloatingCallPill />}
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
  outgoingSafeArea: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  content: { alignItems: 'center', width: '100%' },
  outgoingTitle: { color: '#FFF', fontSize: 30, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, lineHeight: 36 },
  subtitle: { color: '#FFF', fontSize: 14, textAlign: 'center', opacity: 0.9 },
  cancelBtnFull: { width: '100%', height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  
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
