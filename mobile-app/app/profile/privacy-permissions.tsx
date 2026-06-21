import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HelixaText } from '../../components/HelixaText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomSwitch } from '../../components/CustomSwitch';

export default function PrivacyPermissionsScreen() {
  const router = useRouter();
  
  const [toggles, setToggles] = useState({
    location: false,
    partnerVisibility: false,
    emergencyTracking: false,
    recoveryVisibility: false,
    microphone: false,
  });

  const toggleSwitch = (key: keyof typeof toggles) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderToggleItem = (title: string, subtitle: string, value: boolean, onValueChange: () => void, isLast = false) => (
    <View className={`flex-row justify-between items-center bg-white p-4 rounded-[14px]`}>
      <View className="flex-1 pr-4">
        <HelixaText className="text-[15px] mb-1 text-black">{title}</HelixaText>
        <HelixaText className="text-[13px] text-gray-500 leading-4">{subtitle}</HelixaText>
      </View>
      <CustomSwitch 
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-center py-4 mb-2 relative px-6">
        <TouchableOpacity
          className="absolute left-6 w-12 h-12 rounded-full border border-gray-200 justify-center items-center"
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <HelixaText className="text-[18px]" weight="bold">
          Privacy & Permissions
        </HelixaText>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        
        {/* Warning Card */}
        <View className="bg-[#FFE4E6] rounded-[16px] p-5 mb-8 flex-row mt-4">
          <Feather name="lock" size={20} color="#E11D48" className="mr-3 mt-0.5" />
          <View className="flex-1">
            <HelixaText className="text-[15px] mb-2 text-black" weight="bold">You decide what gets shared.</HelixaText>
            <HelixaText className="text-[14px] text-gray-600 leading-5 pr-2">
              Your data belongs to you. Adjust what your care team and partner can see at any time. We never share your information with third parties.
            </HelixaText>
          </View>
        </View>

        {/* Sharing Preferences */}
        <HelixaText className="text-[16px] mb-4 text-black">Sharing Preferences</HelixaText>
        <View className="bg-[#F2F2F2] flex flex-col gap-3 p-4 rounded-[12px] overflow-hidden">
          {renderToggleItem('Location Sharing', 'Share with your care team and partner', toggles.location, () => toggleSwitch('location'))}
          {renderToggleItem('Partner Visibility', 'Allow partner to see your updates', toggles.partnerVisibility, () => toggleSwitch('partnerVisibility'))}
          {renderToggleItem('Emergency-Only Tracking', 'Share location only during emergencies', toggles.emergencyTracking, () => toggleSwitch('emergencyTracking'))}
          {renderToggleItem('Recovery Visibility', 'Share recovery progress with care team', toggles.recoveryVisibility, () => toggleSwitch('recoveryVisibility'), true)}
        </View>

        {/* App Permissions */}
        <HelixaText className="mt-6 text-[16px] mb-4 text-black">App Permissions</HelixaText>
        <View className="bg-[#F2F2F2] flex flex-col gap-3 p-4 rounded-[12px] overflow-hidden">
          {renderToggleItem('Microphone', 'For voice calls and check-ins', toggles.microphone, () => toggleSwitch('microphone'), true)}
        </View>

        {/* Other Options */}
        {/* <HelixaText className="mt-6 text-[16px] mb-4 text-black">Other Options</HelixaText> */}
        <View className="bg-[#F2F2F2] flex flex-col mt-6 gap-3 p-4 rounded-[12px] overflow-hidden">
          <TouchableOpacity activeOpacity={0.6} className="flex-row justify-between items-center bg-white p-4 rounded-[14px]">
            <View className="flex-1 pr-4">
              <HelixaText className="text-[15px] mb-1 text-black">About LONI</HelixaText>
              <HelixaText className="text-[13px] text-gray-500 leading-4">Learn how LONI supports you through every stage.</HelixaText>
            </View>
            <View className="w-8 h-8 rounded-full bg-[#F3F4F6] items-center justify-center">
              <Feather name="arrow-right" size={16} color="#000" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.6} className="flex-row justify-between items-center bg-white p-4 rounded-[14px]">
            <View className="flex-1 pr-4">
              <HelixaText className="text-[15px] mb-1 text-black">Change Password</HelixaText>
              <HelixaText className="text-[13px] text-gray-500 leading-4">Update your account password securely</HelixaText>
            </View>
            <View className="w-8 h-8 rounded-full bg-[#F3F4F6] items-center justify-center">
              <Feather name="arrow-right" size={16} color="#000" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.6} className="flex-row justify-between items-center bg-white p-4 rounded-[14px]">
            <View className="flex-1 pr-4">
              <HelixaText className="text-[15px] mb-1 text-black">Delete Account</HelixaText>
              <HelixaText className="text-[13px] text-gray-500 leading-4">Permanently remove all your data</HelixaText>
            </View>
            <View className="w-10 h-10 rounded-[12px] bg-[#DC2626] items-center justify-center">
              <Feather name="trash-2" size={18} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer text */}
        <HelixaText className="text-[13px] text-gray-500 text-center leading-5 px-4 mt-8 mb-10">
          LONI is HIPAA-compliant. Your health information is encrypted and stored securely.
        </HelixaText>

      </ScrollView>
    </SafeAreaView>
  );
}
