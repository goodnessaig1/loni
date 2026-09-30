import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { CalText } from '../../../../components/CalText';
import { HelixaText } from '../../../../components/HelixaText';
import { ridesApi } from '../../../../api/rides';
import { useRideStore } from '../../../../store/rideStore';

const PINK = '#D62D88';
const GREEN = '#15B300';

function naira(n?: number | null) { return n == null ? '₦0' : `₦${Math.round(n).toLocaleString()}`; }
function km(m?: number | null) { return m == null ? '—' : `${(m / 1000).toFixed(1)} km`; }

export default function TripComplete() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = Number(id);
  const router = useRouter();
  const clear = useRideStore((s) => s.clear);

  const [ride, setRide] = useState(useRideStore.getState().ride);
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Already rated (e.g. re-opened from Recent Activity)? skip the form.
  const alreadyRated = ride?.driver_rating != null;

  useEffect(() => {
    ridesApi.get(rideId).then((r) => {
      setRide(r);
      if (r.driver_rating != null) { setRating(r.driver_rating); setDone(true); }
    }).catch(() => {});
  }, [rideId]);

  const submit = async () => {
    setSubmitting(true);
    try { await ridesApi.rate(rideId, rating); } catch {}
    setSubmitting(false);
    setDone(true);
    clear('COMPLETED');
  };

  const finish = () => {
    clear('IDLE');
    router.replace('/(driver)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <View style={styles.check}>
          <Feather name="check" size={38} color="#FFF" />
        </View>
        <CalText style={styles.title}>Trip complete</CalText>
        <HelixaText style={styles.sub}>
          {(ride?.pickup_address || 'Pickup')} → {(ride?.dropoff_name || 'Hospital')}
        </HelixaText>

        <View style={styles.earnCard}>
          <HelixaText style={styles.earnLabel}>You earned</HelixaText>
          <CalText style={styles.earnValue}>{naira(ride?.fare_final ?? ride?.fare_estimate)}</CalText>
          <HelixaText style={styles.earnMeta}>{km(ride?.distance_meters)} trip</HelixaText>
        </View>

        {!done && !alreadyRated ? (
          <>
            <HelixaText weight="bold" style={styles.rateLabel}>Rate your passenger</HelixaText>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={8}>
                  <MaterialCommunityIcons
                    name={n <= rating ? 'star' : 'star-outline'}
                    size={36}
                    color={n <= rating ? '#FFC53D' : '#D1D5DB'}
                  />
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.primary} onPress={submit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#FFF" /> : <HelixaText weight="bold" style={styles.primaryText}>Submit</HelixaText>}
            </Pressable>
          </>
        ) : (
          <>
            {(done || alreadyRated) && (
              <View style={styles.starsReadonly}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <MaterialCommunityIcons
                    key={n}
                    name={n <= rating ? 'star' : 'star-outline'}
                    size={22}
                    color={n <= rating ? '#FFC53D' : '#D1D5DB'}
                  />
                ))}
              </View>
            )}
            <Pressable style={styles.primary} onPress={finish}>
              <HelixaText weight="bold" style={styles.primaryText}>Back to dashboard</HelixaText>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  check: { width: 76, height: 76, borderRadius: 38, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 26, color: '#111' },
  sub: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 12 },
  earnCard: { backgroundColor: '#F9FAFB', borderRadius: 20, paddingVertical: 24, paddingHorizontal: 40, alignItems: 'center', marginBottom: 20 },
  earnLabel: { fontSize: 13, color: '#6B7280' },
  earnValue: { fontSize: 32, color: PINK, marginVertical: 6 },
  starsReadonly: { flexDirection: 'row', gap: 6, marginVertical: 4 },
  earnMeta: { fontSize: 13, color: '#9CA3AF' },
  rateLabel: { fontSize: 15, color: '#111', marginTop: 8 },
  stars: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  primary: { alignSelf: 'stretch', height: 54, borderRadius: 27, backgroundColor: PINK, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { color: '#FFF', fontSize: 16 },
});
