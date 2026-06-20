import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { HelixaText } from '../../components/HelixaText';
import { CalText } from '../../components/CalText';
import { SupportPartnersCard } from '../../components/profile/SupportPartnersCard';
import { InvitePartnerModal } from '../../components/profile/InvitePartnerModal';
import { useEmergencyContacts } from '../../context/EmergencyContactsContext';

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const { contacts, isLoading } = useEmergencyContacts();
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Temporary local state for toggles until backend update endpoints are ready
  const [localToggles, setLocalToggles] = useState<Record<number, { location: boolean, updates: boolean, emergency: boolean }>>({});

  const getToggles = (id: number, contact: any) => {
    return localToggles[id] || { location: contact.location, updates: contact.updates, emergency: contact.emergency };
  };

  const updateToggle = (id: number, key: 'location' | 'updates' | 'emergency', value: boolean) => {
    setLocalToggles(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || contacts.find(c => c.id === id)),
        [key]: value
      }
    }));
    // TODO: Add API call to update contact toggle on backend
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-4 mt-4">
        <TouchableOpacity
          className="w-12 h-12 rounded-full border border-gray-200 justify-center items-center"
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={24} color="#000" />
        </TouchableOpacity>
        <CalText className="flex-1 text-center text-[22px] mr-12">
          Emergency Contacts
        </CalText>
      </View>

      <ScrollView className="flex-1 px-5 mt-5" showsVerticalScrollIndicator={false}>
        <View className="mb-4">
          <SupportPartnersCard onPress={() => setIsModalVisible(true)} />
        </View>

        <HelixaText className="text-[18px] text-gray-900 mb-4">
          Support Partners
        </HelixaText>

        {isLoading ? (
          <View className="py-10 items-center">
            <HelixaText className="text-gray-500">Loading contacts...</HelixaText>
          </View>
        ) : contacts.length === 0 ? (
          <View className="py-16 items-center justify-center mt-4">
            <View className="w-20 h-20 rounded-full bg-[#FFF0F5] items-center justify-center mb-4">
              <Feather name="users" size={32} color="#D62D88" />
            </View>
            <CalText className="text-[20px] text-gray-900 mb-2">No Support Partners</CalText>
            <HelixaText className="text-center text-gray-500 text-[15px] px-8 leading-6">
              You haven't added anyone yet. Add a partner so they can receive updates and help in an emergency.
            </HelixaText>
          </View>
        ) : (
          contacts.map((contact) => {
            const toggles = getToggles(contact.id, contact);
            const isPending = contact.status === 'pending';

            return (
              <View
                key={contact.id}
                className={`w-full rounded-[24px] p-5 mb-4 overflow-hidden ${isPending ? 'bg-[#F4F4F4]' : ''}`}
              >
                {!isPending && (
                  <View className="absolute top-0 left-0 right-0 bottom-0 opacity-40">
                    <LinearGradient
                      colors={['#FFD1E3', '#FFFFFF', '#FFD1E3']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      className="w-full h-full"
                    />
                  </View>
                )}

                <View className="flex-row items-start relative z-10">
                  <View className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden mr-3">
                    {contact.profile_picture ? (
                      <Image source={{ uri: contact.profile_picture }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <View className="w-full h-full justify-center items-center bg-[#E5E7EB]">
                        <Feather name="user" size={24} color="#9CA3AF" />
                      </View>
                    )}
                  </View>

                  <View className="flex-1 pt-1">
                    <CalText className="text-[18px] text-gray-900">{contact.name}</CalText>
                    <HelixaText className="text-[14px] text-gray-500">{contact.phone}</HelixaText>

                    <View className="flex-row mt-3">
                      <View className={`px-3 py-1 rounded-full flex-row items-center ${isPending ? 'bg-[#FFE8DC]' : 'bg-[#DCFCE7]'}`}>
                        <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isPending ? 'bg-[#EA580C]' : 'bg-[#16A34A]'}`} />
                        <HelixaText className={`text-[12px] ${isPending ? 'text-[#EA580C]' : 'text-[#16A34A]'}`}>
                          {isPending ? 'Pending' : 'Connected'}
                        </HelixaText>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity className="w-10 h-10 rounded-[12px] bg-[#B91C1C] justify-center items-center ml-2">
                    <Feather name="trash-2" size={18} color="white" />
                  </TouchableOpacity>
                </View>

                {isPending ? (
                  <View className="mt-5 bg-[#FFE8E8] border border-[#FFCCCC] rounded-[12px] p-4 relative z-10">
                    <HelixaText className="text-[#B91C1C] text-[14px]">
                      Waiting for them to accept your invite.
                    </HelixaText>
                  </View>
                ) : (
                  <View className="mt-5 space-y-3 relative z-10">
                    <View className="bg-white rounded-[16px] p-4 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3">
                        <Feather name="map-pin" size={20} color="#374151" />
                        <HelixaText className="text-[16px] text-gray-900">Location</HelixaText>
                      </View>
                      <Switch
                        value={toggles.location}
                        onValueChange={(val) => updateToggle(contact.id, 'location', val)}
                        trackColor={{ false: '#E5E7EB', true: '#000000' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>

                    <View className="bg-white rounded-[16px] p-4 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3">
                        <Feather name="bell" size={20} color="#374151" />
                        <HelixaText className="text-[16px] text-gray-900">Updates</HelixaText>
                      </View>
                      <Switch
                        value={toggles.updates}
                        onValueChange={(val) => updateToggle(contact.id, 'updates', val)}
                        trackColor={{ false: '#E5E7EB', true: '#000000' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>

                    <View className="bg-white rounded-[16px] p-4 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3">
                        <Feather name="clock" size={20} color="#374151" />
                        <HelixaText className="text-[16px] text-gray-900">Emergency</HelixaText>
                      </View>
                      <Switch
                        value={toggles.emergency}
                        onValueChange={(val) => updateToggle(contact.id, 'emergency', val)}
                        trackColor={{ false: '#E5E7EB', true: '#000000' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View className="h-20" />
      </ScrollView>

      <InvitePartnerModal visible={isModalVisible} onClose={() => setIsModalVisible(false)} />
    </SafeAreaView>
  );
}
