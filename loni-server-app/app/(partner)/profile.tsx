import React from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Avatar } from '../../components/Avatar';
import { SupportIcon } from '../../components/icons/SupportIcon';
import { useAuth, useUploadProfilePicture } from '../../hooks/useAuth';
import { usePartnerConnection } from '../../hooks/usePartnerConnection';
import { relativeTime } from '../../lib/relativeTime';

function ShareRow({ title, description, shared }: { title: string; description: string; shared: boolean }) {
  return (
    <View style={styles.shareRow}>
      <View style={styles.shareRowText}>
        <View style={styles.shareRowTitleLine}>
          <HelixaText style={styles.shareRowTitle} weight="bold">{title}</HelixaText>
          <View style={styles.herChoiceBadge}>
            <Feather name="lock" size={11} color="#6B6B6B" />
            <HelixaText style={styles.herChoiceText} weight="bold">Her choice</HelixaText>
          </View>
        </View>
        <HelixaText style={styles.shareRowDescription}>{description}</HelixaText>
      </View>
      <View style={[styles.statusBadge, shared ? styles.statusBadgeOn : styles.statusBadgeOff]}>
        {shared && <Feather name="check" size={13} color="#15B300" />}
        <HelixaText style={[styles.statusBadgeText, shared ? styles.statusBadgeTextOn : styles.statusBadgeTextOff]} weight="black">
          {shared ? 'ON' : 'OFF'}
        </HelixaText>
      </View>
    </View>
  );
}

