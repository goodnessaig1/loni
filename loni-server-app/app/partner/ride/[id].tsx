import React from 'react';
import { View, Pressable, StyleSheet, ScrollView, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { CalText } from '../../../components/CalText';
import { HelixaText } from '../../../components/HelixaText';
import { Avatar } from '../../../components/Avatar';
import { MapView, Marker, Polyline, MAPS_AVAILABLE, PROVIDER_GOOGLE } from '../../../components/MapsCompat';
import { ridesApi } from '../../../api/rides';
import type { Ride, RideStatus, LatLng } from '../../../store/rideStore';
import { decodePolyline } from '../../../lib/navigation/polyline';

const TERMINAL: RideStatus[] = ['COMPLETED', 'CANCELLED', 'NO_DRIVERS', 'FAILED'];

const STATUS_LABEL: Record<RideStatus, string> = {
  IDLE: 'Idle',
  SEARCHING: 'Looking for a driver nearby',
  DRIVER_ASSIGNED: 'A driver has been assigned',
  DRIVER_EN_ROUTE: 'Driver is on the way to her',
  DRIVER_ARRIVED: 'Driver has arrived',
  IN_PROGRESS: 'On the way to the hospital',
  COMPLETED: 'Trip completed',
  CANCELLED: 'Ride was cancelled',
  NO_DRIVERS: 'No drivers were available',
  FAILED: 'Ride request failed',
};

/** What a partner receives: her pickup is hidden when she doesn't share location with them. */
type PartnerRide = Omit<Ride, 'pickup'> & {
  pickup: LatLng | null;
  location_shared?: boolean;
  requested_at?: string | null;
  assigned_at?: string | null;
  arrived_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  progress?: { phase: string; remaining_meters: number; eta_seconds: number };
};

function km(m?: number | null) {
  if (m == null) return '—';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function clock(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatEta(seconds?: number | null) {
  if (!seconds) return null;
  const mins = Math.round(seconds / 60);
  return mins <= 1 ? '1 min' : `${mins} mins`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <HelixaText style={styles.driverVehicle}>{label}</HelixaText>
      <HelixaText weight="bold" style={styles.infoValue}>{value}</HelixaText>
    </View>
  );
}

export default function PartnerRideTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = Number(id);

  // Status transitions arrive live over the WebSocket (lib/partnerEvents.ts
  // invalidates this exact query key; ride_driver_location patches it
  // directly). The interval below is just a safety net for a dropped socket.
  const { data: ride } = useQuery<PartnerRide>({
    queryKey: ['partner', 'ride', rideId],
    queryFn: () => ridesApi.get(rideId) as unknown as Promise<PartnerRide>,
    enabled: Number.isFinite(rideId),
    refetchInterval: (query) => (query.state.data && TERMINAL.includes(query.state.data.status) ? false : 20_000),
  });

  const driverFix = ride?.driver?.current_lat != null && ride?.driver?.current_lng != null
    ? { latitude: ride.driver!.current_lat as number, longitude: ride.driver!.current_lng as number }
    : null;

  const pickupFix = ride?.pickup ? { latitude: ride.pickup.lat, longitude: ride.pickup.lng } : null;
  const focus = driverFix ?? pickupFix ?? (ride ? { latitude: ride.dropoff.lat, longitude: ride.dropoff.lng } : null);
  const herName = ride?.rider?.name ?? 'She';

  const steps: Array<{ label: string; at?: string | null; done: boolean }> = ride ? [
    { label: 'Emergency ride requested', at: ride.requested_at, done: true },
    { label: 'Driver assigned', at: ride.assigned_at, done: !!ride.assigned_at },
    { label: 'Driver arrived for pickup', at: ride.arrived_at, done: !!ride.arrived_at },
    { label: 'On the way to the hospital', at: ride.started_at, done: !!ride.started_at },
    { label: 'Arrived at the hospital', at: ride.completed_at, done: !!ride.completed_at },
  ] : [];
  const eta = ride?.progress?.eta_seconds ?? ride?.duration_seconds;

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        {focus ? (
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            initialRegion={{ ...focus, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          >
            {pickupFix && <Marker coordinate={pickupFix} title="Pickup" pinColor="#D62D88" />}
            <Marker coordinate={{ latitude: ride!.dropoff.lat, longitude: ride!.dropoff.lng }} title={ride!.dropoff_name || 'Hospital'} />
            {driverFix && <Marker coordinate={driverFix} title="Driver" pinColor="#10B981" />}
            {!!ride?.route_polyline && (
              <Polyline coordinates={decodePolyline(ride.route_polyline)} strokeColor="#D62D88" strokeWidth={4} />
            )}
          </MapView>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.mapFallback]} />
        )}
        <SafeAreaView edges={['top']} style={styles.topControls}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={24} color="#000000" />
          </Pressable>
        </SafeAreaView>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <HelixaText style={styles.statusText} weight="bold">
              {ride ? STATUS_LABEL[ride.status] : 'Loading…'}
            </HelixaText>
          </View>

          <CalText style={styles.heading}>
            {ride && TERMINAL.includes(ride.status) ? `${herName}'s emergency ride` : `${herName} may need your help`}
          </CalText>
          <HelixaText style={styles.subtext}>
            {ride?.location_shared === false
              ? "She isn't sharing her location with you, but you'll see each step of her ride here."
              : 'She started an emergency ride. Follow her journey live below.'}
          </HelixaText>

          {ride?.driver && (
            <View style={styles.driverCard}>
              <Avatar uri={ride.driver.profile_picture || null} name={ride.driver.name} style={styles.driverAvatar} />
              <View style={styles.driverInfo}>
                <HelixaText weight="bold" style={styles.driverName}>{ride.driver.name}</HelixaText>
                <HelixaText style={styles.driverVehicle}>
                  {ride.driver.rating_avg ? `★ ${ride.driver.rating_avg.toFixed(1)} · ` : ''}LONI verified driver
                </HelixaText>
              </View>
              {!!ride.driver.phone && !TERMINAL.includes(ride.status) && (
                <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:${ride.driver!.phone}`)}>
                  <Feather name="phone" size={16} color="#FFFFFF" />
                </Pressable>
              )}
            </View>
          )}

          {ride?.driver && (
            <View style={styles.infoBox}>
              <InfoRow label="Vehicle" value={[ride.driver.vehicle_color, ride.driver.vehicle_brand, ride.driver.vehicle_model].filter(Boolean).join(' ') || '—'} />
              <InfoRow label="Plate number" value={ride.driver.plate_number || '—'} />
              {!TERMINAL.includes(ride.status) && <InfoRow label="ETA" value={formatEta(eta) ?? '—'} />}
              <InfoRow label="Trip distance" value={km(ride.distance_meters)} />
            </View>
          )}

          <HelixaText weight="bold" style={styles.sectionLabel}>Hospital destination</HelixaText>
          <View style={styles.infoBox}>
            <HelixaText weight="bold" style={styles.driverName}>{ride?.dropoff_name || 'Hospital'}</HelixaText>
            {!!ride?.dropoff_address && <HelixaText style={styles.driverVehicle}>{ride.dropoff_address}</HelixaText>}
          </View>

          <HelixaText weight="bold" style={styles.sectionLabel}>Status</HelixaText>
          <View>
            {steps.map((st, i) => (
              <View key={st.label} style={styles.stepRow}>
                <View style={styles.stepRail}>
                  <View style={[styles.stepDot, st.done ? styles.stepDotDone : null]}>
                    {st.done && <Feather name="check" size={11} color="#FFF" />}
                  </View>
                  {i < steps.length - 1 && <View style={[styles.stepLine, steps[i + 1].done ? { backgroundColor: '#22C55E' } : null]} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 14 }}>
                  <HelixaText weight={st.done ? 'bold' : 'regular'} style={[styles.stepLabel, !st.done && { color: '#9CA3AF' }]}>{st.label}</HelixaText>
                  {!!clock(st.at) && <HelixaText style={styles.stepTime}>{clock(st.at)}</HelixaText>}
                </View>
              </View>
            ))}
            {ride?.status === 'CANCELLED' && <HelixaText style={[styles.stepLabel, { color: '#EF4444' }]}>The ride was cancelled.</HelixaText>}
          </View>

          {!MAPS_AVAILABLE && (
            <HelixaText style={styles.mapsHint}>{"Live map preview isn't available on this build."}</HelixaText>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  mapArea: { flex: 1, backgroundColor: '#E9EAEE' },
  mapFallback: { backgroundColor: '#E9EAEE' },
  topControls: { position: 'absolute', top: 0, left: 0, right: 0 },
  backButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', marginLeft: 21, marginTop: 16,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 4,
  },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20, maxHeight: '62%' },
  sheetContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 12 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: '#FDF2F8', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D62D88' },
  statusText: { fontSize: 12, color: '#D62D88' },
  heading: { fontSize: 20, color: '#000000', marginBottom: 4 },
  subtext: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  etaText: { fontSize: 14, color: '#111827' },
  driverCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9FAFB',
    borderRadius: 16, padding: 14, marginTop: 4,
  },
  driverAvatar: { width: 48, height: 48, borderRadius: 24 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 15, color: '#000000', marginBottom: 2 },
  driverVehicle: { fontSize: 13, color: '#6B7280' },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' },
  infoBox: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 14, gap: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoValue: { fontSize: 13, color: '#111827' },
  sectionLabel: { fontSize: 14, color: '#111827', marginTop: 8 },
  stepRow: { flexDirection: 'row' },
  stepRail: { width: 26, alignItems: 'center' },
  stepDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  stepDotDone: { backgroundColor: '#22C55E' },
  stepLine: { width: 2, flex: 1, backgroundColor: '#E5E7EB' },
  stepLabel: { fontSize: 13, color: '#111827', paddingLeft: 8 },
  stepTime: { fontSize: 11, color: '#6B7280', paddingLeft: 8, marginTop: 2 },
  mapsHint: { fontSize: 12, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
});
