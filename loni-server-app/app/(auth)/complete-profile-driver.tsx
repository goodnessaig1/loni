import React, { useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { DatePickerInput } from '../../components/DatePickerInput';
import { UploadBox } from '../../components/UploadBox';
import { useAuth, useUploadProfilePicture } from '../../hooks/useAuth';
import { useSavePersonalInfo } from '../../hooks/useDriverTraining';

export default function CompleteProfileDriverScreen() {
  const { user } = useAuth();
  const saved = user?.driver_profile ?? {};

  const [fullName, setFullName] = useState(saved.full_name ?? user?.name ?? '');
  const phone = user?.phone ?? '';
  const [dob, setDob] = useState(saved.date_of_birth ?? '');

  // A newly picked local photo; if null we reuse the already-saved remote one.
  const [photoUri, setPhotoUri] = useState<string | null>(saved.profile_photo ?? null);
  const [photoName, setPhotoName] = useState<string | null>(saved.profile_photo ? 'profile-photo.jpg' : null);
  const [photoChanged, setPhotoChanged] = useState(false);

  const { mutateAsync: uploadPhoto } = useUploadProfilePicture();
  const { mutateAsync: savePersonalInfo, isPending } = useSavePersonalInfo();
  const [submitting, setSubmitting] = useState(false);

  const hasPhoto = photoUri !== null;
  const isFormValid = fullName.trim() !== '' && dob.trim() !== '' && hasPhoto;

  const handlePickPhoto = (uri: string) => {
    setPhotoUri(uri);
    setPhotoChanged(true);
  };

  const handleContinue = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (photoChanged && photoUri) {
        // Sets the user's profile picture server-side; the PATCH below picks
        // it up as the driver profile photo when we don't pass one explicitly.
        const form = new FormData();
        form.append('image', { uri: photoUri, name: photoName ?? 'photo.jpg', type: 'image/jpeg' } as any);
        await uploadPhoto(form);
      }
      await savePersonalInfo({
        full_name: fullName.trim(),
        date_of_birth: dob.trim(),
      });
      router.replace('/(auth)/complete-profile-vehicle');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="black" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <CalText style={styles.heading}>Complete Your Profile</CalText>
        <HelixaText style={styles.subtext}>Driver Information</HelixaText>

        <View style={styles.formGroup}>
          <HelixaText style={styles.label}>Full Name</HelixaText>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <HelixaText style={styles.label}>Phone Number</HelixaText>
          <View style={[styles.inputContainer, styles.inputDisabled]}>
            <TextInput style={[styles.input, { color: '#9CA3AF' }]} value={phone} editable={false} />
          </View>
        </View>

        <DatePickerInput label="Date of Birth" value={dob} onChangeText={setDob} />

        <View style={styles.formGroup}>
          <UploadBox
            label="Profile Photo *"
            fileUri={photoUri}
            fileName={photoName}
            setUri={handlePickPhoto}
            setName={setPhotoName}
            defaultFileName="photo.jpg"
          />
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            title="Continue"
            onPress={handleContinue}
            disabled={!isFormValid || submitting || isPending}
            isLoading={submitting || isPending}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  heading: { fontSize: 28, lineHeight: 34, color: '#000000', marginBottom: 8 },
  subtext: { fontSize: 16, color: '#9CA3AF', marginBottom: 32 },
  formGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '500', color: '#000000', marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: '#FAFAFA',
  },
  inputDisabled: { backgroundColor: '#F3F4F6' },
  input: { flex: 1, fontSize: 15, color: '#000', height: '100%' },
  buttonWrapper: { marginTop: 16 },
});
