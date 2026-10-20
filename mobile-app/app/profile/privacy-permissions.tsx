import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HelixaText } from '../../components/HelixaText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CustomSwitch } from '../../components/CustomSwitch';
import { useTheme } from '../../context/ThemeContext';
import Toast from 'react-native-toast-message';
import { checkinsApi } from '../../api/checkins';
import { useCheckinPreferences } from '../../hooks/useCheckins';
import { queryClient } from '../../lib/queryClient';
import { ChangePasswordModal } from '../../components/profile/ChangePasswordModal';
import { Reveal } from '../../components/motion';

export default function PrivacyPermissionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const { prefs, update: updatePrefs } = useCheckinPreferences();
  const forgetAll = async () => {
    try {
      await checkinsApi.forget();
      queryClient.invalidateQueries({ queryKey: ['checkins'] });
      Toast.show({ type: 'success', text1: 'Done', text2: 'Loni has forgotten what you shared.' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Could not clear it', text2: e?.response?.data?.message || e?.message });
    }
  };
  
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
    <View className="flex-row justify-between items-center p-4 rounded-[14px]" style={{ backgroundColor: colors.elevated }}>
      <View className="flex-1 pr-4">
        <HelixaText className="text-[15px] mb-1">{title}</HelixaText>
        <HelixaText className="text-[13px] leading-4" style={{ color: colors.textSecondary }}>{subtitle}</HelixaText>
      </View>
      <CustomSwitch 
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <Reveal index={0}>
      <View className="flex-row items-center justify-center py-4 mb-2 relative px-6">
        <TouchableOpacity
          className="absolute left-6 w-12 h-12 rounded-full border justify-center items-center"
          style={{ borderColor: colors.border }}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <HelixaText className="text-[18px]" weight="bold">
          Privacy & Permissions
        </HelixaText>
      </View>
      </Reveal>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        
        {/* Warning Card */}
        <Reveal index={1}>
        <View className="rounded-[16px] p-5 mb-8 flex-row mt-4" style={{ backgroundColor: colors.roseSoft }}>
          <Feather name="lock" size={20} color="#E11D48" className="mr-3 mt-0.5" />
          <View className="flex-1">
            <HelixaText className="text-[15px] mb-2" weight="bold">You decide what gets shared.</HelixaText>
            <HelixaText className="text-[14px] leading-5 pr-2" style={{ color: colors.textSecondary }}>
              Your data belongs to you. Adjust what your care team and partner can see at any time. We never share your information with third parties.
            </HelixaText>
          </View>
        </View>
        </Reveal>

        {/* Sharing Preferences */}
        <Reveal index={2}>
        <HelixaText className="text-[16px] mb-4">Sharing Preferences</HelixaText>
        <View className="flex flex-col gap-3 p-4 rounded-[12px] overflow-hidden" style={{ backgroundColor: colors.surface }}>
          {renderToggleItem('Location Sharing', 'Share with your care team and partner', toggles.location, () => toggleSwitch('location'))}
          {renderToggleItem('Partner Visibility', 'Allow partner to see your updates', toggles.partnerVisibility, () => toggleSwitch('partnerVisibility'))}
          {renderToggleItem('Emergency-Only Tracking', 'Share location only during emergencies', toggles.emergencyTracking, () => toggleSwitch('emergencyTracking'))}
          {renderToggleItem('Recovery Visibility', 'Share recovery progress with care team', toggles.recoveryVisibility, () => toggleSwitch('recoveryVisibility'), true)}
        </View>
        </Reveal>

        {/* What Loni remembers */}
        <Reveal index={3}>
        <HelixaText className="mt-6 text-[16px] mb-4">Loni&apos;s Memory</HelixaText>
        <View className="flex flex-col gap-3 p-4 rounded-[12px] overflow-hidden" style={{ backgroundColor: colors.surface }}>
          {renderToggleItem(
            'Remember my day',
            'Loni keeps short notes (like "headache" or "felt low", never your words) so chats feel continuous',
            prefs?.remember ?? true,
            () => updatePrefs.mutate({ remember: !(prefs?.remember ?? true) }),
          )}
          <TouchableOpacity activeOpacity={0.6} onPress={forgetAll} className="flex-row justify-between items-center p-4 rounded-[14px]" style={{ backgroundColor: colors.elevated }}>
            <View className="flex-1 pr-4">
              <HelixaText className="text-[15px] mb-1">Clear what Loni remembers</HelixaText>
              <HelixaText className="text-[13px] leading-4" style={{ color: colors.textSecondary }}>Erase every note straight away</HelixaText>
            </View>
            <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.surface }}>
              <Feather name="trash-2" size={16} color={colors.text} />
            </View>
          </TouchableOpacity>
        </View>
        </Reveal>

        {/* App Permissions */}
        <Reveal index={4}>
        <HelixaText className="mt-6 text-[16px] mb-4">App Permissions</HelixaText>
        <View className="flex flex-col gap-3 p-4 rounded-[12px] overflow-hidden" style={{ backgroundColor: colors.surface }}>
          {renderToggleItem('Microphone', 'For voice calls and check-ins', toggles.microphone, () => toggleSwitch('microphone'), true)}
        </View>
        </Reveal>

        {/* Other Options */}
        {/* <HelixaText className="mt-6 text-[16px] mb-4 text-black">Other Options</HelixaText> */}
        <Reveal index={5}>
        <View className="flex flex-col mt-6 gap-3 p-4 rounded-[12px] overflow-hidden" style={{ backgroundColor: colors.surface }}>
          <TouchableOpacity activeOpacity={0.6} className="flex-row justify-between items-center p-4 rounded-[14px]" style={{ backgroundColor: colors.elevated }}>
            <View className="flex-1 pr-4">
              <HelixaText className="text-[15px] mb-1">About LONI</HelixaText>
              <HelixaText className="text-[13px] leading-4" style={{ color: colors.textSecondary }}>Learn how LONI supports you through every stage.</HelixaText>
            </View>
            <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.surface }}>
              <Feather name="arrow-right" size={16} color={colors.text} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.6} 
            className="flex-row justify-between items-center p-4 rounded-[14px]" style={{ backgroundColor: colors.elevated }}
            onPress={() => setIsPasswordModalVisible(true)}
          >
            <View className="flex-1 pr-4">
              <HelixaText className="text-[15px] mb-1">Change Password</HelixaText>
              <HelixaText className="text-[13px] leading-4" style={{ color: colors.textSecondary }}>Update your account password securely</HelixaText>
            </View>
            <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.surface }}>
              <Feather name="arrow-right" size={16} color={colors.text} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.6} className="flex-row justify-between items-center p-4 rounded-[14px]" style={{ backgroundColor: colors.elevated }}>
            <View className="flex-1 pr-4">
              <HelixaText className="text-[15px] mb-1">Delete Account</HelixaText>
              <HelixaText className="text-[13px] leading-4" style={{ color: colors.textSecondary }}>Permanently remove all your data</HelixaText>
            </View>
            <View className="w-10 h-10 rounded-[12px] bg-[#DC2626] items-center justify-center">
              <Feather name="trash-2" size={18} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>
        </Reveal>

        {/* Footer text */}
        <Reveal index={6}>
        <HelixaText className="text-[13px] text-center leading-5 px-4 mt-8 mb-10" style={{ color: colors.textSecondary }}>
          Your health information is kept private, sent over encrypted connections and only shared with the people you choose.
        </HelixaText>
        </Reveal>

      </ScrollView>

      <ChangePasswordModal 
        visible={isPasswordModalVisible} 
        onClose={() => setIsPasswordModalVisible(false)} 
      />
    </SafeAreaView>
  );
}
