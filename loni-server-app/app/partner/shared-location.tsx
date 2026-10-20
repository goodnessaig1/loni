import React from 'react';
import { View, Pressable, StyleSheet, Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Avatar } from '../../components/Avatar';
import { MapView, Marker, MAPS_AVAILABLE, PROVIDER_GOOGLE } from '../../components/MapsCompat';
import { usePartnerDashboard } from '../../hooks/usePartnerDashboard';
import { relativeTimeWithClock } from '../../lib/relativeTime';
import { Reveal } from '../../components/motion';

const ALERT_STATUS_LABEL: Record<string, string> = {
  SEARCHING: 'Looking for a driver nearby',
  DRIVER_ASSIGNED: 'A driver is on the way to her',
  DRIVER_EN_ROUTE: 'Driver is on the way to her',
  DRIVER_ARRIVED: 'Driver has arrived',
  IN_PROGRESS: 'Currently with a driver',
};

function openInMaps(lat: number, lng: number, label: string) {
  const query = encodeURIComponent(label);
  const url = Platform.select({
    ios: `maps:0,0?q=${query}@${lat},${lng}`,
    android: `geo:0,0?q=${lat},${lng}(${query})`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  });
  Linking.openURL(url!).catch(() =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)
  );
}

function WaveCap() {
  return (
    <Svg width="100%" height={36} viewBox="0 0 430 36" preserveAspectRatio="none" style={styles.wave}>
      <Path d="M0,14 C95,14 118,36 215,36 C312,36 335,14 430,14 L430,36 L0,36 Z" fill="#000000" />
    </Svg>
  );
}

export default function SharedLocationScreen() {
  const { data } = usePartnerDashboard();
  const mapRef = React.useRef<any>(null);

  const alert = data?.active_alert;
  const fix = alert?.driver_location ?? alert?.pickup ?? null;
  const loc = alert && fix ? {
    lat: fix.lat,
    lng: fix.lng,
    address: alert.pickup_address,
    updated_at: alert.driver_location?.updated_at ?? alert.requested_at,
  } : null;
  const inviterName = data?.inviter.name ?? 'her';

  const recenter = () => {
    if (loc && mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion(
        { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        300
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        {loc ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            initialRegion={{ latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
          >
            <Marker coordinate={{ latitude: loc.lat, longitude: loc.lng }} title={inviterName} />
          </MapView>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.mapFallback]} />
        )}

        <SafeAreaView edges={['top']} style={styles.topControls}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={24} color="#000000" />
          </Pressable>
        </SafeAreaView>

        {MAPS_AVAILABLE && loc && (
          <Pressable style={styles.recenterButton} onPress={recenter}>
            <Feather name="crosshair" size={20} color="#000000" />
          </Pressable>
        )}
      </View>

      <View style={styles.sheet}>
        <WaveCap />
        <SafeAreaView edges={['bottom']} style={styles.sheetContent}>
          <Reveal index={0}>
          <CalText style={styles.sheetHeading}>Her shared location</CalText>
          </Reveal>
          <Reveal index={1}>
          <HelixaText style={styles.sheetSubtext}>
            {inviterName} is in an emergency ride - here's where she is right now.
          </HelixaText>
          </Reveal>

          <Reveal index={2}>
          <View style={styles.rows}>
            <View style={styles.row}>
              <Avatar uri={data?.inviter.profile_picture || null} name={inviterName} style={styles.rowAvatar} />
              <View style={styles.rowText}>
                <HelixaText style={styles.rowTitle} weight="bold">
                  {loc?.address || 'Location unavailable'}
                </HelixaText>
                <HelixaText style={styles.rowSubtitle}>
                  {loc ? `Last updated ${relativeTimeWithClock(loc.updated_at)}` : 'Waiting for an update'}
                </HelixaText>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.rowIconCircle}>
                <Feather name="map-pin" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.rowText}>
                <HelixaText style={styles.rowTitle} weight="bold">Location status</HelixaText>
                <HelixaText style={styles.rowSubtitle}>
                  {loc ? (ALERT_STATUS_LABEL[alert?.status ?? ''] || 'With a driver, on her way') : 'No active emergency ride'}
                </HelixaText>
              </View>
            </View>
          </View>
          </Reveal>

          <Reveal index={3}>
          <View style={styles.disclaimer}>
            <Feather name="alert-circle" size={14} color="#FFFFFF" style={styles.disclaimerIcon} />
            <HelixaText style={styles.disclaimerText}>
              You see her current shared location only, not her history, routes, or movement.
            </HelixaText>
          </View>
          </Reveal>

          <Reveal index={4}>
          <Pressable
            style={[styles.openMapsButton, !loc && styles.openMapsButtonDisabled]}
            disabled={!loc}
            onPress={() => loc && openInMaps(loc.lat, loc.lng, inviterName)}
          >
            <HelixaText style={styles.openMapsText} weight="black">Open Maps</HelixaText>
            <Feather name="navigation" size={20} color="#FFFFFF" />
          </Pressable>
          </Reveal>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  mapArea: { flex: 1, backgroundColor: '#E9EAEE' },
  mapFallback: { backgroundColor: '#E9EAEE' },
  topControls: { position: 'absolute', top: 0, left: 0, right: 0 },
  backButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', marginLeft: 23, marginTop: 20,
    shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 4,
  },
  recenterButton: {
    position: 'absolute', right: 24, top: '46%',
    width: 47, height: 47, borderRadius: 23.5, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 1, height: 2 }, shadowRadius: 2, elevation: 4,
  },
  wave: { marginBottom: -1 },
  sheet: { backgroundColor: '#000000' },
  sheetContent: { backgroundColor: '#000000', paddingHorizontal: 22, paddingBottom: 24, gap: 25 },
  sheetHeading: { fontSize: 24, color: '#FFFFFF', marginBottom: 14 },
  sheetSubtext: { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
  rows: { gap: 11 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#272727',
    borderRadius: 18, paddingHorizontal: 19, paddingVertical: 18,
  },
  rowAvatar: { width: 44, height: 44, borderRadius: 22 },
  rowIconCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#FA3532',
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { gap: 7, flexShrink: 1 },
  rowTitle: { fontSize: 15, color: '#FFFFFF' },
  rowSubtitle: { fontSize: 14, color: '#C2C2C2' },
  disclaimer: { flexDirection: 'row', gap: 7, alignItems: 'flex-start' },
  disclaimerIcon: { marginTop: 3 },
  disclaimerText: { fontSize: 14, color: '#FFFFFF', lineHeight: 20, flex: 1 },
  openMapsButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#D62D88', borderRadius: 43, paddingVertical: 18,
  },
  openMapsButtonDisabled: { opacity: 0.5 },
  openMapsText: { fontSize: 16, color: '#FFFFFF' },
});
