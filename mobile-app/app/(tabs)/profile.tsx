import React from 'react';
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
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const { user, logoutUser } = useAuth();
  const uploadMutation = useUploadProfilePicture();
  const router = useRouter();

  const firstName = user?.name ? user.name.split(' ')[0] : 'User';
  let statusText = '';
  if (user?.status === 'pregnant') {
    statusText = user.trimester ? `${user.trimester} Trimester` : 'Pregnant';
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
          source={require('../../assets/images/profile-bg.svg')}
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

        <View className='bg-white flex flex-col'>
          <SupportPartnersCard />

          <ProfileSection>
            <ProfileMenuItem icon="heart" title="Pregnancy Status" onPress={() => router.push('/pregnancy-status')} />
            <ProfileMenuItem icon="users" title="Emergency Contacts" onPress={() => { }} isLast />
          </ProfileSection>

          <ProfileSection>
            <ProfileMenuItem icon="bell" title="Notification Settings" onPress={() => router.push('/notification-settings')} />
            <ProfileMenuItem icon="x-circle" title="Cancel Subscription" onPress={() => { }} />
            <ProfileMenuItem icon="shield" title="Privacy & Permissions" onPress={() => { }} isLast />
          </ProfileSection>

          <ProfileSection backgroundColor="#FEE2E2">
            <ProfileMenuItem icon="log-out" title="Sign Out" color="#EF4444" onPress={handleLogout} isLast />
          </ProfileSection>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
