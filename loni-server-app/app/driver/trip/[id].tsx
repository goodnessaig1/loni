import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Linking, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { HelixaText } from '../../../components/HelixaText';
import { CalText } from '../../../components/CalText';
import { ridesApi } from '../../../api/rides';
import { apiClient } from '../../../api/client';
import { useRideStore, RouteStep } from '../../../store/rideStore';
import { decodePolyline } from '../../../lib/navigation/polyline';
import { computeTbt, maneuverIcon } from '../../../lib/navigation/useTurnByTurn';

const PINK = '#D62D88';
const GREEN = '#15B300';

type Leg = 'pickup' | 'dropoff';

function fmtDist(m: number) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
function fmtEta(sec: number) {
  const min = Math.max(1, Math.round(sec / 60));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`;
}

export default function TripNavigation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = Number(id);
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);

  const ride = useRideStore((s) => s.ride);
  const setRide = useRideStore((s) => s.setRide);
  const patchRide = useRideStore((s) => s.patchRide);
  const clear = useRideStore((s) => s.clear);

  const [pos, setPos] = useState<{ latitude: number; longitude: number; heading: number | null } | null>(null);
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [polyPts, setPolyPts] = useState<{ latitude: number; longitude: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const stepIdxRef = useRef(0);
  const spokenRef = useRef<{ idx: number; band: number }>({ idx: -1, band: 0 });

  const phase: Leg = ride?.status === 'IN_PROGRESS' ? 'dropoff' : 'pickup';

  // --- load ride + route ------------------------------------------------
  const loadRoute = useCallback(async (leg: Leg, from?: { lat: number; lng: number }) => {
    try {
      const { route } = await ridesApi.route(rideId, leg, from);
      setSteps(route.steps || []);
      setPolyPts(route.polyline ? decodePolyline(route.polyline) : []);
      stepIdxRef.current = 0;
      spokenRef.current = { idx: -1, band: 0 };
    } catch {
      /* keep old route */
    }
  }, [rideId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await ridesApi.get(rideId);
        if (!alive) return;
        setRide(r);
        if (['COMPLETED', 'CANCELLED'].includes(r.status)) {
          router.replace(r.status === 'COMPLETED' ? `/driver/trip/${rideId}/complete` : '/(driver)');
          return;
        }
        const leg: Leg = r.status === 'IN_PROGRESS' ? 'dropoff' : 'pickup';
        if (r.next_route?.steps?.length) {
          setSteps(r.next_route.steps);
          setPolyPts(r.next_route.polyline ? decodePolyline(r.next_route.polyline) : []);
        } else {
          await loadRoute(leg);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [rideId]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- position stream ------------------------------------------------
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 8 },
        (loc) => {
          setPos({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading ?? null,
          });
        },
      );
    })();
    return () => sub?.remove();
  }, []);

  // --- back out if the ride gets cancelled elsewhere -----------------
  useEffect(() => {
    if (ride && ride.id === rideId && ride.status === 'CANCELLED') {
      Speech.stop();
      clear('CANCELLED');
      router.replace('/(driver)');
    }
  }, [ride?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- turn-by-turn compute + voice ---------------------------------
  const tbt = computeTbt(steps, pos, stepIdxRef.current);
  stepIdxRef.current = tbt.stepIndex;

  useEffect(() => {
    if (!tbt.step || !pos) return;
    const { stepIndex, distanceToManeuver, step } = tbt;
    // Announce at ~400m, ~120m and "now" per step, once each.
    let band = 0;
    if (distanceToManeuver <= 40) band = 3;
    else if (distanceToManeuver <= 130) band = 2;
    else if (distanceToManeuver <= 420) band = 1;
    if (band === 0) return;
    const s = spokenRef.current;
    if (s.idx === stepIndex && s.band >= band) return;
    spokenRef.current = { idx: stepIndex, band };
    const lead = band === 3 ? 'Now, ' : band === 2 ? 'In 100 meters, ' : `In ${fmtDist(distanceToManeuver)}, `;
    Speech.speak(lead + step.instruction, { rate: 1.0 });
  }, [tbt.stepIndex, Math.round((tbt.distanceToManeuver || 0) / 20)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tbt.isOffRoute && pos && !loading) {
      // Debounced re-route.
      const t = setTimeout(() => {
        loadRoute(phase, { lat: pos.latitude, lng: pos.longitude });
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [tbt.isOffRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- camera follow -----------------------------------------------
  useEffect(() => {
    if (!pos || !mapRef.current) return;
    mapRef.current.animateCamera(
      {
        center: { latitude: pos.latitude, longitude: pos.longitude },
        heading: pos.heading ?? 0,
        pitch: 45,
        zoom: 17,
      },
      { duration: 800 },
    );
  }, [pos?.latitude, pos?.longitude, pos?.heading]);

  // --- phase actions ---------------------------------------------
  const primaryAction = async () => {
    if (!ride) return;
    setActing(true);
    try {
      if (ride.status === 'DRIVER_ASSIGNED' || ride.status === 'DRIVER_EN_ROUTE') {
        const r = await ridesApi.arrived(rideId);
        patchRide(r);
      } else if (ride.status === 'DRIVER_ARRIVED') {
        const r = await ridesApi.start(rideId);
        patchRide(r);
        if (r.next_route?.steps?.length) {
          setSteps(r.next_route.steps);
          setPolyPts(r.next_route.polyline ? decodePolyline(r.next_route.polyline) : []);
          stepIdxRef.current = 0;
          spokenRef.current = { idx: -1, band: 0 };
        } else {
          await loadRoute('dropoff');
        }
      } else if (ride.status === 'IN_PROGRESS') {
        await ridesApi.complete(rideId);
        Speech.stop();
        router.replace(`/driver/trip/${rideId}/complete`);
      }
    } catch (e) {
      /* surface via toast in a later pass */
    } finally {
      setActing(false);
    }
  };

  const callPassenger = async () => {
    try {
      const res = await apiClient.post('/calls/request', { nurse_id: ride?.rider_id });
      router.push({ pathname: '/incoming-call', params: { callId: res.data?.id, outgoing: '1' } } as any);
    } catch {}
  };

  const cancel = async () => {
    try { await ridesApi.cancel(rideId, 'Driver cancelled'); } catch {}
    Speech.stop();
    clear('CANCELLED');
    router.replace('/(driver)');
  };

  const openExternalNav = () => {
    if (!ride) return;
    const target = phase === 'pickup' ? ride.pickup : ride.dropoff;
    const url = Platform.select({
      ios: `maps://?daddr=${target.lat},${target.lng}&dirflg=d`,
      android: `google.navigation:q=${target.lat},${target.lng}`,
    });
    if (url) Linking.openURL(url).catch(() => {});
  };

  if (loading || !ride) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={PINK} size="large" />
      </View>
    );
  }

  const destPoint = phase === 'pickup' ? ride.pickup : ride.dropoff;
  const actionLabel =
    ride.status === 'DRIVER_ARRIVED' ? 'Start trip'
      : ride.status === 'IN_PROGRESS' ? 'Complete trip'
        : "I've arrived";
  const headline =
    phase === 'pickup'
      ? `Picking up ${ride.rider?.name || 'passenger'}`
      : `To ${ride.dropoff_name || 'hospital'}`;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={{
          latitude: pos?.latitude ?? destPoint.lat,
          longitude: pos?.longitude ?? destPoint.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}>
        {polyPts.length > 1 && <Polyline coordinates={polyPts} strokeColor={PINK} strokeWidth={6} />}
        <Marker coordinate={{ latitude: destPoint.lat, longitude: destPoint.lng }}>
          <MaterialCommunityIcons
            name={phase === 'pickup' ? 'map-marker-account' : 'hospital-marker'}
            size={34}
            color={phase === 'pickup' ? PINK : '#B91C1C'}
          />
        </Marker>
      </MapView>

      {/* Maneuver banner */}
      <SafeAreaView edges={['top']} style={styles.topSafe}>
        <View style={styles.banner}>
          <MaterialCommunityIcons name={maneuverIcon(tbt.step?.maneuver) as any} size={30} color="#FFF" />
          <View style={{ flex: 1 }}>
            <CalText style={styles.bannerDistance}>{fmtDist(tbt.distanceToManeuver || 0)}</CalText>
            <HelixaText style={styles.bannerInstruction} numberOfLines={2}>
              {tbt.step?.instruction || headline}
            </HelixaText>
          </View>
        </View>
        {tbt.isOffRoute && (
          <View style={styles.rerouting}>
            <ActivityIndicator color="#FFF" size="small" />
            <HelixaText style={styles.reroutingText}>Re-routing…</HelixaText>
          </View>
        )}
      </SafeAreaView>

      <Pressable style={styles.recenter} onPress={() => pos && mapRef.current?.animateCamera({ center: pos, zoom: 17, pitch: 45 })}>
        <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#111" />
      </Pressable>
      <Pressable style={styles.extNav} onPress={openExternalNav}>
        <MaterialCommunityIcons name="google-maps" size={18} color="#111" />
        <HelixaText style={styles.extNavText}>Google Maps</HelixaText>
      </Pressable>

      {/* Bottom sheet */}
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.sheetHandleRow}>
          <HelixaText weight="black" style={styles.headline}>{headline}</HelixaText>
          <View style={styles.etaChip}>
            <HelixaText weight="bold" style={styles.etaText}>
              {fmtEta(tbt.durationRemaining)} · {fmtDist(tbt.distanceRemaining)}
            </HelixaText>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.iconBtn} onPress={callPassenger}>
            <Feather name="phone" size={18} color="#111" />
          </Pressable>
          <Pressable style={[styles.primary, acting && { opacity: 0.6 }]} onPress={primaryAction} disabled={acting}>
            {acting ? <ActivityIndicator color="#FFF" /> : <HelixaText weight="bold" style={styles.primaryText}>{actionLabel}</HelixaText>}
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={cancel}>
            <Feather name="x" size={18} color="#B91C1C" />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E5E7EB' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  topSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#111',
    marginHorizontal: 12, marginTop: 8, borderRadius: 18, padding: 16,
  },
  bannerDistance: { color: '#FFF', fontSize: 22 },
  bannerInstruction: { color: '#D1D5DB', fontSize: 14, marginTop: 2 },
  rerouting: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center',
    backgroundColor: 'rgba(17,17,17,0.85)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8,
  },
  reroutingText: { color: '#FFF', fontSize: 13 },
  recenter: {
    position: 'absolute', right: 14, bottom: 210, width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  extNav: {
    position: 'absolute', left: 14, bottom: 210, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF', borderRadius: 22, paddingHorizontal: 12, height: 44,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  extNavText: { fontSize: 13, color: '#111' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 12,
  },
  sheetHandleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headline: { fontSize: 17, color: '#111', flex: 1 },
  etaChip: { backgroundColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  etaText: { fontSize: 13, color: '#111' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 8 },
  iconBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 1, height: 52, borderRadius: 26, backgroundColor: PINK, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFF', fontSize: 16 },
});
