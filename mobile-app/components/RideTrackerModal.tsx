import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { HelixaText } from './HelixaText';
import { useRideStore, RideStatus } from '../store/rideStore';
import { useCallStore } from '../store/callStore';
import { ridesApi } from '../api/rides';
import { useCall } from '../hooks/useCall';
import { useAuth } from '../hooks/useAuth';
import { useActiveRideSync } from '../hooks/useRides';
import { useEmergencyContacts } from '../context/EmergencyContactsContext';
import { toggleMicrophone } from '../lib/activeRoom';

/**
 * The emergency-ride status card (Figma "ride pill"). One card follows the whole trip:
 * finding support → notifying her support circle → finding a driver → help is on the way →
 * driver getting close → ride arrived → on the way → getting ready for arrival → almost there →
 * arrived safely. Calls she makes from it (a nurse, her driver) play inline in the card.
 */

const C = {
  card: '#000000',
  panel: '#1C1C1E',
  chip: '#2C2C2E',
  text: '#FFFFFF',
  muted: '#A1A1AA',
  cancel: '#C65A5E',
  hangup: '#EF4444',
  brand: '#D62D88',
};

type IconName = 'hospital-building' | 'account-group' | 'car' | 'car-side' | 'flag-checkered' | 'alert-circle-outline';

interface Stage {
  key: string;
  title: string;
  sub: string;
  icon: IconName;
}

const LIVE: RideStatus[] = ['SEARCHING', 'DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS'];
const FAILED: RideStatus[] = ['CANCELLED', 'NO_DRIVERS', 'FAILED'];

function secondsSince(iso?: string | null, now = Date.now()) {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Infinity : (now - t) / 1000;
}

function stageFor(status: RideStatus, opts: {
  driverName: string;
  sinceRequest: number;
  sinceStart: number;
  notifying: boolean;
  near: boolean;
  rematching?: boolean;
}): Stage {
  const { driverName, sinceRequest, sinceStart, notifying, near, rematching } = opts;
  switch (status) {
    case 'SEARCHING':
      if (rematching) {
        return { key: 'driver', title: 'Finding you another driver', sub: "Your driver couldn't make it. We're finding you another one right now.", icon: 'car' };
      }
      if (sinceRequest < 4) {
        return { key: 'support', title: 'Finding nearby support…', sub: "Please stay calm. We're checking for the fastest available help near you.", icon: 'hospital-building' };
      }
      if (notifying && sinceRequest < 9) {
        return { key: 'circle', title: 'Notifying your support circle', sub: 'Your emergency contacts are being informed and support is on the way.', icon: 'account-group' };
      }
      return { key: 'driver', title: 'Finding the nearest driver…', sub: "We're locating the fastest available ride for you right now.", icon: 'car' };
    case 'DRIVER_ASSIGNED':
    case 'DRIVER_EN_ROUTE':
      if (near) {
        return { key: 'close', title: 'Your driver is getting close', sub: 'Please keep your phone nearby and prepare if you can.', icon: 'car' };
      }
      return { key: 'onway', title: 'Help is on the way', sub: `${driverName} accepted your request and is heading to your location.`, icon: 'car' };
    case 'DRIVER_ARRIVED':
      return { key: 'arrived', title: 'Your ride has arrived', sub: `${driverName} is outside waiting for you.`, icon: 'car' };
    case 'IN_PROGRESS':
      if (near) {
        return { key: 'almost', title: 'Almost there', sub: "You're a few minutes away. Stay calm, you're doing well.", icon: 'car' };
      }
      if (sinceStart < 90) {
        return { key: 'trip', title: "You're on the way", sub: 'Your trip is now active. Your support partner can follow your journey.', icon: 'car' };
      }
      return { key: 'ready', title: 'Getting ready for your arrival', sub: 'Your destination and trip details have been shared for smoother support on arrival.', icon: 'hospital-building' };
    case 'COMPLETED':
      return { key: 'done', title: "You've arrived safely", sub: 'Your trip has ended. We hope everything goes smoothly from here.', icon: 'car' };
    case 'CANCELLED':
      return { key: 'cancelled', title: 'Ride cancelled', sub: 'This ride was cancelled. You can request another.', icon: 'alert-circle-outline' };
    case 'NO_DRIVERS':
      return { key: 'nodrivers', title: 'No drivers available', sub: "We couldn't reach a driver. Try again, or talk to a nurse.", icon: 'alert-circle-outline' };
    default:
      return { key: 'failed', title: 'Something went wrong', sub: 'Please try requesting again.', icon: 'alert-circle-outline' };
  }
}

