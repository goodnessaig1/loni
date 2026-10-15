import React, { useMemo, useState } from 'react';
import { ScrollView, View, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useAuth, useUploadProfilePicture } from '../../hooks/useAuth';
import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { SupportPartnersCard } from '../../components/profile/SupportPartnersCard';
import { ProfileSection } from '../../components/profile/ProfileSection';
import { ProfileMenuItem } from '../../components/profile/ProfileMenuItem';
import { InvitePartnerModal } from '../../components/profile/InvitePartnerModal';
import { ActionModal } from '../../components/ActionModal';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HelixaText } from '../../components/HelixaText';
import { useTheme } from '../../context/ThemeContext';
import type { Palette } from '../../lib/theme';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, logoutUser } = useAuth();
  const { colors, isDark, preference } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const themeLabel = preference === 'system' ? 'System' : preference === 'dark' ? 'Dark' : 'Light';
  const uploadMutation = useUploadProfilePicture();
  const router = useRouter();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCancelSubVisible, setIsCancelSubVisible] = useState(false);
  const [cancelStep, setCancelStep] = useState<1 | 2>(1);
  const [isCanceling, setIsCanceling] = useState(false);

  const firstName = user?.name ? user.name.split(' ')[0] : 'User';
  let statusText = '';
  if (user?.status === 'pregnant') {
    statusText = user.trimester ? user.trimester : 'Pregnant';
  } else if (user?.status === 'newMom') {
    statusText = user.babyAge ? `Baby is ${user.babyAge} old` : 'New Mom';
  }

  const handleLogout = async () => {
    await logoutUser();
    router.replace('/(auth)/login');
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        const formData = new FormData() as any;
        formData.append('image', {
          uri: asset.uri,
          name: asset.fileName || 'profile.jpg',
          type: asset.mimeType || 'image/jpeg'
        });

        uploadMutation.mutate(formData, {
          onSuccess: () => {
            Toast.show({
              type: 'success',
              text1: 'Success',
              text2: 'Profile picture updated successfully!',
            });
          },
          onError: () => {
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: 'Failed to upload profile picture.',
            });
          }
        });
      }
    } catch (error) {
      console.log('Error picking image:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to open image picker.',
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.bgContainer}>
        <Image
          source={isDark ? require('../../assets/images/profile-bg-dark.svg') : require('../../assets/images/profile-bg.svg')}
          style={styles.bgImage}
          contentFit="cover"
        />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <ProfileHeader
          firstName={firstName}
          trimester={statusText}
          profilePicture={user?.profilePicture}
          onPressAvatar={handlePickImage}
          isUploading={uploadMutation.isPending}
        />

        <View className='flex flex-col'>
          <SupportPartnersCard onPress={() => setIsModalVisible(true)} />

          <ProfileSection>
            <ProfileMenuItem icon="heart" title="Pregnancy Status" onPress={() => router.push('/pregnancy-status')} />
            <ProfileMenuItem icon="users" title="Emergency Contacts" onPress={() => router.push('/profile/emergency-contacts')} isLast />
          </ProfileSection>

          <ProfileSection>
            <ProfileMenuItem icon="moon" title={`${themeLabel} Theme`} onPress={() => router.push('/profile/theme')} />
            <ProfileMenuItem icon="bell" title="Notification Settings" onPress={() => router.push('/notification-settings')} />
            <ProfileMenuItem icon="x-circle" title="Cancel Subscription" onPress={() => { setCancelStep(1); setIsCancelSubVisible(true); }} />
            <ProfileMenuItem icon="shield" title="Privacy & Permissions" onPress={() => router.push('/profile/privacy-permissions')} isLast />
          </ProfileSection>

          <ProfileSection backgroundColor={colors.dangerSoft}>
            <ProfileMenuItem icon="log-out" title="Sign Out" color={colors.danger} onPress={handleLogout} isLast />
          </ProfileSection>
        </View>

      </ScrollView>

      <InvitePartnerModal visible={isModalVisible} onClose={() => setIsModalVisible(false)} />
      
      <ActionModal
        visible={isCancelSubVisible}
        onClose={() => setIsCancelSubVisible(false)}
        title={cancelStep === 1 ? "Cancel Subscription?" : "Before you go..."}
        description={cancelStep === 1 
          ? "Your premium access will continue until the end of your billing period. You can resubscribe anytime."
          : "Here is what you will miss without LoniPlus:"}
        primaryButtonText={cancelStep === 1 ? "Continue to Cancel" : "I Understand, Cancel"}
        onPrimaryPress={() => {
          if (cancelStep === 1) {
            setCancelStep(2);
          } else {
            setIsCancelSubVisible(false);
            setCancelStep(1);
            router.push('/profile/cancel-subscription');
          }
        }}
        isPrimaryLoading={isCanceling}
        secondaryButtonText="Keep Subscription"
        onSecondaryPress={() => { setIsCancelSubVisible(false); setCancelStep(1); }}
        icon={
          cancelStep === 1 ? (
             <Image 
                source={require('../../assets/images/iconn.png')} 
                style={{ width: 120, height: 120 }} 
                contentFit="contain" 
              />
          ) : (
             <View className="w-24 h-24 bg-[#D62D88] rounded-[32px] items-center justify-center shadow-md shadow-pink-200">
               <MaterialCommunityIcons name="robot-outline" size={56} color="#FFF" />
             </View>
          )
        }
      >
        {cancelStep === 2 && (
          <View className="w-full pl-2 pr-4">
            {[
              'Unlimited nurse calls',
              'Unlimited emergency rides',
              'Request your preferred nurse',
              'Faster ride dispatch',
              'Enhanced recovery plans'
            ].map((feature, idx) => (
              <View key={idx} className="flex-row items-center mb-4">
                <View className="w-5 h-5 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.divider }}>
                  <Feather name="check" size={12} color={colors.textSecondary} />
                </View>
                <HelixaText className="text-[15px]" style={{ color: colors.textSecondary }}>{feature}</HelixaText>
              </View>
            ))}
          </View>
        )}
      </ActionModal>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  bgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 120, // space for tab bar
    zIndex: 1,
  },
});
