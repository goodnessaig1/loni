import React, { useEffect, useState } from 'react';
import { View, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import { CalText } from '../CalText';
import { HelixaText } from '../HelixaText';
import { emergencyContactsApi } from '../../api/emergencyContacts';
import { useEmergencyContacts } from '../../context/EmergencyContactsContext';
import { ActivityIndicator } from 'react-native';

interface InvitePartnerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const InvitePartnerModal = ({ visible, onClose }: InvitePartnerModalProps) => {
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/50"
      >
        <TouchableOpacity className="absolute top-0 bottom-0 left-0 right-0" onPress={onClose} activeOpacity={1} />

        <View className="bg-white w-full rounded-t-[32px] px-6 pt-4 max-h-[90%] shadow-lg">

          {/* Handle & Close Button */}
          <View className="items-center mb-2">
            <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </View>
          <TouchableOpacity className="absolute top-6 right-6 z-10 bg-gray-100 rounded-full w-8 h-8 items-center justify-center" onPress={onClose}>
            <Feather name="x" size={18} color="#000" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
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
            <HelixaText className="text-center text-gray-500 text-[15px] mb-8 leading-6 px-4">
              Invite a partner or loved one to stay connected, receive emergency updates, <HelixaText className="text-[#D62D88]">and support your journey with Loni.</HelixaText>
            </HelixaText>

            {/* Form Fields */}
            <View className="mb-4">
              <HelixaText className="text-[15px] font-bold text-gray-900 mb-2">Partner Full Name</HelixaText>
              <View className="bg-[#F6F6F6] rounded-[16px] px-4 py-4">
                <TextInput
                  value={fullname}
                  onChangeText={setFullname}
                  placeholder="Enter support partner full name"
                  placeholderTextColor="#9CA3AF"
                  className="font-helixa text-[15px] text-gray-900"
                />
              </View>
            </View>

            <View className="mb-4">
              <HelixaText className="text-[15px] font-bold text-gray-900 mb-2">Partner Email</HelixaText>
              <View className="bg-[#F6F6F6] rounded-[16px] px-4 py-4">
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter support partner email"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="font-helixa text-[15px] text-gray-900"
                />
              </View>
            </View>

            <View className="mb-8">
              <View className="bg-[#F6F6F6] rounded-[16px] px-4 py-4 min-h-[120px]">
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  className="font-helixa text-[15px] text-gray-500 leading-6"
                  style={{ textAlignVertical: 'top' }}
                />
              </View>
            </View>

            {/* Error Message */}
            {errorMessage && (
              <View className="mb-4 bg-[#FF383C1F] border border-[#FF383C7A] rounded-[12px] p-3">
                <HelixaText className="text-[#9A1316] text-[14px] text-center">
                  {errorMessage}
                </HelixaText>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              className={`w-full h-[56px] mb-6 rounded-full justify-center items-center ${isLoading ? 'bg-gray-400' : 'bg-black'}`}
              onPress={handleSendInvite}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <HelixaText className="text-white text-[16px] font-bold">
                  Send Invite
                </HelixaText>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
