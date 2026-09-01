import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { HelixaText } from '../../../components/HelixaText';
import { CalText } from '../../../components/CalText';
import { useRideStore } from '../../../store/rideStore';
import { acceptRideDirect, declineRideDirect } from '../../../lib/rideEvents';

const PINK = '#D62D88';
const GREEN = '#15B300';

function km(m?: number | null) { return m == null ? '—' : `${(m / 1000).toFixed(1)} km`; }
function mins(s?: number | null) { return s == null ? '—' : `${Math.max(1, Math.round(s / 60))} min`; }
function naira(n?: number | null) { return n == null ? '₦0' : `₦${Math.round(n).toLocaleString()}`; }

export default function RideRequestSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = Number(id);
  const router = useRouter();

  const offer = useRideStore((s) => s.offers.find((o) => o.ride_id === rideId));
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(offer?.expires_in_seconds ?? 30);

  // Countdown; auto-close when it runs out or the offer is pulled (ride_taken).
  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!offer && !busy) router.back();
  }, [offer, busy, router]);
  useEffect(() => {
    if (secondsLeft <= 0 && !busy) router.back();
  }, [secondsLeft, busy, router]);

  const routeCoords = useMemo(() => {
    // We only have straight pickup/dropoff here; draw a simple line.
    if (!offer) return [];
    return [
      { latitude: offer.pickup.lat, longitude: offer.pickup.lng },
      { latitude: offer.dropoff.lat, longitude: offer.dropoff.lng },
    ];
  }, [offer]);

  if (!offer) {
    return (
      <View style={styles.scrim}>
        <ActivityIndicator color="#FFF" />
      </View>
    );
  }

  const onAccept = async () => {
    setBusy('accept');
    try {
      await acceptRideDirect(rideId);
      router.replace(`/driver/trip/${rideId}`);
    } catch (e: any) {
      setBusy(null);
      router.back();
    }
  };

  const onDecline = async () => {
    setBusy('decline');
    try { await declineRideDirect(rideId); } finally { router.back(); }
  };

  return (
    <View style={styles.scrim}>
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.grabber} />

        <View style={styles.mapWrap}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            initialRegion={{
              latitude: (offer.pickup.lat + offer.dropoff.lat) / 2,
              longitude: (offer.pickup.lng + offer.dropoff.lng) / 2,
              latitudeDelta: Math.abs(offer.pickup.lat - offer.dropoff.lat) * 2.4 + 0.02,
              longitudeDelta: Math.abs(offer.pickup.lng - offer.dropoff.lng) * 2.4 + 0.02,
            }}>
            <Marker coordinate={{ latitude: offer.pickup.lat, longitude: offer.pickup.lng }} pinColor={PINK} />
            <Marker coordinate={{ latitude: offer.dropoff.lat, longitude: offer.dropoff.lng }}>
              <MaterialCommunityIcons name="hospital-marker" size={30} color="#B91C1C" />
            </Marker>
            <Polyline coordinates={routeCoords} strokeColor={PINK} strokeWidth={4} />
          </MapView>
          <View style={styles.timerPill}>
            <Feather name="clock" size={13} color="#FFF" />
            <HelixaText weight="bold" style={styles.timerText}>{secondsLeft}s</HelixaText>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.riderRow}>
            <View style={styles.riderAvatar}>
              <MaterialCommunityIcons name="account" size={22} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <HelixaText weight="black" style={styles.riderName}>{offer.rider?.name || 'A mother'}</HelixaText>
              {!!offer.rider?.trimester && (
                <HelixaText style={styles.riderSub}>
                  {offer.rider.trimester}{offer.rider.pregnancy_week ? ` · ${offer.rider.pregnancy_week}` : ''}
                </HelixaText>
              )}
            </View>
            <HelixaText weight="black" style={styles.fare}>{naira(offer.fare_estimate)}</HelixaText>
          </View>

          <CalText style={styles.route}>
            {(offer.pickup_address || 'Pickup')} → {(offer.dropoff_name || 'Hospital')}
          </CalText>

          <View style={styles.metaRow}>
            <View style={styles.meta}><Feather name="navigation" size={14} color="#6B7280" /><HelixaText style={styles.metaText}>{km(offer.distance_meters)} away</HelixaText></View>
            <View style={styles.meta}><Feather name="map" size={14} color="#6B7280" /><HelixaText style={styles.metaText}>{km(offer.trip_distance_meters)} trip</HelixaText></View>
            <View style={styles.meta}><Feather name="clock" size={14} color="#6B7280" /><HelixaText style={styles.metaText}>{mins(offer.trip_duration_seconds)}</HelixaText></View>
          </View>

          <Pressable style={[styles.btn, styles.accept]} onPress={onAccept} disabled={!!busy}>
            {busy === 'accept'
              ? <ActivityIndicator color="#FFF" />
              : <HelixaText weight="bold" style={styles.acceptText}>Accept Emergency Request</HelixaText>}
          </Pressable>
          <Pressable style={[styles.btn, styles.decline]} onPress={onDecline} disabled={!!busy}>
            <HelixaText weight="bold" style={styles.declineText}>Decline</HelixaText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#E5E7EB', marginTop: 10 },
  mapWrap: { height: 180, marginTop: 12, marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: '#EEF' },
  timerPill: {
    position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  timerText: { color: '#FFF', fontSize: 12 },
  body: { padding: 20, gap: 14 },
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  riderAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: PINK, alignItems: 'center', justifyContent: 'center' },
  riderName: { fontSize: 16, color: '#111' },
  riderSub: { fontSize: 13, color: '#6B7280', marginTop: 3 },
  fare: { fontSize: 18, color: PINK },
  route: { fontSize: 18, color: '#111' },
  metaRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: '#6B7280' },
  btn: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  accept: { backgroundColor: GREEN },
  acceptText: { color: '#FFF', fontSize: 16 },
  decline: { backgroundColor: '#FFF1F2' },
  declineText: { color: PINK, fontSize: 15 },
});
