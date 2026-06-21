import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, Switch, Pressable, Animated, Modal, Dimensions, Image as RNImage, StyleSheet } from 'react-native';

const { width } = Dimensions.get('window');
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

const CustomSwitch = ({ value, onValueChange, disabled }: { value: boolean, onValueChange: (v: boolean) => void, disabled?: boolean }) => {
  const translateX = useRef(new Animated.Value(value ? 14 : 0)).current;
  const animatedTrackColor = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: value ? 14 : 0, // width 38, padding 2, thumb 20 -> 38 - 4 - 20 = 14
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(animatedTrackColor, {
        toValue: value ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      })
    ]).start();
  }, [value]);

  const interpolatedTrackColor = animatedTrackColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E7EB', '#000000']
  });

  const trackColor = disabled ? '#9CA3AF' : interpolatedTrackColor;
  const thumbColor = disabled ? '#D1D5DB' : '#FFFFFF';

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
    >
      <Animated.View
        style={{
          width: 38,
          height: 24,
          borderRadius: 15,
          backgroundColor: trackColor,
          justifyContent: 'center',
          paddingHorizontal: 2,
        }}
      >
        <Animated.View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: thumbColor,
            transform: [{ translateX }],
            shadowColor: disabled ? 'transparent' : '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: disabled ? 0 : 0.2,
            shadowRadius: 2,
            elevation: disabled ? 0 : 2,
          }}
        />
      </Animated.View>
    </Pressable>
  );
};

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const { contacts, isLoading } = useEmergencyContacts();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);

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
                  <View className="absolute top-0 left-0 right-0 bottom-0">
                    <Image 
                      source={require('../../assets/images/connected.png')} 
                      style={{ width: '100%', height: '100%', position: 'absolute' }} 
                      contentFit="cover" 
                    />
                  </View>
                )}

                <View className="flex-row items-start relative z-10">
                  <View className="w-16 h-16 rounded-full bg-[#F2F2F2] overflow-hidden mr-3 border-2 border-white shadow-sm">
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
                    <HelixaText className="text-[14px] text-gray-500">{contact.email}</HelixaText>

                    <View className="flex-row mt-3">
                      <View className={`px-3 py-1 rounded-full flex-row items-center ${isPending ? 'bg-[#FFE8DC]' : 'bg-[#DCFCE7]'}`}>
                        <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isPending ? 'bg-[#EA580C]' : 'bg-[#16A34A]'}`} />
                        <HelixaText className={`text-[12px] ${isPending ? 'text-[#EA580C]' : 'text-[#16A34A]'}`}>
                          {isPending ? 'Pending' : 'Connected'}
                        </HelixaText>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity 
                    className="w-10 h-10 rounded-[12px] bg-[#B91C1C] justify-center items-center ml-2"
                    onPress={() => setRemoveIndex(contact.id)}
                  >
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
                  <View className="mt-5 relative z-10">
                    <View className="bg-white rounded-[20px] p-4 px-5 flex-row items-center justify-between mb-3 shadow-sm shadow-pink-100/50">
                      <View className="flex-row items-center gap-3">
                        <Feather name="map-pin" size={20} color="#374151" />
                        <HelixaText className="text-[16px] text-gray-900">Location</HelixaText>
                      </View>
                      <CustomSwitch
                        value={toggles.location}
                        onValueChange={(val) => updateToggle(contact.id, 'location', val)}
                      />
                    </View>

                    <View className="bg-white rounded-[20px] p-4 px-5 flex-row items-center justify-between mb-3 shadow-sm shadow-pink-100/50">
                      <View className="flex-row items-center gap-3">
                        <Feather name="bell" size={20} color="#374151" />
                        <HelixaText className="text-[16px] text-gray-900">Updates</HelixaText>
                      </View>
                      <CustomSwitch
                        value={toggles.updates}
                        onValueChange={(val) => updateToggle(contact.id, 'updates', val)}
                      />
                    </View>

                    <View className="bg-white rounded-[20px] p-4 px-5 flex-row items-center justify-between mb-3 shadow-sm shadow-pink-100/50">
                      <View className="flex-row items-center gap-3">
                        <Feather name="clock" size={20} color="#374151" />
                        <HelixaText className="text-[16px] text-gray-900">Emergency</HelixaText>
                      </View>
                      <CustomSwitch
                        value={toggles.emergency}
                        onValueChange={(val) => updateToggle(contact.id, 'emergency', val)}
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

      <Modal
        visible={removeIndex !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setRemoveIndex(null)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable 
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} 
            onPress={() => setRemoveIndex(null)} 
          />
          <View style={{ width: '100%', backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 0, paddingBottom: 40, alignItems: 'center', overflow: 'hidden' }}>
            
            <RNImage 
              source={require('../../assets/images/confirm.png')} 
              style={{ position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: 480 }} 
              resizeMode="stretch" 
            />

            <View style={{ width: 56, height: 6, backgroundColor: '#D1D5DB', borderRadius: 3, marginTop: 10, marginBottom: 40 }} />

            <Image 
              source={require('../../assets/images/iconn.png')} 
              style={{ width: 120, height: 120, marginBottom: 24 }} 
              contentFit="contain" 
            />

            <HelixaText style={{ fontSize: 24, color: '#000', marginBottom: 12, paddingHorizontal: 24, textAlign: 'center' }} weight="bold">
              Remove Contact?
            </HelixaText>

            <HelixaText style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', paddingHorizontal: 40, marginBottom: 32, lineHeight: 22 }}>
              They will no longer be able to see your updates or receive emergency alerts.
            </HelixaText>

            <View style={{ width: '100%', paddingHorizontal: 24, gap: 12 }}>
              <TouchableOpacity 
                style={{ width: '100%', backgroundColor: '#000', paddingVertical: 18, borderRadius: 30, alignItems: 'center' }}
                onPress={() => {
                  // In the future, call context removeContact API here
                  setRemoveIndex(null);
                }}
              >
                <HelixaText style={{ color: '#FFF', fontSize: 16 }} weight="bold">Remove Contact</HelixaText>
              </TouchableOpacity>

              <TouchableOpacity 
                style={{ width: '100%', backgroundColor: '#F3F4F6', paddingVertical: 18, borderRadius: 30, alignItems: 'center' }}
                onPress={() => setRemoveIndex(null)}
              >
                <HelixaText style={{ color: '#4B5563', fontSize: 16 }} weight="bold">Keep Contact</HelixaText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
