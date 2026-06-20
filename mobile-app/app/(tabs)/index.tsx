import React from 'react';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';

export default function HomeTab() {
  const { user } = useAuth();
  const router = useRouter();

  const hour = new Date().getHours();
  let greeting = 'Evening';
  if (hour < 12) greeting = 'Morning';
  else if (hour < 18) greeting = 'Afternoon';

  const firstName = user?.name ? user.name.split(' ')[0] : 'User';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 32, paddingBottom: 120 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 }}>
          {/* Notification Bell */}
          <TouchableOpacity style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="bell" size={24} color="#000" />
            <View style={{ position: 'absolute', top: 13, right: 14, width: 10, height: 10, backgroundColor: '#D62D88', borderRadius: 5 }} />
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

        {/* Greeting Section */}
        <View style={{ marginBottom: 30 }}>
          <CalText style={{ color: '#D62D88', fontSize: 32, marginBottom: 4 }}>{greeting}</CalText>
          <HelixaText style={{ fontSize: 32, color: '#000', marginBottom: 8 }}>{firstName} ☀️</HelixaText>
          <HelixaText style={{ fontSize: 16, color: '#6B7280' }}>How are you feeling today?</HelixaText>
        </View>

        <HelixaText style={{ fontSize: 16, color: '#000', fontWeight: 'bold', marginBottom: 16 }}>What do you need?</HelixaText>

        {/* Grid Section */}
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {/* Left Column */}
          <View style={{ flex: 1, gap: 16 }}>
            {/* Recovery Plan Card */}
            <TouchableOpacity style={{ backgroundColor: '#F68AA8', borderRadius: 20, padding: 16, height: 200, overflow: 'hidden', justifyContent: 'flex-end' }}>
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
            </TouchableOpacity>

            {/* Emergency Ride Card */}
            <TouchableOpacity style={{ backgroundColor: '#D62D88', borderRadius: 20, padding: 16, height: 200, overflow: 'hidden', justifyContent: 'flex-end' }}>
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
            </TouchableOpacity>
          </View>

          {/* Right Column */}
          <View style={{ flex: 1 }}>
            {/* Talk to a Nurse Card */}
            <TouchableOpacity onPress={() => router.push('/nurse/connecting')} style={{ backgroundColor: '#2C4EDA', borderRadius: 20, padding: 16, height: 416, overflow: 'hidden' }}>
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
            </TouchableOpacity>

            {/* Add Support Partner Button */}
            <TouchableOpacity style={{ backgroundColor: '#00C300', borderRadius: 25, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'absolute', bottom: 40, left: -16, right: 0, zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 }}>
              <HelixaText weight="bold" style={{ color: '#FFF', fontSize: 14 }}>Add Support Partner</HelixaText>
              <Feather name="plus" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
