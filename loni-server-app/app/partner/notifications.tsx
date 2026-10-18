import React, { useEffect } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { EmergencyAlertCard } from '../../components/partner/EmergencyAlertCard';
import { useNotifications, useMarkNotificationsRead } from '../../hooks/useNotifications';
import { relativeTimeWithClock } from '../../lib/relativeTime';
import type { PartnerNotification } from '../../api/notifications';

/** Where a notification leads: her updates, her ride, or what she shares. */
function targetFor(n: PartnerNotification): string | null {
  const rideId = Number((n.data as any)?.ride_id ?? (n.data as any)?.id);
  if (n.type === 'pregnancy_update' || n.type === 'partner_stage_changed') return '/partner/pregnancy-updates';
  if (n.type === 'partner_sharing_changed') return '/(partner)/profile';
  if (n.type.startsWith('ride_') && rideId) return `/partner/ride/${rideId}`;
  return null;
}

function InfoEventCard({ notification }: { notification: PartnerNotification }) {
  const target = targetFor(notification);
  return (
    <Pressable style={styles.eventCard} disabled={!target} onPress={() => target && router.push(target as any)}>
      <CalText style={styles.eventTitle}>{notification.title}</CalText>
      <HelixaText style={styles.eventBody} weight="bold">{notification.body}</HelixaText>
      <HelixaText style={styles.eventTime} weight="bold">
        {relativeTimeWithClock(notification.created_at)}
      </HelixaText>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconCircle}>
        <Feather name="bell" size={28} color="#D62D88" />
      </View>
      <CalText style={styles.emptyTitle}>All quiet for now</CalText>
      <HelixaText style={styles.emptySubtext}>
        You'll see it here the moment something needs your attention - an emergency alert, a new update, or anything else she shares with you.
      </HelixaText>
    </View>
  );
}

export default function PartnerNotificationsScreen() {
  const { data } = useNotifications();
  const { mutate: markRead } = useMarkNotificationsRead();
  const notifications = data?.notifications ?? [];

  useEffect(() => {
    if (data && data.unread_count > 0) markRead();
  }, [data?.unread_count]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#000000" />
        </Pressable>
        <CalText style={styles.headerTitle}>Notification centre</CalText>
        <View style={styles.backButton} />
      </View>

      {notifications.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <HelixaText style={styles.sectionLabel} weight="bold">Recent</HelixaText>
          <View style={styles.list}>
            {notifications.map((n) => (
              n.type === 'ride_contact_alert' ? (
                <EmergencyAlertCard
                  key={n.id}
                  inviterName={(n.data?.rider_name as string) ?? 'She'}
                  rideId={Number(n.data?.ride_id ?? n.data?.id)}
                  requestedAt={(n.data?.requested_at as string) ?? n.created_at}
                />
              ) : (
                <InfoEventCard key={n.id} notification={n} />
              )
            ))}
          </View>

          <View style={styles.caughtUp}>
            <Feather name="check" size={20} color="#000000" />
            <HelixaText style={styles.caughtUpText} weight="bold">You're all caught up</HelixaText>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 21, paddingTop: 16,
  },
  backButton: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, color: '#000000' },
  scroll: { paddingHorizontal: 21, paddingTop: 24, paddingBottom: 60 },
  sectionLabel: { fontSize: 16, color: '#000000', marginBottom: 22 },
  list: { gap: 11, marginBottom: 41 },
  eventCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EDEFF2', borderRadius: 11,
    padding: 18, gap: 4,
    shadowColor: '#101828', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1,
  },
  eventTitle: { fontSize: 16, color: '#000000' },
  eventBody: { fontSize: 15, color: '#848484', marginTop: 2 },
  eventTime: { fontSize: 13, color: '#848484', marginTop: 4 },
  caughtUp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  caughtUpText: { fontSize: 15, color: '#000000' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 80 },
  emptyIconCircle: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: '#FDF2F8',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, color: '#000000', marginBottom: 10, textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21 },
});
