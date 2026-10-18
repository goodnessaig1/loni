import React, { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { PhoneIcon, RecoveryPlanIcon, RideIcon, SupportPartnerIcon } from '../../components/NotificationIcons';
import { useMarkNotificationsRead, useNotificationFeed, AppNotification } from '../../hooks/useNotificationFeed';
import { openFromPush } from '../../lib/checkinLinks';
import { relativeTime } from '../../lib/relativeTime';

import { useTheme } from '../../context/ThemeContext';
type IconKind = 'checkin' | 'ride' | 'comment' | 'partner' | 'recovery' | 'call' | 'default';

const kindOf = (type: string): IconKind => {
  if (type === 'checkin') return 'checkin';
  if (type.startsWith('ride')) return 'ride';
  if (type.startsWith('community')) return 'comment';
  if (type.includes('partner') || type.includes('support')) return 'partner';
  if (type.includes('recovery')) return 'recovery';
  if (type.includes('call') || type.includes('nurse')) return 'call';
  return 'default';
};

const RECENT_HOURS = 48;

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'Recent' | 'Earlier'>('Recent');
  const { notifications, unread, isLoading, isError, refetch } = useNotificationFeed();
  const markRead = useMarkNotificationsRead();

  // Opening the screen is what "read" means; the dot on the Recent tab and the home bell clear afterwards.
  useEffect(() => {
    if (unread > 0) {
      const t = setTimeout(() => markRead.mutate(), 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread]);

  const { recent, earlier } = useMemo(() => {
    const cutoff = Date.now() - RECENT_HOURS * 3600_000;
    const isRecent = (n: AppNotification) => !n.created_at || new Date(n.created_at).getTime() >= cutoff;
    return { recent: notifications.filter(isRecent), earlier: notifications.filter((n) => !isRecent(n)) };
  }, [notifications]);

  const getIcon = (type: string) => {
    switch (kindOf(type)) {
      case 'call':
        return <PhoneIcon size={20} color={colors.text} />;
      case 'recovery':
        return <RecoveryPlanIcon size={20} color={colors.text} />;
      case 'ride':
        return <RideIcon size={20} color={colors.text} />;
      case 'partner':
        return <SupportPartnerIcon size={20} color={colors.text} />;
      case 'checkin':
        return <Feather name="heart" size={20} color="#D62D88" />;
      case 'comment':
        return <Feather name="message-circle" size={20} color={colors.text} />;
      default:
        return <Feather name="bell" size={20} color={colors.text} />;
    }
  };

  const onPressItem = (n: AppNotification) => {
    if (n.type === 'checkin') openFromPush({ type: 'checkin', session_id: n.data?.session_id, checkin_id: n.data?.checkin_id });
    else if (n.type.startsWith('community')) router.push('/(tabs)/community');
    else if (n.type.startsWith('partner_')) router.push('/profile/emergency-contacts' as any);
  };

  const items = activeTab === 'Recent' ? recent : earlier;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-2.5 mb-5">
        <TouchableOpacity 
          className="w-12 h-12 rounded-full border justify-center items-center" 
          style={{ borderColor: colors.border }}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10" showsVerticalScrollIndicator={false}>
        <CalText className="text-[28px] text-[#D62D88] mb-2">Notifications</CalText>
        <HelixaText className="text-base leading-6 mb-6" style={{ color: colors.textSecondary }}>
          Stay updated on your support, recovery, and emergency activity.
        </HelixaText>

        {/* Custom Tabs */}
        <View className="flex-row rounded-xl p-1 mb-8 border" style={{ backgroundColor: colors.surface, borderColor: colors.divider }}>
          <TouchableOpacity 
            className="flex-1" 
            onPress={() => setActiveTab('Recent')}
            activeOpacity={0.7}
          >
            <View 
              className="flex-1 flex-row py-3 justify-center items-center rounded-lg"
              style={activeTab === 'Recent' ? { backgroundColor: colors.elevated, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 } : {}}
            >
              <HelixaText 
                weight={activeTab === 'Recent' ? 'bold' : 'regular'} 
                style={{ fontSize: 14, color: activeTab === 'Recent' ? colors.text : colors.textSecondary }}
              >
                Recent
              </HelixaText>
              {unread > 0 && <View className="w-1.5 h-1.5 rounded-full bg-red-500 ml-1.5 -mt-2" />}
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-1" 
            onPress={() => setActiveTab('Earlier')}
            activeOpacity={0.7}
          >
            <View 
              className="flex-1 flex-row py-3 justify-center items-center rounded-lg"
              style={activeTab === 'Earlier' ? { backgroundColor: colors.elevated, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 } : {}}
            >
              <HelixaText 
                weight={activeTab === 'Earlier' ? 'bold' : 'regular'} 
                style={{ fontSize: 14, color: activeTab === 'Earlier' ? colors.text : colors.textSecondary }}
              >
                Earlier
              </HelixaText>
            </View>
          </TouchableOpacity>
        </View>

        {/* Notifications List */}
        <View className="flex-1">
          {isLoading ? (
            <View className="pt-10 items-center"><HelixaText className="text-sm" style={{ color: colors.textMuted }}>Loading...</HelixaText></View>
          ) : isError ? (
            <TouchableOpacity className="pt-10 items-center" onPress={() => refetch()}>
              <HelixaText className="text-sm" style={{ color: colors.textMuted }}>Couldn&apos;t load notifications. Tap to retry.</HelixaText>
            </TouchableOpacity>
          ) : items.length === 0 ? (
            <View className="pt-10 items-center">
              <HelixaText className="text-sm" style={{ color: colors.textMuted }}>
                {activeTab === 'Recent' ? "You're all caught up" : 'No earlier notifications'}
              </HelixaText>
            </View>
          ) : (
            items.map((item) => (
              <TouchableOpacity key={item.id} activeOpacity={0.7} onPress={() => onPressItem(item)} className="flex-row items-start mb-6">
                <View className="w-12 h-12 rounded-full justify-center items-center mr-4" style={{ backgroundColor: colors.surface }}>
                  {getIcon(item.type)}
                </View>
                <View className="flex-1 pt-1">
                  <HelixaText weight={item.read ? 'regular' : 'bold'} className="text-base mb-1">{item.title}</HelixaText>
                  <HelixaText className="text-sm leading-5 mb-1.5" style={{ color: colors.textSecondary }}>{item.body}</HelixaText>
                  <HelixaText className="text-xs" style={{ color: colors.textMuted }}>{relativeTime(item.created_at)}</HelixaText>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
