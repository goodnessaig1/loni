import React, { useState } from 'react';
import { View, Image, Pressable, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Avatar } from '../../components/Avatar';
import { UpdateDetailModal } from '../../components/partner/UpdateDetailModal';
import { useAuth } from '../../hooks/useAuth';
import { usePartnerDashboard } from '../../hooks/usePartnerDashboard';
import { relativeTime, relativeTimeWithClock } from '../../lib/relativeTime';
import type { PartnerDashboardUpdate } from '../../api/partner';

const CARD_COLORS = [
  { bg: '#FBD9F1', pill: '#CF7DAD' },
  { bg: '#FDE791', pill: '#C9A23D' },
  { bg: '#C7F0EC', pill: '#4FA89D' },
  { bg: '#B4C0FC', pill: '#5E6FD1' },
];

const ALERT_STATUS_LABEL: Record<string, string> = {
  SEARCHING: 'Looking for a driver nearby',
  DRIVER_ASSIGNED: 'A driver is on the way to her',
  DRIVER_EN_ROUTE: 'Driver is on the way to her',
  DRIVER_ARRIVED: 'Driver has arrived',
  IN_PROGRESS: 'Currently with a driver',
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function staticMapUrl(lat: number, lng: number): string | null {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '15',
    size: '400x200',
    scale: '2',
    maptype: 'roadmap',
    key,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}&markers=size:mid%7Ccolor:0x000000%7C${lat},${lng}`;
}

function PregnancyJourneyCard({ status, week }: { status: 'pregnant' | 'newMom' | null; week: number }) {
  const base = Math.max(week - 6, 0);
  const labels = [0, 1, 2, 3, 4].map((i) => base + i * 2);
  const span = labels[4] - base || 1;
  const progress = Math.min(Math.max((week - base) / span, 0), 1);

  return (
    <View style={styles.journeyCard}>
      <Image source={require('../../assets/images/partner-pregnant.png')} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)']}
        locations={[0.25, 0.95]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.journeyTopic}>
        <View style={styles.journeyIconCircle}>
          <Feather name="heart" size={16} color="#000000" />
        </View>
        <HelixaText style={styles.journeyTitle} weight="black">
          {status === 'newMom' ? "Her Recovery Journey" : 'Her Pregnancy Journey'}
        </HelixaText>
      </View>

      <View style={styles.journeyTrackSection}>
        <View style={styles.journeyLabelsRow}>
          {labels.map((w) => (
            <HelixaText key={w} style={styles.journeyLabel} weight="bold">{w}W</HelixaText>
          ))}
        </View>
        <View style={styles.journeyTrack}>
          <View style={[styles.journeyFill, { width: `${progress * 100}%` }]} />
          <View style={[styles.journeyDot, { left: `${progress * 100}%` }]}>
            <View style={styles.journeyDotInner} />
          </View>
          <View style={styles.journeyNextButton}>
            <Feather name="chevron-right" size={12} color="#FFFFFF" />
          </View>
        </View>
      </View>
    </View>
  );
}

export default function PartnerDashboard() {
  const { user } = useAuth();
  const { data } = usePartnerDashboard();
  const firstName = (user?.name || '').split(' ')[0] || 'there';
  const [selected, setSelected] = useState<{ update: PartnerDashboardUpdate; colors: { bg: string; pill: string } } | null>(null);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Avatar uri={user?.profilePicture || null} name={user?.name || 'You'} style={styles.avatar} />
          <View style={styles.bellButton}>
            <Feather name="bell" size={18} color="#000" />
          </View>
        </View>

        <CalText style={styles.greeting}>{greeting()}, {firstName}</CalText>
        <HelixaText style={styles.subGreeting}>Stay connected to her journey.</HelixaText>

        {data?.active_alert && (
          <Pressable
            style={styles.alertCard}
            onPress={() => router.push(`/partner/ride/${data.active_alert!.ride_id}` as any)}
          >
            <View style={styles.alertTextBlock}>
              <CalText style={styles.alertTitle}>Emergency alert</CalText>
              <HelixaText style={styles.alertBody} weight="bold">
                {data.inviter.name} may need your help.
              </HelixaText>
              <HelixaText style={styles.alertTime} weight="bold">
                {relativeTimeWithClock(data.active_alert.requested_at)}
              </HelixaText>
              <View style={styles.alertButton}>
                <HelixaText style={styles.alertButtonText} weight="black">Open emergency alert</HelixaText>
              </View>
            </View>
            <Image source={require('../../assets/images/partner-3d-alert.png')} style={styles.alertImage} />
          </Pressable>
        )}

        {data?.inviter.week != null && (
          <PregnancyJourneyCard status={data.inviter.status} week={data.inviter.week} />
        )}

        {!!data?.active_alert && (() => {
          const alert = data.active_alert!;
          const fix = alert.driver_location ?? alert.pickup;
          return (
            <Pressable style={styles.mapCard} onPress={() => router.push('/partner/shared-location' as any)}>
              <Image
                source={{ uri: staticMapUrl(fix.lat, fix.lng) ?? undefined }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.mapPill}>
                <View style={styles.mapPillLeft}>
                  <View style={styles.mapPillIcon}>
                    <Feather name="map-pin" size={12} color="#FFF" />
                  </View>
                  <HelixaText style={styles.mapPillText} weight="black">
                    {ALERT_STATUS_LABEL[alert.status] || 'With a driver, on her way'}
                  </HelixaText>
                </View>
                <HelixaText style={styles.mapPillTime} weight="bold">{relativeTime(alert.requested_at)}</HelixaText>
              </View>
            </Pressable>
          );
        })()}

        {!!data?.updates.length && (
          <View style={styles.updatesSection}>
            <CalText style={styles.updatesHeading}>Her Latest Updates</CalText>
            <View style={styles.updatesGrid}>
              {data.updates.map((u, i) => {
                const colors = CARD_COLORS[i % CARD_COLORS.length];
                return (
                  <Pressable
                    key={u.week}
                    style={[styles.updateCard, { backgroundColor: colors.bg }]}
                    onPress={() => setSelected({ update: u, colors })}
                  >
                    <Image source={require('../../assets/images/partner-fetus.png')} style={styles.updateFetus} />
                    <View style={[styles.updatePill, { backgroundColor: colors.pill }]}>
                      <HelixaText style={styles.updatePillText} weight="bold">Week {u.week}</HelixaText>
                    </View>
                    <HelixaText style={styles.updateTitle} weight="black">{u.title}</HelixaText>
                    <View style={styles.updateExpand}>
                      <Feather name="arrow-right" size={14} color="#000" style={styles.updateExpandIcon} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <UpdateDetailModal
        visible={!!selected}
        update={selected?.update ?? null}
        colors={selected?.colors ?? CARD_COLORS[0]}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 21, paddingTop: 8, paddingBottom: 140 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  avatar: { width: 43, height: 43, borderRadius: 22 },
  bellButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
  },
  greeting: { fontSize: 24, lineHeight: 30, color: '#000000', marginBottom: 6 },
  subGreeting: { fontSize: 15, color: '#6B7280', marginBottom: 20 },

  alertCard: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(250,53,50,0.24)',
    borderRadius: 25,
    padding: 18,
    marginBottom: 16,
    overflow: 'visible',
  },
  alertTextBlock: { gap: 14 },
  alertTitle: { fontSize: 16, color: '#FFFFFF' },
  alertBody: { fontSize: 15, color: '#FFFFFF', opacity: 0.84, marginTop: 2 },
  alertTime: { fontSize: 13, color: '#FFFFFF', opacity: 0.84 },
  alertButton: {
    backgroundColor: '#FFFFFF', borderRadius: 26, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
  },
  alertButtonText: { fontSize: 13, color: '#000000' },
  alertImage: {
    position: 'absolute', top: -26, right: -12, width: 92, height: 94,
    transform: [{ rotate: '6deg' }],
  },

  journeyCard: {
    height: 232, borderRadius: 23, overflow: 'hidden', marginBottom: 16, justifyContent: 'space-between',
  },
  journeyTopic: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingTop: 20,
  },
  journeyTrackSection: { paddingHorizontal: 18, paddingBottom: 18 },
  journeyIconCircle: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  journeyTitle: { fontSize: 16, color: '#FFFFFF', flex: 1 ,maxWidth:160},
  journeyLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  journeyLabel: { fontSize: 12, color: '#FFFFFF' },
  journeyTrack: {
    height: 24, borderRadius: 64, backgroundColor: 'rgba(255,255,255,0.52)',
    justifyContent: 'center', overflow: 'visible',
  },
  journeyFill: { height: 24, borderRadius: 64, backgroundColor: '#D62D88' },
  journeyDot: {
    position: 'absolute', top: 0.5, width: 23, height: 23, borderRadius: 11.5,
    backgroundColor: '#FFFFFF', marginLeft: -11.5,
    alignItems: 'center', justifyContent: 'center',
  },
  journeyDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D62D88' },
  journeyNextButton: {
    position: 'absolute', top: 1.5, right: 1, width: 21, height: 21, borderRadius: 10.5,
    backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center',
  },

  mapCard: {
    height: 174, borderRadius: 23, overflow: 'hidden', marginBottom: 24,
    justifyContent: 'flex-end', padding: 13, backgroundColor: '#E9EAEE',
  },
  mapPill: {
    backgroundColor: '#FFFFFF', borderRadius: 83, paddingVertical: 10, paddingHorizontal: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  mapPillLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  mapPillIcon: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#000000',
    alignItems: 'center', justifyContent: 'center',
  },
  mapPillText: { fontSize: 13, color: '#000000' },
  mapPillTime: { fontSize: 12, color: '#6B6B6B', marginLeft: 8 },

  updatesSection: { marginBottom: 24 },
  updatesHeading: { fontSize: 19, color: '#000000', marginBottom: 16 },
  updatesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  updateCard: {
    width: '48%', height: 161, borderRadius: 28, padding: 18, justifyContent: 'flex-end', overflow: 'hidden',
  },
  updateFetus: {
    position: 'absolute', top: -12, right: -26, width: 152, height: 152, resizeMode: 'contain',
  },
  updatePill: {
    alignSelf: 'flex-start', borderRadius: 62, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 12,
  },
  updatePillText: { fontSize: 11, color: '#FFFFFF' },
  updateTitle: { fontSize: 16, color: '#000000', lineHeight: 20 },
  updateExpand: {
    position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.13, shadowOffset: { width: 0, height: 4 }, shadowRadius: 2, elevation: 3,
  },
  updateExpandIcon: { transform: [{ rotate: '-45deg' }] },
});