function etaText(seconds?: number | null, meters?: number | null) {
  const parts: string[] = [];
  if (seconds != null) parts.push(`${Math.max(1, Math.round(seconds / 60))}min`);
  if (meters != null) parts.push(meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`);
  return parts.join(' | ');
}

/* ── small pieces ─────────────────────────────────────────────────────────────── */

const Pill = ({ icon, label, onPress, disabled, flex }: {
  icon?: keyof typeof Feather.glyphMap; label: string; onPress?: () => void; disabled?: boolean; flex?: boolean;
}) => (
  <TouchableOpacity
    style={[styles.pill, flex && { flex: 1, justifyContent: 'center' }, disabled && { opacity: 0.7 }]}
    onPress={onPress}
    disabled={disabled || !onPress}
    activeOpacity={0.7}>
    {disabled ? (
      <ActivityIndicator size="small" color={C.text} style={{ marginRight: 6, transform: [{ scale: 0.7 }] }} />
    ) : icon ? (
      <Feather name={icon} size={13} color={C.text} style={{ marginRight: 6 }} />
    ) : null}
    <HelixaText style={styles.pillText}>{label}</HelixaText>
  </TouchableOpacity>
);

const Avatar = ({ uri, name, size = 36 }: { uri?: string | null; name?: string | null; size?: number }) =>
  uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
  ) : (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <HelixaText weight="bold" style={{ color: C.text }}>{(name || '?').charAt(0).toUpperCase()}</HelixaText>
    </View>
  );

const CallControls = ({ muted, onMute, onHangup }: { muted: boolean; onMute: () => void; onHangup: () => void }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <MaterialCommunityIcons name="waveform" size={20} color={C.muted} />
    <TouchableOpacity style={[styles.roundBtn, { backgroundColor: muted ? C.hangup : C.text }]} onPress={onMute}>
      <Feather name={muted ? 'mic-off' : 'mic'} size={14} color={muted ? C.text : '#000'} />
    </TouchableOpacity>
    <TouchableOpacity style={[styles.roundBtn, { backgroundColor: C.hangup }]} onPress={onHangup}>
      <MaterialCommunityIcons name="phone-hangup" size={16} color={C.text} />
    </TouchableOpacity>
  </View>
);

/* ── the card ─────────────────────────────────────────────────────────────────── */

interface RideTrackerModalProps {
  onClose: () => void;
}

export default function RideTrackerModal({ onClose }: RideTrackerModalProps) {
  const router = useRouter();
  const ride = useRideStore((s) => s.ride);
  const storeStatus = useRideStore((s) => s.status);
  const progress = useRideStore((s) => s.progress);
  const clear = useRideStore((s) => s.clear);
  const { contacts } = useEmergencyContacts();

  const callStatus = useCallStore((s) => s.status);
  const callKind = useCallStore((s) => s.kind);
  const callIsActive = useCallStore((s) => s.isActive);
  const callId = useCallStore((s) => s.callId);
  const remote = useCallStore((s) => s.remoteParticipant);
  const micMuted = useCallStore((s) => s.micMuted);
  const { requestCall, hangupCall } = useCall();

  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [now, setNow] = useState(Date.now());

  const st: RideStatus = ride?.status ?? storeStatus;
  const driver = ride?.driver;
  const driverName = driver?.name?.split(' ')[0] || 'Your driver';
  const connectedPartners = contacts.filter((c) => c.status === 'connected' && c.emergency);

  // Time-based stages (the first seconds of a search, the start of the trip) need a clock.
  const timed = st === 'SEARCHING' || st === 'IN_PROGRESS';
  useEffect(() => {
    if (!timed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timed]);

  const stage = stageFor(st, {
    driverName,
    sinceRequest: secondsSince(ride?.requested_at, now),
    sinceStart: secondsSince(ride?.started_at, now),
    notifying: !!ride?.notify_contacts && connectedPartners.length > 0,
    rematching: !!ride?.rematching,
    near: !!progress?.near && (st === 'IN_PROGRESS' ? progress.phase === 'to_dropoff' : progress.phase === 'to_pickup'),
  });

  const live = LIVE.includes(st);
  const failed = FAILED.includes(st);

  const callBusy = callStatus !== 'IDLE';
  const callLive = callIsActive && ['CONNECTING', 'CONNECTED', 'RECONNECTING'].includes(callStatus);
  const nurseRinging = callBusy && !callLive && callKind === 'nurse';
  const driverRinging = callBusy && !callLive && callKind === 'ride';
  const nurseLive = callLive && callKind === 'nurse';
  const driverLive = callLive && callKind === 'ride';

  const eta = useMemo(() => {
    if (progress) return etaText(progress.eta_seconds, progress.remaining_meters);
    return etaText(ride?.next_route?.duration_seconds ?? ride?.duration_seconds, ride?.next_route?.distance_meters ?? ride?.distance_meters);
  }, [progress, ride]);

  const vehicle = [driver?.vehicle_brand, driver?.vehicle_model].filter(Boolean).join(' ')
    || driver?.vehicle_type || 'Your ride';

  /* actions */
  const talkToNurse = () => {
    if (callBusy) return;
    requestCall().catch(() => Toast.show({ type: 'error', text1: 'Could not reach a nurse', text2: 'Please try again.' }));
  };

  const callDriver = () => {
    if (callBusy || !ride) return;
    requestCall({
      rideId: ride.id,
      remote: driver ? { id: driver.id, name: driver.name, profile_picture: driver.profile_picture ?? null, user_type: 'driver' } : null,
    }).catch((e: any) => Toast.show({ type: 'error', text1: 'Could not call your driver', text2: e?.response?.data?.message }));
  };

  const hangup = () => { if (callId) hangupCall(callId); };

  const notify = async (kind: 'share' | 'arrived') => {
    if (!ride) return;
    setBusy(kind);
    try {
      const res = await ridesApi.notifyContacts(ride.id, kind);
      Toast.show({ type: res.data?.notified ? 'success' : 'info', text1: res.message });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not notify your partner', text2: e?.response?.data?.message });
    } finally {
      setBusy(null);
    }
  };

  const callSupportPartner = () => {
    const partner = connectedPartners.find((c) => !!c.phone) ?? contacts.find((c) => !!c.phone);
    if (!partner) {
      Toast.show({ type: 'info', text1: 'No support partner yet', text2: 'Add one from your profile so you can call them here.' });
      return;
    }
    Linking.openURL(`tel:${partner.phone}`).catch(() => {});
  };

  const cancel = async () => {
    setBusy('cancel');
    try {
      if (ride && live) await ridesApi.cancel(ride.id, 'Cancelled by rider');
    } catch { /* already over on the server; clear locally anyway */ }
    if (callBusy && callKind === 'ride') hangup();
    clear('CANCELLED');
    setBusy(null);
    onClose();
  };

  const dismiss = async () => {
    if (st === 'COMPLETED' && ride && rating > 0 && ride.rider_rating == null) {
      try { await ridesApi.rate(ride.id, rating); } catch { /* rating is optional */ }
    }
    clear('IDLE');
    onClose();
  };

  /* collapsed: a single line, tap to open */
  if (collapsed) {
    return (
      <View style={styles.container} pointerEvents="box-none">
        <TouchableOpacity style={styles.collapsed} activeOpacity={0.85} onPress={() => setCollapsed(false)}>
          <View style={styles.iconBoxSmall}>
            <MaterialCommunityIcons name={stage.icon} size={16} color={C.text} />
          </View>
          <HelixaText weight="bold" style={[styles.title, { flex: 1, marginBottom: 0 }]} numberOfLines={1}>{stage.title}</HelixaText>
          {callLive && <MaterialCommunityIcons name="phone-in-talk" size={16} color="#22C55E" style={{ marginRight: 8 }} />}
          <Feather name="maximize-2" size={14} color={C.muted} />
        </TouchableOpacity>
      </View>
    );
  }

  /* the person she is talking to, shown inside the card */
  const callerCard = (
    <View style={styles.panelRow}>
      <Avatar uri={remote?.profile_picture} name={remote?.name} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <HelixaText weight="bold" style={styles.rowTitle} numberOfLines={1}>{remote?.name || (callKind === 'ride' ? driverName : 'LONI Nurse')}</HelixaText>
        <HelixaText style={styles.rowSub} numberOfLines={1}>
          {callStatus === 'CONNECTED' ? (remote?.hospital_affiliation || 'Maternal Health Specialist') : 'Connecting…'}
        </HelixaText>
      </View>
      <CallControls muted={micMuted} onMute={toggleMicrophone} onHangup={hangup} />
    </View>
  );

  const nurseAction = nurseLive ? callerCard
    : nurseRinging ? <View style={{ alignItems: 'center' }}><Pill label="Connecting to a Nurse…" disabled /></View>
    : (
      <View style={styles.waitRow}>
        <HelixaText style={styles.waitText}>While you wait</HelixaText>
        <Pill icon="phone" label="Talk to a Nurse" onPress={talkToNurse} disabled={false} />
      </View>
    );

  const driverRight = driverLive
    ? <CallControls muted={micMuted} onMute={toggleMicrophone} onHangup={hangup} />
    : driverRinging ? <Pill label="Connecting…" disabled />
    : <Pill icon="phone" label="Call Driver" onPress={callDriver} />;

  const driverRow = (
    <View style={styles.driverRow}>
      <Avatar uri={driver?.profile_picture} name={driver?.name} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <HelixaText weight="bold" style={styles.rowTitle} numberOfLines={1}>{vehicle}</HelixaText>
        <HelixaText style={styles.rowSub} numberOfLines={1}>
          {[driver?.plate_number, eta].filter(Boolean).join('  ·  ')}
        </HelixaText>
      </View>
      {driverRight}
    </View>
  );

  let body: React.ReactNode = null;
  switch (stage.key) {
    case 'support':
    case 'circle':
    case 'driver':
      body = nurseAction;
      break;
    case 'onway':
    case 'close':
      body = (
        <>
          {driverRow}
          {/* while she talks to her driver, the nurse option waits; a nurse call replaces the wait row */}
          {!driverLive && !driverRinging && nurseAction}
        </>
      );
      break;
    case 'arrived':
      body = nurseLive || driverLive ? callerCard : (
        <View style={styles.btnRow}>
          {driverRinging ? <Pill label="Connecting…" disabled flex /> : <Pill icon="phone" label="Call Driver" onPress={callDriver} flex />}
          {nurseRinging ? <Pill label="Connecting…" disabled flex /> : <Pill icon="phone" label="Talk to a Nurse" onPress={talkToNurse} flex />}
        </View>
      );
      break;
    case 'trip':
      body = callLive ? callerCard : (
        <View style={styles.btnRow}>
          <Pill icon="share-2" label="Share Live Trip" onPress={() => notify('share')} disabled={busy === 'share'} flex />
          {nurseRinging ? <Pill label="Connecting…" disabled flex /> : <Pill icon="phone" label="Talk to a Nurse" onPress={talkToNurse} flex />}
        </View>
      );
      break;
    case 'ready':
      body = callLive ? callerCard : (
        <View style={{ alignItems: 'center' }}>
          {nurseRinging ? <Pill label="Connecting to a Nurse…" disabled /> : <Pill icon="phone" label="Talk to a Nurse" onPress={talkToNurse} />}
        </View>
      );
      break;
    case 'almost':
      body = callLive ? callerCard : (
        <View style={{ alignItems: 'center' }}>
          <Pill icon="phone" label="Call Support Partner" onPress={callSupportPartner} />
        </View>
      );
      break;
    case 'done':
      body = (
        <>
          {callLive ? callerCard : (
            <View style={styles.btnRow}>
              {nurseRinging ? <Pill label="Connecting…" disabled flex /> : <Pill icon="phone" label="Talk to a Nurse" onPress={talkToNurse} flex />}
              <Pill icon="bell" label="Notify Partner" onPress={() => notify('arrived')} disabled={busy === 'arrived'} flex />
            </View>
          )}
          {ride?.rider_rating == null && (
            <View style={styles.ratingRow}>
              <HelixaText style={styles.waitText}>Rate your driver</HelixaText>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={6}>
                    <MaterialCommunityIcons name={n <= rating ? 'star' : 'star-outline'} size={22} color={n <= rating ? '#FFC53D' : '#6B7280'} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </>
      );
      break;
    default:
      body = (
        <View style={styles.btnRow}>
          <Pill icon="refresh-cw" label="Try again" onPress={() => { clear('IDLE'); onClose(); router.push('/ride/request'); }} flex />
          {st === 'NO_DRIVERS' && <Pill icon="phone" label="Talk to a Nurse" onPress={() => { clear('IDLE'); onClose(); talkToNurse(); }} flex />}
        </View>
      );
  }

  const showCancel = live && st !== 'DRIVER_ARRIVED' && st !== 'IN_PROGRESS';
  const closable = st === 'COMPLETED' || failed;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name={stage.icon} size={20} color={C.text} />
          </View>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <HelixaText weight="bold" style={styles.title}>{stage.title}</HelixaText>
            <HelixaText style={styles.subtitle}>{stage.sub}</HelixaText>
          </View>
          <TouchableOpacity hitSlop={10} onPress={closable ? dismiss : () => setCollapsed(true)}>
            <Feather name={closable ? 'x' : 'minimize-2'} size={16} color={C.text} />
          </TouchableOpacity>
        </View>

        {body}

        {showCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={cancel} disabled={busy === 'cancel'}>
            <Feather name="x" size={13} color={C.text} style={{ marginRight: 6 }} />
            <HelixaText style={styles.pillText}>Cancel Request</HelixaText>
          </TouchableOpacity>
        )}
        {failed && (
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: C.chip }]} onPress={dismiss}>
            <HelixaText style={styles.pillText}>Dismiss</HelixaText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/**
 * Mounted once at the app root so the card follows her across screens while a ride is live,
 * and the ride is restored from the server when the app reopens.
 */
export function RideTrackerHost() {
  const { user } = useAuth();
  const ride = useRideStore((s) => s.ride);
  const clearRide = useRideStore((s) => s.clear);
  useActiveRideSync(!!user);
  if (!user || !ride || ride.status === 'IDLE') return null;
  return <RideTrackerModal onClose={() => clearRide('IDLE')} />;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 54, left: 12, right: 12, zIndex: 100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
  },
  card: { backgroundColor: C.card, borderRadius: 28, padding: 16, gap: 12 },
  collapsed: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 24,
    paddingVertical: 10, paddingHorizontal: 12, gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBox: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: C.chip,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  iconBoxSmall: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.chip, justifyContent: 'center', alignItems: 'center' },
  title: { color: C.text, fontSize: 15, marginBottom: 2 },
  subtitle: { color: C.muted, fontSize: 12, lineHeight: 17 },
  pill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.chip,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
  },
  pillText: { color: C.text, fontSize: 12, fontWeight: '500' },
  waitRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.panel, borderRadius: 22, paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
  },
  waitText: { color: C.muted, fontSize: 12 },
  panelRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel, borderRadius: 18, padding: 10 },
  driverRow: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { color: C.text, fontSize: 14 },
  rowSub: { color: C.muted, fontSize: 11, marginTop: 1 },
  avatarFallback: { backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  roundBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', gap: 8 },
  ratingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: C.panel, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
  },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.cancel,
    paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20, alignSelf: 'center',
  },
});
