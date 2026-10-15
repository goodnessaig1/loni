import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { PhoneIcon, RecoveryPlanIcon, RideIcon, SupportPartnerIcon } from '../../components/NotificationIcons';

import { useTheme } from '../../context/ThemeContext';
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
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'Recent' | 'Earlier'>('Recent');

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'nurse_call':
        return <PhoneIcon size={20} color={colors.text} />;
      case 'recovery_plan':
        return <RecoveryPlanIcon size={20} color={colors.text} />;
      case 'ride':
        return <RideIcon size={20} color={colors.text} />;
      case 'support_partner':
        return <SupportPartnerIcon size={20} color={colors.text} />;
      default:
        return null;
    }
  };

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
              {activeTab === 'Recent' && <View className="w-1.5 h-1.5 rounded-full bg-red-500 ml-1.5 -mt-2" />}
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
          {activeTab === 'Recent' ? (
            NOTIFICATIONS.map((item) => (
              <View key={item.id} className="flex-row items-start mb-6">
                <View className="w-12 h-12 rounded-full justify-center items-center mr-4" style={{ backgroundColor: colors.surface }}>
                  {getIcon(item.type)}
                </View>
                <View className="flex-1 pt-1">
                  <HelixaText weight="bold" className="text-base mb-1">{item.title}</HelixaText>
                  <HelixaText className="text-sm text-gray-500 leading-5 mb-1.5">{item.subtitle}</HelixaText>
                  <HelixaText className="text-xs text-gray-400">{item.time}</HelixaText>
                </View>
              </View>
            ))
          ) : (
            <View className="pt-10 items-center">
              <HelixaText className="text-sm text-gray-400">No earlier notifications</HelixaText>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
