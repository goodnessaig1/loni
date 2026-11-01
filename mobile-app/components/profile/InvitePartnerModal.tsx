import React, { useEffect, useState } from 'react';
import { View, Modal, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { CalText } from '../CalText';
import { HelixaText } from '../HelixaText';
import { ModalKeyboardAvoid } from '../KeyboardAvoid';
import { useTheme } from '../../context/ThemeContext';
import { emergencyContactsApi } from '../../api/emergencyContacts';
import { useEmergencyContacts } from '../../context/EmergencyContactsContext';
import { ActivityIndicator } from 'react-native';

interface InvitePartnerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const InvitePartnerModal = ({ visible, onClose }: InvitePartnerModalProps) => {
  const { colors, isDark } = useTheme();
  const { refreshContacts } = useEmergencyContacts();
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState("I'm using LONI for pregnancy and recovery support. I'd love for you to join my support circle so we can stay connected during important moments 💜");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSendInvite = async () => {
    setErrorMessage(null);
    if (!fullname.trim() || !email.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please provide both full name and email.',
      });
      return;
    }

    setIsLoading(true);
    try {
      await emergencyContactsApi.invitePartner({
        fullname,
        email,
        message,
      });

      Toast.show({
        type: 'success',
        text1: 'Invite Sent!',
        text2: `An invitation has been sent to ${fullname}.`,
      });

      await refreshContacts();
      onClose();
      // Reset form
      setFullname('');
      setEmail('');
    } catch (error: any) {
      const rawMessage = error.response?.data?.message || error.message || 'Failed to send invite.';
      const cleanMessage = rawMessage.replace(/^\[?AxiosError:\s*/, '').replace(/\]$/, '');
      setErrorMessage(cleanMessage);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    setErrorMessage(null);
  }, [email]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <ModalKeyboardAvoid
        className="flex-1 justify-end"
        style={{ backgroundColor: colors.overlay }}
      >
        <TouchableOpacity className="absolute top-0 bottom-0 left-0 right-0" onPress={onClose} activeOpacity={1} />

        <View className="w-full rounded-t-[32px] px-6 pt-4 max-h-[90%] shadow-lg" style={{ backgroundColor: colors.bg }}>

          {/* Handle & Close Button */}
          <View className="items-center mb-2">
            <View className="w-12 h-1.5 rounded-full" style={{ backgroundColor: isDark ? '#3A3D44' : '#D1D5DB' }} />
          </View>
          <TouchableOpacity className="absolute top-6 right-6 z-10 rounded-full w-8 h-8 items-center justify-center" style={{ backgroundColor: colors.surface }} onPress={onClose}>
            <Feather name="x" size={18} color={colors.text} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Graphic */}
            <View className="items-center mt-6 mb-4">
              <Image
                source={{ uri: 'https://ik.imagekit.io/eqh0cjetc/amazon-image/support-emjoi.svg' }}
                style={{ width: 120, height: 120 }}
                contentFit="contain"
              />
            </View>

            {/* Text */}
            <CalText className="text-center text-[24px] mb-3">Always Stay Connected!</CalText>
            <HelixaText className="text-center text-[15px] mb-8 leading-6 px-4" style={{ color: colors.textSecondary }}>
              Invite a partner or loved one to stay connected, receive emergency updates, <HelixaText className="text-[#D62D88]">and support your journey with Loni.</HelixaText>
            </HelixaText>

            {/* Form Fields */}
            <View className="mb-4">
              <HelixaText className="text-[15px] font-bold mb-2">Partner Full Name</HelixaText>
              <View className="rounded-[16px] px-4 py-4" style={{ backgroundColor: colors.surface }}>
                <TextInput
                  value={fullname}
                  onChangeText={setFullname}
                  placeholder="Enter support partner full name"
                  placeholderTextColor={colors.textMuted}
                  className="font-helixa text-[15px]"
                  style={{ color: colors.text }}
                />
              </View>
            </View>

            <View className="mb-4">
              <HelixaText className="text-[15px] font-bold mb-2">Partner Email</HelixaText>
              <View className="rounded-[16px] px-4 py-4" style={{ backgroundColor: colors.surface }}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter support partner email"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="font-helixa text-[15px]"
                  style={{ color: colors.text }}
                />
              </View>
            </View>

            <View className="mb-8">
              <View className="rounded-[16px] px-4 py-4 min-h-[120px]" style={{ backgroundColor: colors.surface }}>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  className="font-helixa text-[15px] leading-6"
                  style={{ textAlignVertical: 'top', color: colors.textSecondary }}
                />
              </View>
            </View>

            {/* Error Message */}
            {errorMessage && (
              <View className="mb-4 bg-[#FF383C1F] border border-[#FF383C7A] rounded-[12px] p-3">
                <HelixaText className="text-[14px] text-center" style={{ color: isDark ? '#FCA5A5' : '#9A1316' }}>
                  {errorMessage}
                </HelixaText>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              className="w-full h-[56px] mb-6 rounded-full justify-center items-center"
              style={{ backgroundColor: isLoading ? '#9CA3AF' : isDark ? '#FFFFFF' : '#000000' }}
              onPress={handleSendInvite}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <HelixaText className="text-[16px] font-bold" style={{ color: isDark ? '#000' : '#fff' }}>
                  Send Invite
                </HelixaText>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </ModalKeyboardAvoid>
    </Modal>
  );
};
