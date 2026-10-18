import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { HelixaText } from '../../components/HelixaText';
import { Image } from 'expo-image';
import { CalText } from 'components/CalText';
import { ridesApi, Quote } from '../../api/rides';
import { useRideStore } from '../../store/rideStore';
import { useTheme } from '../../context/ThemeContext';
import type { Palette } from '../../lib/theme';
import { PressableScale, Reveal } from '../../components/motion';

function km(m?: number | null) {
  if (m == null) return '—';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
function mins(s?: number | null) {
  if (s == null) return '—';
  return `${Math.max(1, Math.round(s / 60))} min`;
}
function naira(n?: number | null) {
  return n == null ? '—' : `₦${Math.round(n).toLocaleString()}`;
}

// Used only when the device can't give us a fix (e.g. an Android emulator
// with no location set). The request still works - a driver just gets an
// approximate pickup. Set the emulator's location (Extended controls →
// Location) for a real coordinate.
const FALLBACK_PICKUP = { lat: 7.3775, lng: 3.947 }; // Ibadan

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

export default function EmergencyRideRequestScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const setRide = useRideStore((s) => s.setRide);

  const [notifyContacts, setNotifyContacts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [approx, setApprox] = useState(false);
  const [pickupLabel, setPickupLabel] = useState<string>('Your current location');
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let p = FALLBACK_PICKUP;
      let isApprox = true;

      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          // Fast path: last known fix. Then a bounded current-position read
          // (emulators without a set location otherwise hang forever here).
          const last = await Location.getLastKnownPositionAsync().catch(() => null);
          if (last) {
            p = { lat: last.coords.latitude, lng: last.coords.longitude };
            isApprox = false;
          }
          try {
            const cur = await withTimeout(
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
              8000,
            );
            p = { lat: cur.coords.latitude, lng: cur.coords.longitude };
            isApprox = false;
          } catch {
            /* keep last-known or fallback */
          }
        }
      } catch {
        /* permission/location module unavailable - use fallback */
      }

      if (!alive) return;
      setPickup(p);
      setApprox(isApprox);

      if (!isApprox) {
        try {
          const rev = await Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng });
          const a = rev[0];
          if (a && alive) {
            setPickupLabel([a.name || a.street, a.city].filter(Boolean).join(', ') || 'Your current location');
          }
        } catch { /* keep default label */ }
      }

      try {
        const q = await ridesApi.quote({ pickup: p, nearest_hospital: true });
        if (alive) setQuote(q);
      } catch {
        /* quote is best-effort; the request itself still resolves the hospital */
      }

      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const handleConfirm = async () => {
    if (!pickup) return;
    setSubmitting(true);
    setError(null);
    try {
      const ride = await ridesApi.request({
        pickup,
        pickup_address: pickupLabel,
        nearest_hospital: true,
        dropoff: quote ? quote.dropoff : undefined,
        dropoff_name: quote?.dropoff_name || undefined,
        dropoff_place_id: quote?.dropoff_place_id || undefined,
        notify_contacts: notifyContacts,
      });
      setRide(ride);
      router.replace('/(tabs)/');
    } catch (e: any) {
      setError(e?.message || 'Could not request a ride. Please try again.');
      setSubmitting(false);
    }
  };

  const dest = quote?.dropoff_name || quote?.dropoff_address || 'Nearest hospital';
  const distText = `${km(quote?.route.distance_meters)} away • ${mins(quote?.route.duration_seconds)}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Reveal index={0}>
          <View style={styles.iconContainer}>
            <Image source={require('../../assets/images/ride1.svg')} style={{ width: 111, height: 78.95 }} contentFit="fill" />
          </View>
        </Reveal>

        <Reveal index={1}>
          <CalText style={styles.title}>Request Emergency Ride</CalText>
          <HelixaText style={styles.subtitle}>
            We'll immediately dispatch a trained driver to take you to the nearest hospital
          </HelixaText>
        </Reveal>

        <Reveal index={2}>
        <View style={styles.warningBanner}>
          <Feather name="alert-circle" size={20} color="#DC2626" style={styles.warningIcon} />
          <View style={styles.warningTextContainer}>
            <HelixaText weight="bold" style={styles.warningTitle}>This is for emergencies only</HelixaText>
            <HelixaText style={styles.warningDesc}>
              If you're experiencing severe pain, heavy bleeding, or other urgent symptoms
            </HelixaText>
          </View>
        </View>
        </Reveal>

        {loading ? (
          <Reveal index={3}>
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#D62D88" />
            <HelixaText style={styles.loadingText}>Finding your location…</HelixaText>
          </View>
          </Reveal>
        ) : (
          <>
            <Reveal index={3}>
            <View style={styles.cardContainer}>
              <View style={styles.locationCard}>
                <View style={styles.locationIconWrapper}>
                  <Feather name="map-pin" size={16} color={colors.textSecondary} />
                </View>
                <View style={styles.locationInfo}>
                  <HelixaText style={styles.locationLabel}>Pickup Location</HelixaText>
                  <HelixaText weight="bold" style={styles.locationValue}>
                    {approx ? 'Approximate location' : pickupLabel}
                  </HelixaText>
                  <HelixaText style={styles.locationSub}>
                    {approx ? 'No GPS fix — set your device/emulator location for accuracy' : 'Using your live location'}
                  </HelixaText>
                </View>
              </View>
            </View>
            </Reveal>

            <Reveal index={4}>
            <View style={styles.cardContainer}>
              <View style={styles.locationCard}>
                <View style={styles.locationIconWrapper}>
                  <Feather name="navigation" size={16} color={colors.textSecondary} />
                </View>
                <View style={styles.locationInfo}>
                  <HelixaText style={styles.locationLabel}>Destination</HelixaText>
                  <HelixaText weight="bold" style={styles.locationValue}>{dest}</HelixaText>
                  <HelixaText style={styles.locationSub}>{distText}</HelixaText>
                </View>
              </View>
            </View>
            </Reveal>

            <Reveal index={5}>
            <View style={styles.fareRow}>
              <HelixaText style={styles.fareLabel}>Estimated fare</HelixaText>
              <HelixaText weight="bold" style={styles.fareValue}>{naira(quote?.fare_estimate)}</HelixaText>
            </View>
            </Reveal>
          </>
        )}

        <Reveal index={6}>
        <TouchableOpacity style={styles.checkboxContainer} onPress={() => setNotifyContacts(!notifyContacts)} activeOpacity={0.7}>
          <View style={[styles.checkbox, notifyContacts && styles.checkboxChecked]}>
            {notifyContacts && <Feather name="check" size={14} color="#FFF" />}
          </View>
          <View style={styles.checkboxTextContainer}>
            <HelixaText weight="bold" style={styles.checkboxTitle}>Notify emergency contacts</HelixaText>
            <HelixaText style={styles.checkboxDesc}>
              We'll alert your partner and emergency contacts with your location
            </HelixaText>
          </View>
        </TouchableOpacity>
        </Reveal>

        {!!error && <HelixaText style={styles.error}>{error}</HelixaText>}
      </ScrollView>

      <Reveal index={7}>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.confirmBtn, (loading || submitting || !pickup) && { opacity: 0.6 }]}
          onPress={handleConfirm}
          disabled={loading || submitting || !pickup}>
          {submitting
            ? <ActivityIndicator color="#FFF" />
            : <HelixaText style={styles.confirmBtnText}>Confirm Emergency Request</HelixaText>}
        </TouchableOpacity>

        <PressableScale style={styles.cancelBtn} onPress={() => router.back()}>
          <HelixaText style={styles.cancelBtnText}>Cancel</HelixaText>
        </PressableScale>

        <View style={styles.footerDisclaimer}>
          <HelixaText style={styles.disclaimerText}>Life-threatening emergency?</HelixaText>
          <HelixaText style={styles.disclaimerTextBold}>Call 911 immediately</HelixaText>
        </View>
      </View>
      </Reveal>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  iconContainer: { marginBottom: 24, alignItems: 'flex-start' },
  title: { fontSize: 28, color: c.text, marginBottom: 12 },
  subtitle: { fontSize: 16, color: c.textSecondary, lineHeight: 24, marginBottom: 24 },
  warningBanner: {
    flexDirection: 'row', backgroundColor: c.dangerSoft, padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: c.dangerBorder, marginBottom: 24,
  },
  warningIcon: { marginRight: 12, marginTop: 2 },
  warningTextContainer: { flex: 1 },
  warningTitle: { color: c.dangerText, fontSize: 16, marginBottom: 4 },
  warningDesc: { color: c.dangerText, fontSize: 14, lineHeight: 20, opacity: 0.9 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 24 },
  loadingText: { color: c.textSecondary, fontSize: 14 },
  cardContainer: {
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 16,
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  locationCard: { flexDirection: 'row', alignItems: 'flex-start' },
  locationIconWrapper: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface,
    justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2,
  },
  locationInfo: { flex: 1 },
  locationLabel: { fontSize: 14, color: c.textMuted, marginBottom: 4 },
  locationValue: { fontSize: 16, color: c.text, marginBottom: 4 },
  locationSub: { fontSize: 14, color: c.textSecondary },
  fareRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 4, marginBottom: 8,
  },
  fareLabel: { fontSize: 15, color: c.textSecondary },
  fareValue: { fontSize: 20, color: '#D62D88' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, marginBottom: 24 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: c.border,
    justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2,
  },
  checkboxChecked: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  checkboxTextContainer: { flex: 1 },
  checkboxTitle: { fontSize: 16, color: c.dangerText, marginBottom: 4 },
  checkboxDesc: { fontSize: 14, color: c.dangerText, lineHeight: 20, opacity: 0.8 },
  error: { color: '#DC2626', fontSize: 14, marginTop: 4 },
  footer: {
    paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16,
    backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.divider,
  },
  confirmBtn: {
    backgroundColor: '#D62D88', width: '100%', height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  confirmBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: {
    backgroundColor: c.blush, width: '100%', height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  cancelBtnText: { color: '#D62D88', fontSize: 16, fontWeight: 'bold' },
  footerDisclaimer: { alignItems: 'center' },
  disclaimerText: { color: '#EF4444', fontSize: 14 },
  disclaimerTextBold: { color: '#EF4444', fontSize: 14, fontWeight: 'bold' },
});
