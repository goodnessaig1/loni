import React from 'react';
import { View, ScrollView, TouchableOpacity, ImageBackground, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';

const { width } = Dimensions.get('window');

const features = [
  'Unlimited nurse calls',
  'Unlimited emergency rides',
  'Request your preferred nurse',
  'Faster ride dispatch',
  'Enhanced recovery plans'
];

export default function UpgradeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View className="mb-6">
          <CalText className="text-[#D62D88] text-[32px] mb-2 leading-10">Upgrade Your Comfort</CalText>
          <HelixaText className="text-gray-500 text-[16px]">Get unlimited access to all LONI features</HelixaText>
        </View>

        {/* Main Card */}
        <View className="bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm mb-10 shadow-gray-200/50">
          
          {/* Top Section with Background Image */}
          <ImageBackground 
            source={require('../../assets/images/planbg.png')} 
            style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 }}
            imageStyle={{ borderTopLeftRadius: 32, borderTopRightRadius: 32 }}
          >
            <HelixaText weight="bold" className="text-[#0F172A] text-[16px] mb-4">LoniPlus</HelixaText>
            
            <View className="flex-row items-end mb-2">
              <CalText className="text-black text-[48px] leading-[54px]">$29</CalText>
              <HelixaText className="text-gray-600 text-[14px] mb-2 ml-1">/Per Month</HelixaText>
            </View>
            
            <HelixaText className="text-gray-600 text-[14px] mb-6">Cancel anytime • No commitments</HelixaText>

            <TouchableOpacity className="w-full bg-[#D62D88] rounded-full py-4 items-center">
              <HelixaText weight="bold" className="text-white text-[16px]">Start 30-Day Free Trial</HelixaText>
            </TouchableOpacity>
          </ImageBackground>

          {/* Features List Section */}
          <View className="px-6 pt-6 pb-8 bg-white">
            {features.map((feature, index) => (
              <View key={index} className="flex-row items-center mb-4">
                <View className="w-6 h-6 rounded-full bg-[#F3F4F6] items-center justify-center mr-3">
                  <Feather name="check" size={14} color="#6B7280" />
                </View>
                <HelixaText className="text-gray-600 text-[15px]">{feature}</HelixaText>
              </View>
            ))}

            <HelixaText className="text-gray-400 text-[13px] mt-4 leading-5">
              No charge during trial • Cancel before May 13 to avoid billing
            </HelixaText>
          </View>

        </View>

        {/* Footer Text */}
        <View className="px-4">
          <HelixaText className="text-center text-gray-500 text-[14px] leading-6">
            You're already getting great care with the free plan. Upgrade when you're ready for unlimited peace of mind.
          </HelixaText>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
