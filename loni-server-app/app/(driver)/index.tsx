import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Avatar } from '../../components/Avatar';
import { DragToggle } from '../../components/driver/DragToggle';
import { useAuth } from '../../hooks/useAuth';
import { apiClient } from '../../api/client';
import { ridesApi } from '../../api/rides';
import { useAvailableRides, useDriverStats, useRideHistory } from '../../hooks/useRides';
import { useRideStore } from '../../store/rideStore';
import { startForegroundLocation, stopDriverLocation } from '../../lib/driverLocation';
import { PressableScale, Reveal, RevealList } from '../../components/motion';

const PINK = '#D62D88';
const ORANGE = '#FFA722';
const GREEN = '#15B300';

function km(m?: number | null) {
  if (m == null) return '—';
  return `${(m / 1000).toFixed(1)} km`;
}
function mins(s?: number | null) {
  if (s == null) return '—';
  return `${Math.max(1, Math.round(s / 60))} mins`;
}
function naira(n?: number | null) {
  if (n == null) return '₦0';
  return `₦${Math.round(n).toLocaleString()}`;
}

export default function DriverDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [toggling, setToggling] = useState(false);

  const stats = useDriverStats();
  const available = useAvailableRides(isOnline);
  const history = useRideHistory(10);

  const offers = useRideStore((s) => s.offers);
  const setOffers = useRideStore((s) => s.setOffers);
  const activeRide = useRideStore((s) => s.ride);
  const setRide = useRideStore((s) => s.setRide);

  // Seed online state from the server the first time stats land.
  useEffect(() => {
    if (stats.data) setIsOnline(!!stats.data.is_online && !!stats.data.is_available);
  }, [stats.data]);

  // Keep the store's offer list in sync with the polled list.
  useEffect(() => {
    if (available.data?.offers) setOffers(available.data.offers);
  }, [available.data, setOffers]);

  useFocusEffect(
    useCallback(() => {
      stats.refetch();
      history.refetch();
      if (isOnline) available.refetch();
      // Match the server: bring back a trip still in progress (after a restart the store is empty),
      // and drop one that ended or was reassigned while the app was in the background.
      ridesApi.active()
        .then((r) => {
          const local = useRideStore.getState().ride;
          if (r && r.driver_id) setRide(r);
          else if (local && !['COMPLETED', 'IDLE'].includes(local.status)) useRideStore.getState().clear('IDLE');
        })
        .catch(() => {});
    }, [isOnline]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const nearest = useMemo(
    () => [...offers].sort((a, b) => (a.distance_meters ?? 1e12) - (b.distance_meters ?? 1e12))[0],
    [offers],
  );

  const handleToggle = async (next: boolean) => {
    setIsOnline(next);
    setToggling(true);
    try {
      await apiClient.patch('/users/online-status', { is_online: next });
      await ridesApi.setAvailability(next);
      stats.refetch();
      if (next) {
        startForegroundLocation();
        available.refetch();
      } else {
        stopDriverLocation();
        setOffers([]);
      }
    } catch (e) {
      setIsOnline(!next); // revert
    } finally {
      setToggling(false);
    }
  };

  const s = stats.data;
  const now = new Date();

  // The "ready to drive" card is pink/white when online and greyscale when
  // offline (Figma: online = 828:12333, offline = the "Ready When You Are" state).
  const th = isOnline
    ? {
        card: PINK,
        title: '#FFFFFF',
        titleText: "You're\nReady To Drive.",
        pill: 'rgba(255,255,255,0.34)',
        pillText: '#FFFFFF',
        badgePill: 'rgba(255,255,255,0.35)',
        badgeDot: '#FFFFFF',
        badgeText: '#FFFFFF',
        carTint: undefined as string | undefined,
        carOpacity: 1,
        drag: {
          track: 'rgba(255,255,255,0.30)',
          knob: PINK,
          knobIcon: '#FFFFFF',
          label: '#FFFFFF',
          chevron: 'rgba(255,255,255,0.8)',
        },
      }
    : {
        card: '#ECECEC',
        title: '#1A1A1A',
        titleText: 'Ready\nWhen You Are.',
        pill: 'rgba(0,0,0,0.05)',
        pillText: '#4A4A4A',
        badgePill: 'rgba(0,0,0,0.05)',
        badgeDot: '#8A8A8A',
        badgeText: '#6B6B6B',
        carTint: '#BDBDBD' as string | undefined,
        carOpacity: 0.9,
        drag: {
          track: 'rgba(0,0,0,0.05)',
          knob: '#3C3C3C',
          knobIcon: '#FFFFFF',
          label: '#5A5A5A',
          chevron: 'rgba(0,0,0,0.35)',
        },
      };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Reveal index={0}>
        <View style={styles.headerRow}>
          <View style={styles.identity}>
            <View style={styles.avatarRing}>
              <Avatar uri={user?.profilePicture || null} name={user?.name || 'Driver'} style={styles.avatar} />
            </View>
            <View>
              <View style={styles.nameRow}>
                <HelixaText weight="black" style={styles.name}>{user?.name || 'Driver'}</HelixaText>
                <MaterialCommunityIcons name="check-decagram" size={15} color="#00C300" />
              </View>
              <View style={styles.verifiedBadge}>
                <View style={styles.verifiedDot} />
                <HelixaText style={styles.verifiedText}>LONI Verified Driver</HelixaText>
              </View>
            </View>
          </View>
          <Pressable style={styles.bellBtn} onPress={() => router.push('/notifications' as any)}>
            <Feather name="bell" size={20} color="#111" />
          </Pressable>
        </View>
        </Reveal>

        {/* Greeting */}
        <Reveal index={1}>
        <HelixaText weight="bold" style={styles.greeting}>
          <HelixaText weight="bold" style={{ color: '#31001A' }}>Hi, </HelixaText>
          <HelixaText weight="bold" style={{ color: '#898989' }}>Ready for emergency requests?</HelixaText>
        </HelixaText>
        </Reveal>

        {/* Resume active trip */}
        {activeRide && !['COMPLETED', 'CANCELLED', 'IDLE'].includes(activeRide.status) && (
          <Reveal index={2}>
          <PressableScale style={styles.resumeBanner} onPress={() => router.push(`/driver/trip/${activeRide.id}` as any)}>
            <MaterialCommunityIcons name="car-connected" size={18} color="#FFF" />
            <HelixaText weight="bold" style={styles.resumeText}>Resume active trip</HelixaText>
            <Feather name="chevron-right" size={20} color="#FFF" />
          </PressableScale>
          </Reveal>
        )}

        {/* "Ready to drive" card — pink when online, greyscale when offline */}
        <Reveal index={3}>
        <View style={[styles.pinkCard, { backgroundColor: th.card }]}>
          <Image
            source={require('../../assets/images/hero.png')}
            style={[styles.carImage, { tintColor: th.carTint, opacity: th.carOpacity }]}
            resizeMode="contain"
          />

          <View style={[styles.clockPill, { backgroundColor: th.pill }]}>
            <Feather name="clock" size={14} color={th.pillText} />
            <HelixaText weight="bold" style={[styles.clockText, { color: th.pillText }]}>
              {format(now, 'h:mm a')}
            </HelixaText>
          </View>

          <View style={[styles.onlineBadge, { backgroundColor: th.badgePill }]}>
            <View style={[styles.onlineDot, { backgroundColor: th.badgeDot }]} />
            <HelixaText style={[styles.onlineBadgeText, { color: th.badgeText }]}>
              {isOnline ? 'Online' : 'Offline'}
            </HelixaText>
          </View>

          <CalText style={[styles.pinkTitle, { color: th.title }]}>{th.titleText}</CalText>

          <DragToggle value={isOnline} onToggle={handleToggle} disabled={toggling} colors={th.drag} />
        </View>
        </Reveal>

        {/* Nearest request banner */}
        {isOnline && nearest && (
          <Reveal index={4}>
          <PressableScale
            style={styles.orangeBanner}
            onPress={() => router.push(`/driver/request/${nearest.ride_id}` as any)}>
            <View style={styles.orangeBannerInner}>
              <MaterialCommunityIcons name="alert" size={16} color="#FFF" />
              <HelixaText weight="bold" style={styles.orangeText}>
                Emergency Transport Request{nearest.distance_meters != null ? ` - ${(nearest.distance_meters / 1000).toFixed(1)}km` : ''}
              </HelixaText>
            </View>
            <Feather name="chevrons-right" size={22} color="rgba(255,255,255,0.9)" />
          </PressableScale>
          </Reveal>
        )}

        {/* Stats grid */}
        <Reveal index={5}>
        <View style={styles.statsGrid}>
          <View style={[styles.statTile, styles.tlTL]}>
            <View>
              <HelixaText weight="black" style={styles.statValue}>{s ? (s.rating_avg || 0).toFixed(1) : '—'}</HelixaText>
              <HelixaText style={styles.statLabel}>Rating</HelixaText>
            </View>
            <View style={styles.statIcon}><MaterialCommunityIcons name="star" size={18} color="#FFC53D" /></View>
          </View>
          <View style={[styles.statTile, styles.tlTR]}>
            <View>
              <HelixaText weight="black" style={styles.statValue}>{naira(s?.total_earnings)}</HelixaText>
              <HelixaText style={styles.statLabel}>Total Earnings</HelixaText>
            </View>
            <View style={styles.statIcon}><MaterialCommunityIcons name="sack" size={18} color="#E9A23B" /></View>
          </View>
          <View style={[styles.statTile, styles.tlBL]}>
            <View>
              <HelixaText weight="black" style={styles.statValue}>{s?.trips_today ?? 0}</HelixaText>
              <HelixaText style={styles.statLabel}>Today</HelixaText>
            </View>
            <View style={styles.statIcon}><MaterialCommunityIcons name="car" size={18} color="#111" /></View>
          </View>
          <View style={[styles.statTile, styles.tlBR]}>
            <View>
              <HelixaText weight="black" style={styles.statValue}>{s?.total_trips ?? 0}</HelixaText>
              <HelixaText style={styles.statLabel}>Total</HelixaText>
            </View>
            <View style={styles.statIcon}><MaterialCommunityIcons name="check-circle" size={18} color="#111" /></View>
          </View>
        </View>
        </Reveal>

        {/* Available Emergency Requests */}
        <Reveal index={6}>
        <View style={styles.sectionHeader}>
          <View>
            <HelixaText weight="bold" style={styles.sectionTitle}>Available Emergency Requests</HelixaText>
            <HelixaText style={styles.sectionSub}>
              {offers.length} request{offers.length === 1 ? '' : 's'} available
            </HelixaText>
          </View>
        </View>
        </Reveal>

        {available.isLoading && isOnline ? (
          <ActivityIndicator color={PINK} style={{ marginVertical: 16 }} />
        ) : offers.length === 0 ? (
          <HelixaText style={styles.emptyText}>
            {isOnline ? 'No requests right now. Stay online — new requests appear here.' : 'Go online to receive emergency requests.'}
          </HelixaText>
        ) : (
          <View style={{ gap: 11 }}>
            {offers.map((o, i) => (
              <RevealList key={o.ride_id} index={i}>
              <PressableScale
                style={styles.requestCard}
                onPress={() => router.push(`/driver/request/${o.ride_id}` as any)}>
                <View style={styles.requestBar} />
                <View style={{ flex: 1 }}>
                  <HelixaText weight="black" style={styles.requestRoute}>
                    {(o.pickup_address || 'Pickup')} → {(o.dropoff_name || 'Hospital')}
                  </HelixaText>
                  <View style={styles.requestMeta}>
                    <View style={styles.metaItem}>
                      <Feather name="map-pin" size={14} color="#111" />
                      <HelixaText style={styles.metaText}>{km(o.trip_distance_meters)}</HelixaText>
                    </View>
                    <View style={styles.metaItem}>
                      <Feather name="clock" size={14} color="#111" />
                      <HelixaText style={styles.metaText}>{mins(o.trip_duration_seconds)}</HelixaText>
                    </View>
                  </View>
                  <HelixaText weight="black" style={styles.requestFare}>{naira(o.fare_estimate)}</HelixaText>
                </View>
                <View style={styles.viewLink}>
                  <HelixaText weight="bold" style={styles.viewText}>View</HelixaText>
                  <Feather name="chevron-right" size={18} color={GREEN} />
                </View>
              </PressableScale>
              </RevealList>
            ))}
          </View>
        )}

        {/* Recent Activity */}
        <Reveal index={7}>
        <View style={[styles.sectionHeader, { marginTop: 28 }]}>
          <HelixaText weight="bold" style={styles.sectionTitle}>Recent Activity</HelixaText>
        </View>
        </Reveal>
        <View style={{ gap: 11 }}>
          {(history.data ?? []).slice(0, 6).map((h, i) => (
            <RevealList key={h.id} index={i}>
            <PressableScale
              style={[styles.activityCard, { backgroundColor: ['#FDF1F4', '#F7F1FB', '#FFF7EA'][i % 3] }]}
              onPress={() => router.push(`/driver/trip/${h.id}` as any)}>
              <View style={[styles.activityIcon, { backgroundColor: ['#F68AA8', '#D591E9', ORANGE][i % 3] }]}>
                <MaterialCommunityIcons name="car" size={18} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <HelixaText weight="bold" style={styles.activityName}>{h.counterpart_name || 'Passenger'}</HelixaText>
                <HelixaText style={styles.activityDate}>
                  {h.completed_at || h.created_at ? format(new Date(h.completed_at || h.created_at!), 'MMM d · HH:mm') : ''}
                </HelixaText>
              </View>
              <Feather name="chevron-right" size={20} color="#9CA3AF" />
            </PressableScale>
            </RevealList>
          ))}
          {(!history.data || history.data.length === 0) && (
            <HelixaText style={styles.emptyText}>No trips yet.</HelixaText>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 21, paddingTop: 8, paddingBottom: 120 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatarRing: { borderWidth: 2, borderColor: PINK, borderRadius: 30, padding: 3 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 15, color: '#000' },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#ECFDF3',
    borderRadius: 16, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6, alignSelf: 'flex-start',
  },
  verifiedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#12B76A' },
  verifiedText: { color: '#027A48', fontSize: 11 },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },

  greeting: { fontSize: 24, lineHeight: 28, marginBottom: 22, maxWidth: 260 },

  resumeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16,
  },
  resumeText: { color: '#FFF', flex: 1, fontSize: 14 },

  pinkCard: {
    backgroundColor: PINK, borderRadius: 40, padding: 20, overflow: 'hidden',
    marginBottom: 16, minHeight: 300,
  },
  carImage: {
    position: 'absolute',
    bottom: 10,
    right: -58,
    width: 194,
    height: 162,
  },
  clockPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.34)', borderRadius: 62, paddingHorizontal: 13, paddingVertical: 10,
    marginBottom: 22,
  },
  clockText: { color: '#FFF', fontSize: 13 },
  onlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 16, paddingHorizontal: 8, paddingVertical: 3,
    marginBottom: 12,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFF' },
  onlineBadgeText: { color: '#FFF', fontSize: 12 },
  pinkTitle: { fontSize: 28, lineHeight: 34, color: '#FFF', width: '62%', marginBottom: 26 },

  orangeBanner: {
    backgroundColor: ORANGE, borderRadius: 64, paddingHorizontal: 22, paddingVertical: 22,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24,
  },
  orangeBannerInner: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  orangeText: { color: '#FFF', fontSize: 15, flexShrink: 1 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 33 },
  statTile: {
    width: '48.6%', backgroundColor: '#F5F5F5', padding: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  tlTL: { borderTopLeftRadius: 16 },
  tlTR: { borderTopRightRadius: 16 },
  tlBL: { borderBottomLeftRadius: 16 },
  tlBR: { borderBottomRightRadius: 16 },
  statValue: { fontSize: 20, color: '#000', marginBottom: 7 },
  statLabel: { fontSize: 14, color: '#000' },
  statIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },

  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 16, color: '#6B6B6B', marginBottom: 8 },
  sectionSub: { fontSize: 14, color: '#000' },
  emptyText: { fontSize: 14, color: '#9CA3AF', lineHeight: 20, marginVertical: 8 },

  requestCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF',
    borderWidth: 1, borderColor: '#EDEFF2', borderRadius: 11, paddingLeft: 8, paddingRight: 16, paddingVertical: 12,
  },
  requestBar: { width: 3, alignSelf: 'stretch', borderRadius: 3, backgroundColor: ORANGE },
  requestRoute: { fontSize: 15, color: '#000', marginBottom: 10 },
  requestMeta: { flexDirection: 'row', gap: 14, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 14, color: '#000' },
  requestFare: { fontSize: 16, color: PINK },
  viewLink: { flexDirection: 'row', alignItems: 'center' },
  viewText: { color: GREEN, fontSize: 15 },

  activityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 22,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  activityIcon: { width: 40, height: 40, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  activityName: { fontSize: 15, color: '#000' },
  activityDate: { fontSize: 14, color: '#6B6B6B', marginTop: 4 },
});
