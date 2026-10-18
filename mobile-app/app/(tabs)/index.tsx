import React from 'react';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';
import { PressableScale, Reveal } from '../../components/motion';
import { InvitePartnerModal } from '../../components/profile/InvitePartnerModal';
import { CommunityBubbleIcon } from '../../components/community/CommunityIcons';
import { useTheme } from '../../context/ThemeContext';
import { PregnancyCard } from '../../components/home/PregnancyCard';
import { TodaysTip } from '../../components/home/TodaysTip';
import { PlusBanner } from '../../components/home/PlusBanner';
import { PremiumSections } from '../../components/home/PremiumSections';
import { useSubscription } from '../../hooks/useSubscription';
import { useNotificationFeed } from '../../hooks/useNotificationFeed';
import { getPregnancyProgress, tipOfTheDay } from '../../lib/pregnancy';

export default function HomeTab() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [isInviteModalVisible, setIsInviteModalVisible] = React.useState(false);

  // The emergency-ride card is mounted app-wide (components/RideTrackerModal.tsx RideTrackerHost).

  const hour = new Date().getHours();
  let greeting = 'Evening';
  if (hour < 12) greeting = 'Morning';
  else if (hour < 18) greeting = 'Afternoon';

  const { hasAccess, isLoading: subLoading } = useSubscription();
  const { unread } = useNotificationFeed();
  const progress = React.useMemo(() => getPregnancyProgress(user), [user]);
  const tip = React.useMemo(() => tipOfTheDay(progress?.kind), [progress?.kind]);

  const firstName = user?.name ? user.name.split(' ')[0] : 'User';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      
      {/* Room at the end so the last card scrolls clear of the floating buttons and the tab bar. */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 32, paddingBottom: 260 }}>

        <Reveal index={0}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 }}>
          {/* Notification Bell */}
          <TouchableOpacity onPress={() => router.push('/notifications')} style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="bell" size={24} color={colors.text} />
            {unread > 0 && <View style={{ position: 'absolute', top: 13, right: 14, width: 10, height: 10, backgroundColor: '#D62D88', borderRadius: 5 }} />}
          </TouchableOpacity>

          {/* Arrival Pill */}
          {/* <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 }}>
            <View style={{ backgroundColor: '#D62D88', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <MaterialCommunityIcons name="car" size={14} color="#FFF" />
            </View>
            <HelixaText style={{ color: '#FFF', fontSize: 12, marginRight: 10 }}>Estimated Arrival: 2:45 PM</HelixaText>
            <Feather name="maximize-2" size={14} color="#FFF" />
          </View> */}

          {/* Avatar */}
          <TouchableOpacity onPress={() => { }}>
            <Image
              source={{ uri: user?.profilePicture || 'https://i.pravatar.cc/150' }}
              style={{ width: 52, height: 52, borderRadius: 26 }}
              contentFit="cover"
            />
          </TouchableOpacity>
        </View>

        </Reveal>
        <Reveal index={1}>
        {/* Greeting Section */}
        <View style={{ marginBottom: 30 }}>
          <CalText style={{ color: '#D62D88', fontSize: 32, marginBottom: 4 }}>{greeting}</CalText>
          <HelixaText style={{ fontSize: 32, color: colors.text, marginBottom: 8 }}>{firstName} ☀️</HelixaText>
          <HelixaText style={{ fontSize: 16, color: colors.textSecondary }}>How are you feeling today?</HelixaText>
        </View>

        </Reveal>
        <Reveal index={2}>
        {progress && (
          <View style={{ marginBottom: 28 }}>
            <PregnancyCard progress={progress} onPress={() => router.push(progress.kind === 'pregnant' ? '/journey' : '/recovery')} />
          </View>
        )}

        </Reveal>
        <Reveal index={3}>
        <TodaysTip tip={tip} />

        </Reveal>
        <Reveal index={4}>
        <HelixaText style={{ fontSize: 16, color: colors.textSecondary, fontWeight: 'bold', marginBottom: 16 }}>What do you need?</HelixaText>

        {/* Grid Section */}
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {/* Left Column */}
          <View style={{ flex: 1, gap: 16 }}>
            {/* Recovery Plan Card */}
            <PressableScale onPress={() => router.push('/recovery')} style={{ backgroundColor: '#F68AA8', borderRadius: 20, padding: 16, height: 200, overflow: 'hidden', justifyContent: 'flex-end' }}>
              <Image
                source={require('../../assets/images/plan.svg')}
                style={{ width: 130, height: 100, position: 'absolute', top: 10, right: -10 }}
                contentFit="contain"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <HelixaText weight="bold" style={{ color: '#FFF', fontSize: 17, width: '70%', lineHeight: 22 }}>Recovery Plan</HelixaText>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="arrow-right" size={16} color="#F68AA8" />
                </View>
              </View>
            </PressableScale>

            {/* Emergency Ride Card */}
            <PressableScale onPress={() => router.push('/ride/request')} style={{ backgroundColor: '#D62D88', borderRadius: 20, padding: 16, height: 200, overflow: 'hidden', justifyContent: 'flex-end' }}>
              <Image
                source={require('../../assets/images/ride.svg')}
                style={{ width: 120, height: 90, position: 'absolute', top: 30, right: -10 }}
                contentFit="contain"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <HelixaText weight="bold" style={{ color: '#FFF', fontSize: 17, width: '70%', lineHeight: 22 }}>Emergency Ride</HelixaText>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="arrow-right" size={16} color="#D62D88" />
                </View>
              </View>
            </PressableScale>
          </View>

          {/* Right Column */}
          <View style={{ flex: 1 }}>
            {/* Talk to a Nurse Card */}
            <PressableScale onPress={() => router.push('/nurse/connecting')} style={{ backgroundColor: '#2C4EDA', borderRadius: 20, padding: 16, height: 416, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
                <HelixaText weight="bold" style={{ color: '#FFF', fontSize: 17, width: '60%', lineHeight: 22 }}>Talk to a Nurse</HelixaText>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="arrow-right" size={16} color="#2C4EDA" />
                </View>
              </View>
              <Image
                source={require('../../assets/images/nurse.svg')}
                style={{ width: 180, height: 280, position: 'absolute', bottom: 0, right: -15 }}
                contentFit="contain"
              />
            </PressableScale>

          </View>
        </View>

        </Reveal>
        <Reveal index={5}>
        {/* Free mothers are offered the trial; members get their care tools right here. */}
        {!subLoading && (hasAccess ? <PremiumSections /> : (
          <View style={{ marginTop: 24 }}>
            <PlusBanner onPress={() => router.push('/subscribe')} />
          </View>
        ))}

        </Reveal>
      </ScrollView>
      
      {/* Always on screen: floats above the tab bar (bottom 40 + height 87) instead of scrolling away. */}
      <Reveal index={6} delay={120} pointerEvents="box-none" style={{ position: 'absolute', right: 20, bottom: 140, alignItems: 'flex-end', gap: 10, zIndex: 10 }}>
        <PressableScale
          onPress={() => router.push('/(tabs)/community')}
          accessibilityRole="button"
          accessibilityLabel="My Community"
          style={{ backgroundColor: '#000', borderWidth: 1, borderColor: isDark ? '#2A2D34' : '#000', borderRadius: 25, paddingVertical: 14, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 }}>
          <HelixaText weight="bold" style={{ color: '#FFF', fontSize: 14 }}>My Community</HelixaText>
          <CommunityBubbleIcon size={20} />
        </PressableScale>

        <PressableScale
          onPress={() => setIsInviteModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add Support Partner"
          style={{ backgroundColor: '#00C300', borderRadius: 25, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 }}>
          <HelixaText weight="bold" style={{ color: '#FFF', fontSize: 14 }}>Add Support Partner</HelixaText>
          <Feather name="plus" size={18} color="#FFF" />
        </PressableScale>
      </Reveal>

      <InvitePartnerModal 
        visible={isInviteModalVisible} 
        onClose={() => setIsInviteModalVisible(false)} 
      />
    </SafeAreaView>
  );
}
