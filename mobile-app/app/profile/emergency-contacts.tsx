import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, Dimensions, RefreshControl } from 'react-native';
import { WebView } from 'react-native-webview';
import { Reveal, RevealList } from '../../components/motion';

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
import Toast from 'react-native-toast-message';

import { CustomSwitch } from '../../components/CustomSwitch';
import { ActionModal } from '../../components/ActionModal';
import { useTheme } from '../../context/ThemeContext';

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { contacts, isLoading, removeContact, refreshContacts, updateContactPermissions } = useEmergencyContacts();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshContacts();
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshContacts]);

  const handleRemoveContact = async () => {
    if (removeIndex === null) return;
    try {
      setIsDeleting(true);
      await removeContact(removeIndex);
      setRemoveIndex(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Temporary local state for toggles until backend update endpoints are ready
  const [localToggles, setLocalToggles] = useState<Record<number, { location: boolean, updates: boolean, emergency: boolean }>>({});

  const getToggles = (id: number, contact: any) => {
    return localToggles[id] || { location: contact.location, updates: contact.updates, emergency: contact.emergency };
  };

  const updateToggle = async (id: number, key: 'location' | 'updates' | 'emergency', value: boolean) => {
    // Optimistic update
    setLocalToggles(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || contacts.find(c => c.id === id)),
        [key]: value
      }
    }));

    try {
      await updateContactPermissions(id, { [key]: value });
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Partner ${key} permission updated.`,
        position: 'bottom',
        bottomOffset: 100,
      });
    } catch (error: any) {
      // Revert on failure
      setLocalToggles(prev => ({
        ...prev,
        [id]: {
          ...(prev[id] || contacts.find(c => c.id === id)),
          [key]: !value
        }
      }));
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to update permission.',
        position: 'bottom',
        bottomOffset: 100,
      });
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      {/* Header */}
      <Reveal index={0}>
      <View className="flex-row items-center px-5 py-4 mt-4">
        <TouchableOpacity
          className="w-12 h-12 rounded-full border justify-center items-center"
          style={{ borderColor: colors.border }}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <CalText className="flex-1 text-center text-[22px] mr-12">
          Emergency Contacts
        </CalText>
      </View>
      </Reveal>

      <ScrollView 
        className="flex-1 px-5 mt-5" 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#D62D88']}
            tintColor="#D62D88"
          />
        }
      >
        <Reveal index={1}>
          <View className="mb-4">
            <SupportPartnersCard onPress={() => setIsModalVisible(true)} />
          </View>
        </Reveal>

        <Reveal index={2}>
          <HelixaText className="text-[18px] mb-4">
            Support Partners
          </HelixaText>
        </Reveal>

        {isLoading ? (
          <View className="py-10 mt-20 items-center">
            <View style={{ width: 100, height: 100, overflow: 'hidden' }}>
              <WebView 
                originWhitelist={['*']}
                source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" /></head><body style="margin:0;padding:0;background-color:transparent;display:flex;justify-content:center;align-items:center;"><svg fill="none" height="100%" width="100%" viewBox="0 0 300 300" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="i0" gradientUnits="userSpaceOnUse" spreadMethod="pad" x2="30.5" y2="30.5" x1="-29.5" y1="-30"><stop offset="0%" stop-color="#f684bb" /><stop offset="56%" stop-color="#bb4478" /><stop offset="100%" stop-color="#7d3b57" /></linearGradient><linearGradient id="i1" gradientUnits="userSpaceOnUse" spreadMethod="pad" x2="31.5" y2="34" x1="-30.5" y1="-30.5"><stop offset="0%" stop-color="#c8195f" /><stop offset="56%" stop-color="#b91d61" /><stop offset="100%" stop-color="#b91d61" /></linearGradient><linearGradient id="i2" gradientUnits="userSpaceOnUse" spreadMethod="pad" x2="31" y2="31" x1="-29" y1="-29.5"><stop offset="0%" stop-color="#a21251" /><stop offset="56%" stop-color="#803c5a" /><stop offset="100%" stop-color="#6e113a" /></linearGradient><linearGradient id="i3" gradientUnits="userSpaceOnUse" spreadMethod="pad" x2="30.5" y2="30.5" x1="-30" y1="-29.5"><stop offset="0%" stop-color="#fac337" /><stop offset="56%" stop-color="#feb806" /><stop offset="100%" stop-color="#ff0571" /></linearGradient></defs><g id="i4"><g transform="translate(150,150)"><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 360; 360; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(0.11,0.11) translate(0,0)"><g id="i5"><g transform="translate(-509.091,509.091)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="-509.091 509.091; 0 0; 0 0; -509.091 509.091; -509.091 509.091" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0 0 1 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 720; 0; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(9.091,9.091)"><animateTransform repeatCount="indefinite" type="scale" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="9.091 9.091; 9.091 9.091; 8.551 8.551; 8.551 8.551; 9.091 9.091; 9.091 9.091" keyTimes="0; 0.39; 0.41; 0.49; 0.51; 1" keySplines="0 0 1 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="translate(-13.11,8.232)"><g id="i6" transform="matrix(1,0,0,1,13.11,-8.232)"><ellipse ry="30" rx="30" cy="0" cx="0" stroke-width="0" stroke="#f4e0e8" fill="url(#i0)" /></g></g></g></g></g></g></g></g></g></g><g id="i4"><g transform="translate(150,150)"><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 360; 360; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(0.11,0.11) translate(0,0)"><g id="i7"><g transform="translate(509.091,-509.091)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="509.091 -509.091; 0 0; 0 0; 509.091 -509.091; 509.091 -509.091" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0 0 1 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 720; 0; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(9.091,9.091)"><animateTransform repeatCount="indefinite" type="scale" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="9.091 9.091; 9.091 9.091; 8.551 8.551; 8.551 8.551; 9.091 9.091; 9.091 9.091" keyTimes="0; 0.39; 0.41; 0.49; 0.51; 1" keySplines="0 0 1 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="translate(-13.11,8.232)"><g id="i6" transform="matrix(1,0,0,1,13.11,-8.232)"><ellipse ry="30" rx="30" cy="0" cx="0" stroke-width="0" stroke="#f4e0e8" fill="url(#i1)" /></g></g></g></g></g></g></g></g></g></g><g id="i4"><g transform="translate(150,150)"><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 360; 360; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(0.11,0.11) translate(0,0)"><g id="i8"><g transform="translate(509.091,509.091)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="509.091 509.091; 0 0; 0 0; 509.091 509.091; 509.091 509.091" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0 0 1 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 720; 0; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(9.091,9.091)"><animateTransform repeatCount="indefinite" type="scale" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="9.091 9.091; 9.091 9.091; 8.551 8.551; 8.551 8.551; 9.091 9.091; 9.091 9.091" keyTimes="0; 0.39; 0.41; 0.49; 0.51; 1" keySplines="0 0 1 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="translate(-13.11,8.232)"><g id="i6" transform="matrix(1,0,0,1,13.11,-8.232)"><ellipse ry="30" rx="30" cy="0" cx="0" stroke-width="0" stroke="#f4e0e8" fill="url(#i2)" /></g></g></g></g></g></g></g></g></g></g><g id="i4"><g transform="translate(150,150)"><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 360; 360; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(0.11,0.11) translate(0,0)"><g id="i9"><g transform="translate(-509.091,-509.091)"><animateTransform repeatCount="indefinite" type="translate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="-509.091 -509.091; 0 0; 0 0; -509.091 -509.091; -509.091 -509.091" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0 0 1 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 720; 0; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(9.091,9.091) translate(-13.11,8.232)"><g id="i6" transform="matrix(1,0,0,1,13.11,-8.232)"><ellipse ry="30" rx="30" cy="0" cx="0" stroke-width="0" stroke="#f4e0e8" fill="url(#i3)" /></g></g></g></g></g></g></g></g></g><g opacity="0" id="i4"><g transform="translate(150,150)"><g transform="rotate(0)"><animateTransform repeatCount="indefinite" type="rotate" attributeName="transform" dur="3.333s" begin="0s" calcMode="spline" values="0; 360; 360; 720; 720" keyTimes="0; 0.4; 0.5; 0.89; 1" keySplines="0.333 0 0.667 1; 0.333 0 0.667 1; 0.333 0 0.667 1; 0 0 1 1" fill="freeze" /><g transform="scale(0.11,0.11) translate(0,0)" /></g></g></g></svg></body></html>` }} 
                style={{ width: 100, height: 100, backgroundColor: 'transparent' }} 
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                bounces={false}
              />
            </View>
          </View>
        ) : contacts.length === 0 ? (
          <Reveal index={3}>
          <View className="py-16 items-center justify-center mt-4">
            <View className="w-20 h-20 rounded-full items-center justify-center mb-4" style={{ backgroundColor: colors.primarySoft }}>
              <Feather name="users" size={32} color="#D62D88" />
            </View>
            <CalText className="text-[20px] mb-2">No Support Partners</CalText>
            <HelixaText className="text-center text-gray-500 text-[15px] px-8 leading-6">
              You haven't added anyone yet. Add a partner so they can receive updates and help in an emergency.
            </HelixaText>
          </View>
          </Reveal>
        ) : (
          contacts.map((contact, i) => {
            const toggles = getToggles(contact.id, contact);
            const isPending = contact.status === 'pending';

            return (
              <RevealList key={contact.id} index={i + 3}>
              <View
                className="w-full rounded-[24px] p-5 mb-4 overflow-hidden"
                style={isPending ? { backgroundColor: colors.surface } : undefined}
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
                  <View className="w-16 h-16 rounded-full overflow-hidden mr-3 border-2 shadow-sm" style={{ backgroundColor: colors.surface, borderColor: colors.bg }}>
                    {contact.profile_picture ? (
                      <Image source={{ uri: contact.profile_picture }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <View className="w-full h-full justify-center items-center" style={{ backgroundColor: colors.divider }}>
                        <Feather name="user" size={24} color="#9CA3AF" />
                      </View>
                    )}
                  </View>

                  <View className="flex-1 pt-1">
                    <CalText className="text-[18px]" style={isPending ? undefined : { color: '#111827' }}>{contact.name}</CalText>
                    <HelixaText className="text-[14px]" style={{ color: isPending ? colors.textSecondary : '#4B5563' }}>{contact.email}</HelixaText>

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
                  <View className="mt-5 bg-[#FF383C1F] border border-[#FF383C7A] rounded-[12px] p-4 relative z-10">
                    <HelixaText className="text-[14px]" style={{ color: isDark ? '#FCA5A5' : '#9A1316' }}>
                      Waiting for them to accept your invite.
                    </HelixaText>
                  </View>
                ) : (
                  <View className="mt-5 relative z-10">
                    <View className="rounded-[20px] p-4 px-5 flex-row items-center justify-between mb-3 shadow-sm shadow-pink-100/50" style={{ backgroundColor: '#FFFFFF' }}>
                      <View className="flex-row items-center gap-3">
                        <Feather name="map-pin" size={20} color="#374151" />
                        <HelixaText className="text-[16px]" style={{ color: '#111827' }}>Location</HelixaText>
                      </View>
                      <CustomSwitch 
                        value={contact.location ?? false} 
                        onValueChange={(v) => updateToggle(contact.id, 'location', v)}
                        activeColor="#000000"
                      />
                    </View>

                    <View className="rounded-[20px] p-4 px-5 flex-row items-center justify-between mb-3 shadow-sm shadow-pink-100/50" style={{ backgroundColor: '#FFFFFF' }}>
                      <View className="flex-row items-center gap-3">
                        <Feather name="bell" size={20} color="#374151" />
                        <HelixaText className="text-[16px]" style={{ color: '#111827' }}>Updates</HelixaText>
                      </View>
                      <CustomSwitch 
                        value={contact.updates ?? false} 
                        onValueChange={(v) => updateToggle(contact.id, 'updates', v)}
                        activeColor="#000000"
                      />
                    </View>

                    <View className="rounded-[20px] p-4 px-5 flex-row items-center justify-between mb-3 shadow-sm shadow-pink-100/50" style={{ backgroundColor: '#FFFFFF' }}>
                      <View className="flex-row items-center gap-3">
                        <Feather name="clock" size={20} color="#374151" />
                        <HelixaText className="text-[16px]" style={{ color: '#111827' }}>Emergency</HelixaText>
                      </View>
                      <CustomSwitch 
                        value={contact.emergency ?? false} 
                        onValueChange={(v) => updateToggle(contact.id, 'emergency', v)}
                        activeColor="#000000"
                      />
                    </View>
                  </View>
                )}
              </View>
              </RevealList>
            );
          })
        )}
        <View className="h-20" />
      </ScrollView>

      <InvitePartnerModal visible={isModalVisible} onClose={() => setIsModalVisible(false)} />

      <ActionModal
        visible={removeIndex !== null}
        onClose={() => !isDeleting && setRemoveIndex(null)}
        title="Remove Contact?"
        description="They will no longer be able to see your updates or receive emergency alerts."
        icon={<Image source={require('../../assets/images/iconn.png')} style={{ width: 120, height: 120 }} contentFit="contain" />}
        primaryButtonText="Remove Contact"
        onPrimaryPress={handleRemoveContact}
        isPrimaryLoading={isDeleting}
        secondaryButtonText="Keep Contact"
        onSecondaryPress={() => setRemoveIndex(null)}
      />

    </SafeAreaView>
  );
}
