import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { HelixaText } from '../../../components/HelixaText';
import { CalText } from '../../../components/CalText';
import { Avatar } from '../../../components/Avatar';
import { ridesApi } from '../../../api/rides';
import { useRideStore, Ride, RouteInfo } from '../../../store/rideStore';

const PINK = '#D62D88';

function km(m?: number | null) {
  if (m == null) return '—';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
function mins(s?: number | null) {
  return s == null ? '—' : `${Math.max(1, Math.round(s / 60))} mins`;
}

/**
 * Figma "Connecting Route" → "Trip Overview": right after the driver accepts, load the ride and the
 * route to the pickup, show who/where, then hand over to turn-by-turn navigation.
 */
export default function TripOverview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = Number(id);
  const router = useRouter();
  const setRide = useRideStore((s) => s.setRide);
  const [ride, setLocalRide] = useState<Ride | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await ridesApi.get(rideId);
        if (!alive) return;
        setLocalRide(r);
        setRide(r);
        let from: { lat: number; lng: number } | undefined;
        try {
          const perm = await Location.getForegroundPermissionsAsync();
          if (perm.status === 'granted') {
            const p = await Location.getLastKnownPositionAsync();
            if (p) from = { lat: p.coords.latitude, lng: p.coords.longitude };
          }
        } catch { /* server falls back to the last GPS heartbeat */ }
        const leg = await ridesApi.route(rideId, 'pickup', from);
        if (alive) setRoute(leg.route);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [rideId, setRide]);

  const start = () => router.replace(`/driver/trip/${rideId}` as any);

  if (!ride || (!route && !failed)) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={PINK} size="large" />
        <CalText style={styles.connecting}>Connecting Route</CalText>
        <HelixaText style={styles.muted}>Loading transport details…</HelixaText>
      </SafeAreaView>
    );
  }

  if (failed && !ride) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <CalText style={styles.connecting}>Could not load the trip</CalText>
        <Pressable style={styles.button} onPress={() => router.replace('/(driver)' as any)}>
          <HelixaText weight="bold" style={styles.buttonText}>Back to Dashboard</HelixaText>
        </Pressable>
      </SafeAreaView>
    );
  }

  const rider = ride.rider;
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* The trip stays active; the dashboard shows "Resume active trip". */}
        <Pressable hitSlop={10} onPress={() => router.replace('/(driver)' as any)}>
          <Feather name="chevron-left" size={26} color="#000" />
        </Pressable>
      </View>
      <View style={styles.body}>
        <CalText style={styles.title}>Trip Overview</CalText>

        <View style={styles.card}>
          <View style={styles.riderRow}>
            <Avatar uri={rider?.profile_picture ?? undefined} name={rider?.name || 'Mother'} style={styles.avatar} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <HelixaText weight="bold" style={styles.riderName}>{rider?.name || 'Mother'}</HelixaText>
              <HelixaText style={styles.muted}>
                {[rider?.trimester, rider?.pregnancy_week ? `Week ${rider.pregnancy_week}` : null].filter(Boolean).join(' · ') || 'Emergency transport'}
              </HelixaText>
            </View>
          </View>

          <View style={styles.stop}>
            <MaterialCommunityIcons name="map-marker" size={18} color={PINK} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <HelixaText style={styles.stopLabel}>Pickup</HelixaText>
              <HelixaText weight="bold" style={styles.stopText}>{ride.pickup_address || 'Shared location'}</HelixaText>
            </View>
          </View>
          <View style={styles.stop}>
            <MaterialCommunityIcons name="hospital-building" size={18} color="#16A34A" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <HelixaText style={styles.stopLabel}>Destination Hospital</HelixaText>
              <HelixaText weight="bold" style={styles.stopText}>{ride.dropoff_name || ride.dropoff_address || 'Hospital'}</HelixaText>
            </View>
          </View>

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <HelixaText style={styles.stopLabel}>Distance to pickup</HelixaText>
              <HelixaText weight="bold" style={styles.metricValue}>{km(route?.distance_meters)}</HelixaText>
            </View>
            <View style={styles.metric}>
              <HelixaText style={styles.stopLabel}>ETA</HelixaText>
              <HelixaText weight="bold" style={styles.metricValue}>{mins(route?.duration_seconds)}</HelixaText>
            </View>
          </View>
        </View>
      </View>

      <Pressable style={styles.button} onPress={start}>
        <HelixaText weight="bold" style={styles.buttonText}>Start Navigation</HelixaText>
        <Feather name="navigation" size={16} color="#FFF" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', paddingHorizontal: 21 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 10 },
  connecting: { fontSize: 20, color: '#111', marginTop: 12 },
  muted: { fontSize: 13, color: '#6B7280' },
  header: { paddingTop: 12, height: 44, justifyContent: 'center' },
  body: { flex: 1 },
  title: { fontSize: 24, color: '#000', marginVertical: 12 },
  card: { backgroundColor: '#F9FAFB', borderRadius: 20, padding: 16, gap: 14 },
  riderRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  riderName: { fontSize: 16, color: '#111' },
  stop: { flexDirection: 'row', alignItems: 'flex-start' },
  stopLabel: { fontSize: 12, color: '#6B7280' },
  stopText: { fontSize: 14, color: '#111', marginTop: 2 },
  metrics: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 12 },
  metricValue: { fontSize: 16, color: '#111', marginTop: 4 },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PINK, borderRadius: 28, paddingVertical: 16, marginBottom: 24, alignSelf: 'stretch',
  },
  buttonText: { color: '#FFF', fontSize: 15 },
});
