import React, { useState } from 'react';
import { View, Pressable, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../components/HelixaText';
import Svg, { Path, G, Defs, Rect, ClipPath } from 'react-native-svg';

const CustomSwitch = ({ value, onValueChange, disabled }: { value: boolean, onValueChange: (v: boolean) => void, disabled?: boolean }) => {
  const trackColor = disabled ? '#9CA3AF' : (value ? '#000000' : '#E5E7EB');
  const thumbColor = disabled ? '#D1D5DB' : '#FFFFFF';

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      style={{
        width: 51,
        height: 31,
        borderRadius: 15.5,
        backgroundColor: trackColor,
        justifyContent: 'center',
        paddingHorizontal: 2,
      }}
    >
      <View
        style={{
          width: 27,
          height: 27,
          borderRadius: 13.5,
          backgroundColor: thumbColor,
          alignSelf: value ? 'flex-end' : 'flex-start',
          shadowColor: disabled ? 'transparent' : '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: disabled ? 0 : 0.2,
          shadowRadius: 2,
          elevation: disabled ? 0 : 2,
        }}
      />
    </Pressable>
  );
};

export default function NotificationSettingsScreen() {
  const [emergencyAlerts, setEmergencyAlerts] = useState(true);
  const [recoveryReminders, setRecoveryReminders] = useState(false);
  const [wellnessCheckins, setWellnessCheckins] = useState(true);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-6 py-4">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full border border-gray-200 items-center justify-center bg-white"
        >
          <Feather name="arrow-left" size={20} color="#000" />
        </Pressable>
        <HelixaText className="flex-1 text-center text-lg mr-10" weight="bold">
          Notification Settings
        </HelixaText>
      </View>

      <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false}>
        {/* Emergency Alerts Card */}
        <View style={{ backgroundColor: '#F2F2F2', padding: 16, borderRadius: 12, marginBottom: 17 }}>
          <View style={{ backgroundColor: '#FFFFFF', paddingTop: 13, paddingBottom: 13, paddingLeft: 18, paddingRight: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View className="flex-row items-center flex-1">
              <View style={{ borderRadius: 100 }} className="w-10 h-10 bg-[#F2F2F2] items-center justify-center mr-4">
                <Svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <Path d="M9.36492 18.2293C9.16325 18.146 8.97908 18.0279 8.81242 17.8752L2.12492 11.1877C1.97214 11.021 1.85409 10.8368 1.77075 10.6352C1.68742 10.4335 1.64575 10.2218 1.64575 10.0002C1.64575 9.7785 1.68742 9.56322 1.77075 9.35433C1.85409 9.14545 1.97214 8.96489 2.12492 8.81267L8.81242 2.12517C8.97908 1.9585 9.16325 1.83684 9.36492 1.76017C9.56658 1.6835 9.77825 1.64545 9.99992 1.646C10.2216 1.64656 10.4369 1.68489 10.6458 1.761C10.8546 1.83711 11.0352 1.9585 11.1874 2.12517L17.8749 8.81267C18.0416 8.96545 18.1632 9.146 18.2399 9.35433C18.3166 9.56267 18.3546 9.77795 18.3541 10.0002C18.3535 10.2224 18.3155 10.4343 18.2399 10.636C18.1644 10.8377 18.0427 11.0216 17.8749 11.1877L11.1874 17.8752C11.0346 18.0279 10.8541 18.146 10.6458 18.2293C10.4374 18.3127 10.2221 18.3543 9.99992 18.3543C9.7777 18.3543 9.56658 18.3127 9.36492 18.2293ZM9.99992 16.6877L16.6874 10.0002L9.99992 3.31267L3.31242 10.0002L9.99992 16.6877ZM10.5941 10.5943C10.7535 10.4343 10.8333 10.2363 10.8333 10.0002V6.66683C10.8333 6.43072 10.7533 6.23295 10.5933 6.0735C10.4333 5.91406 10.2355 5.83406 9.99992 5.8335C9.76436 5.83295 9.56658 5.91295 9.40658 6.0735C9.24658 6.23406 9.16658 6.43184 9.16658 6.66683V10.0002C9.16658 10.2363 9.24658 10.4343 9.40658 10.5943C9.56658 10.7543 9.76436 10.8341 9.99992 10.8335C10.2355 10.8329 10.4335 10.7529 10.5941 10.5935M10.5941 13.0935C10.7535 12.9346 10.8333 12.7368 10.8333 12.5002C10.8333 12.2635 10.7533 12.0657 10.5933 11.9068C10.4333 11.7479 10.2355 11.6679 9.99992 11.6668C9.76436 11.6657 9.56658 11.7457 9.40658 11.9068C9.24658 12.0679 9.16658 12.2657 9.16658 12.5002C9.16658 12.7346 9.24658 12.9327 9.40658 13.0943C9.56658 13.256 9.76436 13.3357 9.99992 13.3335C10.2355 13.3313 10.4335 13.2513 10.5941 13.0935Z" fill="#DE3A3A" />
                </Svg>
              </View>
              <View className="flex-1 pr-4">
                <HelixaText className="text-[15px] text-black mb-1" weight="bold">Emergency Alerts</HelixaText>
                <HelixaText className="text-[13px] text-gray-500">Urgent notifications from your care team</HelixaText>
              </View>
            </View>
            <CustomSwitch
              value={emergencyAlerts}
              onValueChange={setEmergencyAlerts}
              disabled={true}
            />
          </View>
        </View>

        {/* Recovery Reminders Card */}
        <View style={{ backgroundColor: '#F2F2F2', padding: 16, borderRadius: 12, marginBottom: 17 }}>
          <View style={{ backgroundColor: '#FFFFFF', paddingTop: 13, paddingBottom: 13, paddingLeft: 18, paddingRight: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View className="flex-row items-center flex-1">
              <View style={{ borderRadius: 100 }} className="w-10 h-10 bg-[#F2F2F2] items-center justify-center mr-4">
                <Feather name="heart" size={20} color="#F26C8D" />
              </View>
              <View className="flex-1 pr-4">
                <HelixaText className="text-[15px] text-black mb-1" weight="bold">Recovery Reminders</HelixaText>
                <HelixaText className="text-[13px] text-gray-500">Gentle prompts for wellness activities</HelixaText>
              </View>
            </View>
            <CustomSwitch
              value={recoveryReminders}
              onValueChange={setRecoveryReminders}
            />
          </View>
        </View>

        {/* Wellness Check-ins Card */}
        <View style={{ backgroundColor: '#F2F2F2', padding: 16, borderRadius: 12, marginBottom: 17 }}>
          <View style={{ backgroundColor: '#FFFFFF', paddingTop: 13, paddingBottom: 13, paddingLeft: 18, paddingRight: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View className="flex-row items-center flex-1">
              <View style={{ borderRadius: 100 }} className="w-10 h-10 bg-[#F2F2F2] items-center justify-center mr-4">
                <Svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <G clipPath="url(#clip0_254_7193)">
                    <Path d="M7.5 9.99984H6.25V8.74984H7.5V9.99984ZM12.5 9.99984H11.25V8.74984H12.5V9.99984ZM17.5 8.74984V11.2498H16.25V14.3748C16.25 14.6353 16.2012 14.8794 16.1035 15.1073C16.0059 15.3351 15.8724 15.5337 15.7031 15.703C15.5339 15.8722 15.3353 16.0057 15.1074 16.1034C14.8796 16.201 14.6354 16.2498 14.375 16.2498H11.7969L7.5 19.9217V16.2498H4.375C4.11458 16.2498 3.87044 16.201 3.64258 16.1034C3.41471 16.0057 3.21615 15.8722 3.04688 15.703C2.8776 15.5337 2.74414 15.3351 2.64648 15.1073C2.54883 14.8794 2.5 14.6353 2.5 14.3748V11.2498H1.25V8.74984H2.5V6.87484C2.5 6.61442 2.54883 6.37028 2.64648 6.14242C2.74414 5.91455 2.8776 5.71598 3.04688 5.54671C3.21615 5.37744 3.41471 5.24398 3.64258 5.14632C3.87044 5.04867 4.11458 4.99984 4.375 4.99984H8.75V2.95882C8.5612 2.84814 8.41146 2.69515 8.30078 2.49984C8.1901 2.30452 8.13151 2.09619 8.125 1.87484C8.125 1.69906 8.15755 1.5363 8.22266 1.38656C8.28776 1.23682 8.37565 1.10661 8.48633 0.995931C8.59701 0.885254 8.73047 0.794108 8.88672 0.722493C9.04297 0.650879 9.20573 0.618327 9.375 0.624837C9.55078 0.624837 9.71354 0.657389 9.86328 0.722493C10.013 0.787598 10.1432 0.875488 10.2539 0.986165C10.3646 1.09684 10.4557 1.23031 10.5273 1.38656C10.599 1.54281 10.6315 1.70557 10.625 1.87484C10.625 2.09619 10.5697 2.30452 10.459 2.49984C10.3483 2.69515 10.1953 2.84814 10 2.95882V4.99984H14.375C14.6354 4.99984 14.8796 5.04867 15.1074 5.14632C15.3353 5.24398 15.5339 5.37744 15.7031 5.54671C15.8724 5.71598 16.0059 5.91455 16.1035 6.14242C16.2012 6.37028 16.25 6.61442 16.25 6.87484V8.74984H17.5ZM15 6.87484C15 6.70557 14.9382 6.55908 14.8145 6.43538C14.6908 6.31169 14.5443 6.24984 14.375 6.24984H4.375C4.20573 6.24984 4.05924 6.31169 3.93555 6.43538C3.81185 6.55908 3.75 6.70557 3.75 6.87484V14.3748C3.75 14.5441 3.81185 14.6906 3.93555 14.8143C4.05924 14.938 4.20573 14.9998 4.375 14.9998H8.75V17.2069L11.3281 14.9998H14.375C14.5443 14.9998 14.6908 14.938 14.8145 14.8143C14.9382 14.6906 15 14.5441 15 14.3748V6.87484ZM6.68945 11.3866C7.04753 11.7446 7.45768 12.0181 7.91992 12.2069C8.38216 12.3957 8.86719 12.4933 9.375 12.4998C9.88281 12.4998 10.3678 12.4054 10.8301 12.2166C11.2923 12.0278 11.7025 11.7511 12.0605 11.3866L12.9395 12.2752C12.4642 12.7505 11.9206 13.1151 11.3086 13.369C10.6966 13.6229 10.0521 13.7498 9.375 13.7498C8.70443 13.7498 8.06315 13.6229 7.45117 13.369C6.83919 13.1151 6.29232 12.7505 5.81055 12.2752L6.68945 11.3866Z" fill="#9346E0" />
                  </G>
                  <Defs>
                    <ClipPath id="clip0_254_7193">
                      <Rect width="20" height="20" fill="white" />
                    </ClipPath>
                  </Defs>
                </Svg>
              </View>
              <View className="flex-1 pr-4">
                <HelixaText className="text-[15px] text-black mb-1" weight="bold">Wellness Check-ins</HelixaText>
                <HelixaText className="text-[13px] text-gray-500">Daily mood and symptom prompts</HelixaText>
              </View>
            </View>
            <CustomSwitch
              value={wellnessCheckins}
              onValueChange={setWellnessCheckins}
            />
          </View>
        </View>

        <HelixaText className="text-center text-[13px] text-gray-500 px-4 leading-5 mt-4">
          Emergency alerts are always enabled for your safety.
        </HelixaText>

      </ScrollView>
    </SafeAreaView>
  );
}
