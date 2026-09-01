import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HelixaText } from './HelixaText';
import { useRideStore } from '../store/rideStore';
import { ridesApi } from '../api/rides';
import { useCall } from '../hooks/useCall';

interface RideTrackerModalProps {
  onClose: () => void;
}

const COPY: Record<string, { title: string; sub: string }> = {
  SEARCHING: { title: 'Finding the nearest driver…', sub: "We're locating the fastest available ride for you right now." },
  DRIVER_ASSIGNED: { title: 'Help is on the way', sub: 'accepted your request and is heading to your location.' },
  DRIVER_EN_ROUTE: { title: 'Help is on the way', sub: 'is heading to your location.' },
  DRIVER_ARRIVED: { title: 'Your driver has arrived', sub: 'is waiting for you outside.' },
  IN_PROGRESS: { title: 'On the way to the hospital', sub: "You're on your way. Stay calm — help is close." },
  COMPLETED: { title: "You've arrived", sub: 'Trip complete. Take care of yourself.' },
  CANCELLED: { title: 'Ride cancelled', sub: 'This ride was cancelled. You can request another.' },
  NO_DRIVERS: { title: 'No drivers available', sub: "We couldn't reach a driver. Try again, or talk to a nurse." },
  FAILED: { title: 'Something went wrong', sub: 'Please try requesting again.' },
};

