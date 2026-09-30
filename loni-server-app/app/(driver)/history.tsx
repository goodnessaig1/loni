import React from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { useRideHistory } from '../../hooks/useRides';

const PINK = '#D62D88';

function naira(n?: number | null) {
  return n == null ? '—' : `₦${Math.round(n).toLocaleString()}`;
}

export default function DriverHistory() {
  const { data = [], isLoading } = useRideHistory(50);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CalText style={styles.header}>Trip History</CalText>
      {isLoading ? (
        <ActivityIndicator color={PINK} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {data.length === 0 && <HelixaText style={styles.empty}>No completed trips yet.</HelixaText>}
          {data.map((h) => (
            <View key={h.id} style={styles.card}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="car" size={18} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <HelixaText weight="bold" style={styles.route}>
                  {(h.pickup_address || 'Pickup')} → {(h.dropoff_name || 'Hospital')}
                </HelixaText>
                <HelixaText style={styles.sub}>
                  {h.counterpart_name || 'Passenger'}
                  {h.completed_at || h.created_at
                    ? ` · ${format(new Date(h.completed_at || h.created_at!), 'MMM d, HH:mm')}`
                    : ''}
                </HelixaText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <HelixaText weight="black" style={styles.fare}>{naira(h.fare_final ?? h.fare_estimate)}</HelixaText>
                <HelixaText style={styles.status}>{h.status.toLowerCase()}</HelixaText>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { fontSize: 24, color: '#000', paddingHorizontal: 21, paddingTop: 8, paddingBottom: 12 },
  scroll: { paddingHorizontal: 21, paddingBottom: 120, gap: 11 },
  empty: { color: '#9CA3AF', marginTop: 40, textAlign: 'center' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: '#F9FAFB',
    borderRadius: 16, padding: 14,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 18, backgroundColor: PINK, alignItems: 'center', justifyContent: 'center' },
  route: { fontSize: 14, color: '#000' },
  sub: { fontSize: 13, color: '#6B6B6B', marginTop: 4 },
  fare: { fontSize: 15, color: PINK },
  status: { fontSize: 12, color: '#9CA3AF', marginTop: 4, textTransform: 'capitalize' },
});