export default function PartnerProfile() {
  const { user, refreshUser } = useAuth();
  const { data: connection } = usePartnerConnection();
  const uploadMutation = useUploadProfilePicture();

  const inviterName = connection?.inviter_name ?? 'her';
  const connected = connection?.status === 'connected';

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const formData = new FormData() as any;
      formData.append('image', {
        uri: asset.uri,
        name: asset.fileName || 'profile.jpg',
        type: asset.mimeType || 'image/jpeg',
      });

      uploadMutation.mutate(formData, {
        onSuccess: () => {
          Toast.show({ type: 'success', text1: 'Profile picture updated' });
          refreshUser();
        },
        onError: () => {
          Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to upload profile picture.' });
        },
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Could not open your photo library.' });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <CalText style={styles.heading}>Your account</CalText>

        <View style={styles.avatarWrap}>
          <Avatar uri={user?.profilePicture || null} name={user?.name || 'You'} style={styles.avatar} />
          <Pressable style={styles.cameraButton} onPress={handlePickImage}>
            <Feather name="camera" size={14} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.nameRow}>
          <HelixaText weight="black" style={styles.name}>{user?.name || 'Partner'}</HelixaText>
          <Pressable style={styles.supportButton} onPress={() => router.push('/partner/support' as any)}>
            <SupportIcon size={18} color="#FFFFFF" />
            <HelixaText style={styles.supportText} weight="black">Support</HelixaText>
          </Pressable>
        </View>

        <View style={styles.section}>
          <HelixaText style={styles.sectionLabel} weight="bold">Partner account</HelixaText>
          <View style={styles.infoRow}>
            <HelixaText style={styles.infoLabel}>Email</HelixaText>
            <HelixaText weight="black" style={styles.infoValue}>{user?.email || '—'}</HelixaText>
          </View>
          <View style={styles.infoRow}>
            <HelixaText style={styles.infoLabel}>Role</HelixaText>
            <View style={styles.roleBadge}>
              <HelixaText style={styles.roleBadgeText} weight="black">PARTNER</HelixaText>
            </View>
          </View>
          <View style={styles.infoRow}>
            <HelixaText style={styles.infoLabel}>Email verified</HelixaText>
            <View style={[styles.statusBadge, user?.isEmailVerified ? styles.statusBadgeOn : styles.statusBadgeOff]}>
              {user?.isEmailVerified && <Feather name="check" size={13} color="#15B300" />}
              <HelixaText style={[styles.statusBadgeText, user?.isEmailVerified ? styles.statusBadgeTextOn : styles.statusBadgeTextOff]} weight="black">
                {user?.isEmailVerified ? 'Verified' : 'Unverified'}
              </HelixaText>
            </View>
          </View>
        </View>

        {connection && (
          <View style={styles.section}>
            <HelixaText style={styles.sectionLabel} weight="bold">Connection with {inviterName}</HelixaText>
            <View style={styles.infoRow}>
              <HelixaText style={styles.infoLabel}>Status</HelixaText>
              <View style={[styles.statusBadge, connected ? styles.statusBadgeOn : styles.statusBadgeOff]}>
                <Feather name="shield" size={13} color={connected ? '#15B300' : '#6B6B6B'} />
                <HelixaText style={[styles.statusBadgeText, connected ? styles.statusBadgeTextOn : styles.statusBadgeTextOff]} weight="black">
                  {connected ? 'Connected' : 'Pending'}
                </HelixaText>
              </View>
            </View>
            {!!connection.connected_at && (
              <View style={styles.infoRow}>
                <HelixaText style={styles.infoLabel}>Connected since</HelixaText>
                <HelixaText weight="black" style={styles.infoValue}>{relativeTime(connection.connected_at)}</HelixaText>
              </View>
            )}

            <View style={styles.divider} />

            <HelixaText style={styles.shareHeading} weight="bold">What she shares with you</HelixaText>
            <View style={styles.shareRows}>
              <ShareRow title="Location" description="See her shared location when available." shared={connection.location} />
              <ShareRow title="Updates" description="Receive the pregnancy updates she's chosen to share." shared={connection.updates} />
              <ShareRow title="Emergency" description="Receive notifications when she triggers an emergency alert." shared={connection.emergency} />
            </View>

            <View style={styles.divider} />

            <Pressable style={styles.settingsRow} onPress={() => router.push('/partner/settings' as any)}>
              <View style={styles.settingsRowLeft}>
                <Feather name="settings" size={20} color="#000000" />
                <HelixaText style={styles.settingsRowText} weight="bold">Settings</HelixaText>
              </View>
              <Feather name="chevron-right" size={20} color="#000000" />
            </Pressable>

            <View style={styles.warningBox}>
              <Feather name="alert-circle" size={13} color="#FA3532" style={styles.warningIcon} />
              <View style={styles.warningTextBlock}>
                <HelixaText style={styles.warningTitle} weight="black">These settings are hers</HelixaText>
                <HelixaText style={styles.warningBody}>
                  Sharing permissions are managed only in {inviterName}'s app. You can't turn them on or off here.
                </HelixaText>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 21, paddingTop: 8, paddingBottom: 140 },
  heading: { fontSize: 20, color: '#000000', textAlign: 'center', marginBottom: 32 },
  avatarWrap: { alignSelf: 'center', marginBottom: 24 },
  avatar: { width: 138, height: 138, borderRadius: 69 },
  cameraButton: {
    position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#D62D88', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 },
  name: { fontSize: 20, color: '#000000' },
  supportButton: {
    flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#000000',
    borderRadius: 83, paddingHorizontal: 23, paddingVertical: 12,
  },
  supportText: { fontSize: 13, color: '#FFFFFF' },
  section: { marginBottom: 36 },
  sectionLabel: { fontSize: 16, color: '#000000', marginBottom: 24 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  infoLabel: { fontSize: 14, color: '#000000' },
  infoValue: { fontSize: 15, color: '#000000' },
  roleBadge: { backgroundColor: 'rgba(250,53,50,0.09)', borderRadius: 62, paddingHorizontal: 18, paddingVertical: 7 },
  roleBadgeText: { fontSize: 13, color: '#FA3532' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 62,
    paddingHorizontal: 15, paddingVertical: 7,
  },
  statusBadgeOn: { backgroundColor: 'rgba(21,179,0,0.09)' },
  statusBadgeOff: { backgroundColor: 'rgba(107,107,107,0.09)' },
  statusBadgeText: { fontSize: 13 },
  statusBadgeTextOn: { color: '#15B300' },
  statusBadgeTextOff: { color: '#6B6B6B' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginVertical: 18 },
  shareHeading: { fontSize: 14, color: '#000000', marginBottom: 18 },
  shareRows: { gap: 24 },
  shareRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  shareRowText: { flex: 1, gap: 12 },
  shareRowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  shareRowTitle: { fontSize: 14, color: '#000000' },
  herChoiceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(107,107,107,0.09)',
    borderRadius: 62, paddingHorizontal: 8, paddingVertical: 7,
  },
  herChoiceText: { fontSize: 12, color: '#6B6B6B' },
  shareRowDescription: { fontSize: 14, color: '#000000', lineHeight: 20 },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9, marginBottom: 18,
  },
  settingsRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  settingsRowText: { fontSize: 15, color: '#000000' },
  warningBox: {
    flexDirection: 'row', gap: 7, backgroundColor: 'rgba(248,199,199,0.36)',
    borderRadius: 18, paddingHorizontal: 19, paddingVertical: 18,
  },
  warningIcon: { marginTop: 4 },
  warningTextBlock: { flex: 1, gap: 3 },
  warningTitle: { fontSize: 14, color: '#FA3532' },
  warningBody: { fontSize: 14, color: '#FA3532', lineHeight: 20 },
});