function mins(s?: number | null) {
  if (s == null) return null;
  return `${Math.max(1, Math.round(s / 60))} min`;
}
function km(m?: number | null) {
  if (m == null) return null;
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
function naira(n?: number | null) {
  return n == null ? '' : `₦${Math.round(n).toLocaleString()}`;
}

export default function RideTrackerModal({ onClose }: RideTrackerModalProps) {
  const router = useRouter();
  const ride = useRideStore((s) => s.ride);
  const status = useRideStore((s) => s.status);
  const clear = useRideStore((s) => s.clear);
  const { requestCall } = useCall();

  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);

  const driver = ride?.driver;
  const st = ride?.status ?? status;
  const copy = COPY[st] ?? COPY.SEARCHING;

  const eta = useMemo(() => {
    const r = ride?.next_route?.duration_seconds ?? ride?.duration_seconds;
    const d = ride?.next_route?.distance_meters ?? ride?.distance_meters;
    return [mins(r), km(d)].filter(Boolean).join(' • ');
  }, [ride]);

  const terminal = ['COMPLETED', 'CANCELLED', 'NO_DRIVERS', 'FAILED'].includes(st);
  const showDriver = ['DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(st) && !!driver;

  const handleCancel = async () => {
    setBusy(true);
    try {
      if (ride && !terminal) await ridesApi.cancel(ride.id, 'Cancelled by rider');
    } catch { /* ignore */ }
    clear('CANCELLED');
    setBusy(false);
    onClose();
  };

  const handleDismiss = () => {
    clear('IDLE');
    onClose();
  };

  const handleCallDriver = async () => {
    if (!ride?.driver_id) return;
    try {
      await requestCall(ride.driver_id);
      router.push('/nurse/connecting');
    } catch { /* ignore */ }
  };

  const handleTalkToNurse = () => router.push('/nurse/connecting');

  const submitRating = async () => {
    if (!ride || rating === 0) { handleDismiss(); return; }
    setBusy(true);
    try { await ridesApi.rate(ride.id, rating); } catch { /* ignore */ }
    setBusy(false);
    handleDismiss();
  };

  const vehicle = [driver?.vehicle_color, driver?.vehicle_brand, driver?.vehicle_model]
    .filter(Boolean).join(' ') || driver?.vehicle_type || 'Vehicle';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconBox}>
            {st === 'SEARCHING'
              ? <ActivityIndicator color="#FFF" />
              : <MaterialCommunityIcons name={terminal ? 'flag-checkered' : 'car'} size={22} color="#FFF" />}
          </View>
          <View style={styles.headerText}>
            <HelixaText weight="bold" style={styles.title}>{copy.title}</HelixaText>
            <HelixaText style={styles.subtitle}>
              {showDriver ? `${driver?.name || 'Your driver'} ${copy.sub}` : copy.sub}
            </HelixaText>
          </View>
        </View>

        {showDriver && (
          <View style={styles.driverSection}>
            <View style={styles.driverInfo}>
              <View style={styles.driverAvatar}>
                <MaterialCommunityIcons name="account" size={22} color="#FFF" />
              </View>
              <View>
                <HelixaText weight="bold" style={styles.carName}>{vehicle}</HelixaText>
                <HelixaText style={styles.etaText}>
                  {driver?.plate_number ? `${driver.plate_number}` : ''}{eta ? `  ·  ${eta}` : ''}
                </HelixaText>
                {driver?.rating_avg != null && driver.rating_avg > 0 && (
                  <HelixaText style={styles.etaText}>★ {driver.rating_avg.toFixed(1)}</HelixaText>
                )}
              </View>
            </View>
            <TouchableOpacity style={styles.callDriverBtn} onPress={handleCallDriver}>
              <Feather name="phone" size={14} color="#FFF" style={{ marginRight: 6 }} />
              <HelixaText style={styles.callDriverText}>Call</HelixaText>
            </TouchableOpacity>
          </View>
        )}

        {st === 'COMPLETED' && (
          <View style={styles.ratingRow}>
            <HelixaText style={styles.ratingLabel}>Rate your driver</HelixaText>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={6}>
                  <MaterialCommunityIcons
                    name={n <= rating ? 'star' : 'star-outline'}
                    size={26}
                    color={n <= rating ? '#FFC53D' : '#6B7280'}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {!terminal && (
          <View style={styles.actionRow}>
            <HelixaText style={styles.whileYouWaitText}>While you wait</HelixaText>
            <TouchableOpacity style={styles.talkToNurseBtn} onPress={handleTalkToNurse}>
              <Feather name="phone-call" size={16} color="#FFF" style={{ marginRight: 8 }} />
              <HelixaText style={styles.talkToNurseText}>Talk to a Nurse</HelixaText>
            </TouchableOpacity>
          </View>
        )}

        {terminal ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(st === 'NO_DRIVERS' || st === 'FAILED' || st === 'CANCELLED') && (
              <TouchableOpacity
                style={[styles.retryBtn]}
                onPress={() => { handleDismiss(); router.push('/ride/request'); }}>
                <HelixaText style={styles.retryBtnText}>Try again</HelixaText>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.doneBtn, busy && { opacity: 0.6 }]}
              onPress={st === 'COMPLETED' ? submitRating : handleDismiss}
              disabled={busy}>
              <HelixaText style={styles.doneBtnText}>{st === 'COMPLETED' ? 'Done' : 'Dismiss'}</HelixaText>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={busy}>
            <Feather name="x" size={16} color="#FFF" style={{ marginRight: 8 }} />
            <HelixaText style={styles.cancelBtnText}>Cancel Request</HelixaText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 50, left: 16, right: 16, zIndex: 100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  card: { backgroundColor: '#000000', borderRadius: 24, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  iconBox: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#374151',
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  headerText: { flex: 1, paddingRight: 8 },
  title: { color: '#FFF', fontSize: 16, marginBottom: 4 },
  subtitle: { color: '#9CA3AF', fontSize: 14, lineHeight: 20 },
  driverSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  driverInfo: { flexDirection: 'row', alignItems: 'center' },
  driverAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#D62D88', marginRight: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  carName: { color: '#FFF', fontSize: 15, marginBottom: 2 },
  etaText: { color: '#9CA3AF', fontSize: 13 },
  callDriverBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#374151',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  callDriverText: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  ratingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#111827', borderRadius: 16, padding: 14, marginBottom: 16,
  },
  ratingLabel: { color: '#D1D5DB', fontSize: 14 },
  actionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#111827', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 20,
  },
  whileYouWaitText: { color: '#D1D5DB', fontSize: 14 },
  talkToNurseBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#374151',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  talkToNurseText: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#B91C1C',
    paddingVertical: 12, borderRadius: 24, alignSelf: 'center', paddingHorizontal: 24,
  },
  cancelBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  retryBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D62D88',
    paddingVertical: 12, borderRadius: 24,
  },
  retryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  doneBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#374151',
    paddingVertical: 12, borderRadius: 24,
  },
  doneBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
