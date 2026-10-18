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
import { CancelPrompt } from '../../components/subscription/CancelPrompt';
import { useSubscription } from '../../hooks/useSubscription';
import { shortDate } from '../../lib/format';
import { useRouter } from 'expo-router';
import { HelixaText } from '../../components/HelixaText';
import { useTheme } from '../../context/ThemeContext';
import type { Palette } from '../../lib/theme';
import { Reveal } from '../../components/motion';

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
  const { subscription, hasAccess } = useSubscription();

  const onCancelSubscription = () => {
    if (!hasAccess) return router.push('/subscribe');
    if (subscription?.state === 'cancelled') {
      return Toast.show({ type: 'info', text1: 'Already cancelled', text2: `Your access runs until ${shortDate(subscription.access_ends_at)}.` });
    }
    setIsCancelSubVisible(true);
  };

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

        <Reveal index={0}>
        <ProfileHeader
          firstName={firstName}
          trimester={statusText}
          profilePicture={user?.profilePicture}
          onPressAvatar={handlePickImage}
          isUploading={uploadMutation.isPending}
        />
        </Reveal>

        <View className='flex flex-col'>
          <Reveal index={1}>
          <SupportPartnersCard onPress={() => setIsModalVisible(true)} />
          </Reveal>

          <Reveal index={2}>
          <ProfileSection>
            <ProfileMenuItem icon="heart" title={user?.status === 'general' || user?.status === 'ttc' ? 'My Journey' : 'Pregnancy Status'} onPress={() => router.push('/pregnancy-status')} />
            <ProfileMenuItem icon="users" title="Emergency Contacts" onPress={() => router.push('/profile/emergency-contacts')} isLast />
          </ProfileSection>
          </Reveal>

          <Reveal index={3}>
          <ProfileSection>
            <ProfileMenuItem icon="moon" title={`${themeLabel} Theme`} onPress={() => router.push('/profile/theme')} />
            <ProfileMenuItem icon="bell" title="Notification Settings" onPress={() => router.push('/notification-settings')} />
            <ProfileMenuItem icon="x-circle" title="Cancel Subscription" onPress={onCancelSubscription} />
            <ProfileMenuItem icon="shield" title="Privacy & Permissions" onPress={() => router.push('/profile/privacy-permissions')} isLast />
          </ProfileSection>
          </Reveal>

          <Reveal index={4}>
          <ProfileSection backgroundColor={colors.dangerSoft}>
            <ProfileMenuItem icon="log-out" title="Sign Out" color={colors.danger} onPress={handleLogout} isLast />
          </ProfileSection>
          </Reveal>
        </View>

      </ScrollView>

      <InvitePartnerModal visible={isModalVisible} onClose={() => setIsModalVisible(false)} />
      
      <CancelPrompt
        visible={isCancelSubVisible}
        onClose={() => setIsCancelSubVisible(false)}
        onContinue={() => { setIsCancelSubVisible(false); router.push('/profile/cancel-subscription'); }}
      />
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
