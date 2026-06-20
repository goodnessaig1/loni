import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { PhoneIcon, RecoveryPlanIcon, RideIcon, SupportPartnerIcon } from '../../components/NotificationIcons';

type NotificationType = 'nurse_call' | 'recovery_plan' | 'ride' | 'support_partner';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  subtitle: string;
  time: string;
}

const NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    type: 'nurse_call',
    title: 'Nurse Call',
    subtitle: 'Spoke with Nurse Amy - 15 min',
    time: '5 mins ago'
  },
  {
    id: '2',
    type: 'recovery_plan',
    title: 'Recovery Plan Completed',
    subtitle: 'All tasks completed for May 6',
    time: '5 mins ago'
  },
  {
    id: '3',
    type: 'ride',
    title: 'Emergency Ride',
    subtitle: 'To Memorial Hospital - Driver: John',
    time: '5 mins ago'
  },
  {
    id: '4',
    type: 'ride',
    title: 'Driver arriving soon',
    subtitle: 'Your ride is almost there. Please keep your phone nearby.',
    time: '5 mins ago'
  },
  {
    id: '5',
    type: 'ride',
    title: 'You arrived safely',
    subtitle: 'Your emergency trip has been completed successfully.',
    time: '5 mins ago'
  },
  {
    id: '6',
    type: 'recovery_plan',
    title: "You completed today's check-in 💜",
    subtitle: 'Small steps matter. Keep going.',
    time: '5 mins ago'
  },
  {
    id: '7',
    type: 'support_partner',
    title: 'Support partner connected',
    subtitle: 'David is now part of your support circle.',
    time: '5 mins ago'
  }
];

export default function NotificationsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'Recent' | 'Earlier'>('Recent');

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'nurse_call':
        return <PhoneIcon size={20} color="#18181B" />;
      case 'recovery_plan':
        return <RecoveryPlanIcon size={20} color="#18181B" />;
      case 'ride':
        return <RideIcon size={20} color="#18181B" />;
      case 'support_partner':
        return <SupportPartnerIcon size={20} color="#18181B" />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#18181B" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <CalText style={styles.pageTitle}>Notifications</CalText>
        <HelixaText style={styles.pageSubtitle}>
          Stay updated on your support, recovery, and emergency activity.
        </HelixaText>

        {/* Custom Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Recent' && styles.activeTab]}
            onPress={() => setActiveTab('Recent')}
            activeOpacity={0.7}
          >
            <HelixaText weight={activeTab === 'Recent' ? 'bold' : 'regular'} style={[styles.tabText, activeTab === 'Recent' ? styles.activeTabText : styles.inactiveTabText]}>
              Recent
            </HelixaText>
            {activeTab === 'Recent' && <View style={styles.tabBadge} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'Earlier' && styles.activeTab]}
            onPress={() => setActiveTab('Earlier')}
            activeOpacity={0.7}
          >
            <HelixaText weight={activeTab === 'Earlier' ? 'bold' : 'regular'} style={[styles.tabText, activeTab === 'Earlier' ? styles.activeTabText : styles.inactiveTabText]}>
              Earlier
            </HelixaText>
          </TouchableOpacity>
        </View>

        {/* Notifications List */}
        <View style={styles.listContainer}>
          {activeTab === 'Recent' ? (
            NOTIFICATIONS.map((item) => (
              <View key={item.id} style={styles.notificationItem}>
                <View style={styles.iconContainer}>
                  {getIcon(item.type)}
                </View>
                <View style={styles.textContent}>
                  <HelixaText weight="bold" style={styles.title}>{item.title}</HelixaText>
                  <HelixaText style={styles.subtitle}>{item.subtitle}</HelixaText>
                  <HelixaText style={styles.time}>{item.time}</HelixaText>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <HelixaText style={styles.emptyStateText}>No earlier notifications</HelixaText>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 20,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 28,
    color: '#D62D88',
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F4F7F2',
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
  },
  activeTabText: {
    color: '#111827',
  },
  inactiveTabText: {
    color: '#6B7280',
  },
  tabBadge: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginLeft: 6,
    marginTop: -8,
  },
  listContainer: {
    flex: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F4F7F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContent: {
    flex: 1,
    paddingTop: 4,
  },
  title: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 6,
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyState: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
