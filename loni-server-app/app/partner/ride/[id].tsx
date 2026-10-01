import React from 'react';
import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { CalText } from '../../../components/CalText';
import { HelixaText } from '../../../components/HelixaText';
import { Avatar } from '../../../components/Avatar';
import { MapView, Marker, Polyline, MAPS_AVAILABLE, PROVIDER_GOOGLE } from '../../../components/MapsCompat';
import { ridesApi } from '../../../api/rides';
import type { RideStatus } from '../../../store/rideStore';
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

function formatEta(seconds?: number | null) {
  if (!seconds) return null;
  const mins = Math.round(seconds / 60);
  return mins <= 1 ? '1 min' : `${mins} mins`;
}

export default function PartnerRideTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = Number(id);

  // Status transitions arrive live over the WebSocket (lib/partnerEvents.ts
  // invalidates this exact query key; ride_driver_location patches it
  // directly). The interval below is just a safety net for a dropped socket.
  const { data: ride } = useQuery({
    queryKey: ['partner', 'ride', rideId],
    queryFn: () => ridesApi.get(rideId),
    enabled: Number.isFinite(rideId),
    refetchInterval: (query) => (query.state.data && TERMINAL.includes(query.state.data.status) ? false : 20_000),
  });

  const driverFix = ride?.driver?.current_lat != null && ride?.driver?.current_lng != null
    ? { latitude: ride.driver!.current_lat as number, longitude: ride.driver!.current_lng as number }
    : null;

  const focus = driverFix ?? (ride ? { latitude: ride.pickup.lat, longitude: ride.pickup.lng } : null);

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        {focus ? (
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            initialRegion={{ ...focus, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          >
            <Marker coordinate={{ latitude: ride!.pickup.lat, longitude: ride!.pickup.lng }} title="Pickup" pinColor="#D62D88" />
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

          <CalText style={styles.heading}>{ride?.dropoff_name || 'Emergency ride'}</CalText>
          <HelixaText style={styles.subtext}>{ride?.dropoff_address || ride?.pickup_address || ''}</HelixaText>

          {!!ride?.duration_seconds && !TERMINAL.includes(ride.status) && (
            <View style={styles.etaRow}>
              <Feather name="clock" size={16} color="#6B7280" />
              <HelixaText style={styles.etaText} weight="bold">ETA {formatEta(ride.duration_seconds)}</HelixaText>
            </View>
          )}

          {ride?.driver && (
            <View style={styles.driverCard}>
              <Avatar uri={ride.driver.profile_picture || null} name={ride.driver.name} style={styles.driverAvatar} />
              <View style={styles.driverInfo}>
                <HelixaText weight="bold" style={styles.driverName}>{ride.driver.name}</HelixaText>
                <HelixaText style={styles.driverVehicle}>
                  {[ride.driver.vehicle_color, ride.driver.vehicle_brand, ride.driver.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'}
                  {ride.driver.plate_number ? ` · ${ride.driver.plate_number}` : ''}
                </HelixaText>
              </View>
            </View>
          )}

          {!MAPS_AVAILABLE && (
            <HelixaText style={styles.mapsHint}>Live map preview isn't available on this build.</HelixaText>
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
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -20 },
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
  mapsHint: { fontSize: 12, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
});
