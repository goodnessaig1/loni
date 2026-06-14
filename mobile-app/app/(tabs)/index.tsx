import React from 'react';
import { View, ScrollView, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';

export default function HomeTab() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 }}>
        
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 }}>
          {/* Notification Bell */}
          <TouchableOpacity style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="bell" size={20} color="#000" />
            <View style={{ position: 'absolute', top: 10, right: 12, width: 8, height: 8, backgroundColor: '#D62D88', borderRadius: 4 }} />
          </TouchableOpacity>

          {/* Arrival Pill */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 }}>
            <View style={{ backgroundColor: '#D62D88', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <MaterialCommunityIcons name="car" size={14} color="#FFF" />
            </View>
            <Text style={{ color: '#FFF', fontSize: 13, marginRight: 10 }}>Estimated Arrival: 2:45 PM</Text>
            <Feather name="maximize-2" size={14} color="#FFF" />
          </View>

          {/* Avatar */}
          <Image 
            source={{ uri: 'https://i.pravatar.cc/100' }} 
            style={{ width: 44, height: 44, borderRadius: 22 }}
          />
        </View>

        {/* Greeting Section */}
        <View style={{ marginBottom: 30 }}>
          <CalText style={{ color: '#D62D88', fontSize: 32, marginBottom: 4 }}>Morning</CalText>
          <CalText style={{ fontSize: 36, color: '#000', marginBottom: 8 }}>Toyosola ☀️</CalText>
          <HelixaText style={{ fontSize: 16, color: '#6B7280' }}>How are you feeling today?</HelixaText>
        </View>

        <HelixaText style={{ fontSize: 16, color: '#000', fontWeight: 'bold', marginBottom: 16 }}>What do you need?</HelixaText>

        {/* Grid Section */}
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {/* Left Column */}
          <View style={{ flex: 1, gap: 16 }}>
            {/* Recovery Plan Card */}
            <TouchableOpacity style={{ backgroundColor: '#F68AA8', borderRadius: 20, padding: 16, height: 200, overflow: 'hidden', justifyContent: 'space-between' }}>
              <View style={{ alignItems: 'center', marginTop: 10 }}>
                <Image 
                  source={require('../../assets/images/plan.svg')} 
                  style={{ width: 100, height: 80 }} 
                  contentFit="contain"
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <CalText style={{ color: '#FFF', fontSize: 18, width: '70%' }}>Recovery Plan</CalText>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="arrow-right" size={16} color="#F68AA8" />
                </View>
              </View>
            </TouchableOpacity>

            {/* Emergency Ride Card */}
            <TouchableOpacity style={{ backgroundColor: '#D62D88', borderRadius: 20, padding: 16, height: 200, overflow: 'hidden', justifyContent: 'space-between' }}>
              <View style={{ alignItems: 'center', marginTop: 10 }}>
                <Image 
                  source={require('../../assets/images/ride.svg')} 
                  style={{ width: 100, height: 80 }} 
                  contentFit="contain"
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <CalText style={{ color: '#FFF', fontSize: 18, width: '70%' }}>Emergency Ride</CalText>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="arrow-right" size={16} color="#D62D88" />
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Right Column */}
          <View style={{ flex: 1 }}>
            {/* Talk to a Nurse Card */}
            <TouchableOpacity style={{ backgroundColor: '#2C4EDA', borderRadius: 20, padding: 16, height: 416, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <CalText style={{ color: '#FFF', fontSize: 18, width: '60%' }}>Talk to a Nurse</CalText>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="arrow-right" size={16} color="#2C4EDA" />
                </View>
              </View>
              <View style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                <Image 
                  source={require('../../assets/images/nurse.svg')} 
                  style={{ width: 150, height: 250, marginBottom: -16 }} 
                  contentFit="contain"
                />
              </View>
            </TouchableOpacity>
            
            {/* Add Support Partner Button */}
            <TouchableOpacity style={{ backgroundColor: '#00C300', borderRadius: 25, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'absolute', bottom: 40, left: -20, right: -20, zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 }}>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14 }}>Add Support Partner</Text>
              <Feather name="plus" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
