import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { Formik } from 'formik';
import * as Yup from 'yup';

import { CalText } from '../components/CalText';
import { HelixaText } from '../components/HelixaText';
import { useAuth, useUploadProfilePicture } from '../hooks/useAuth';
import { apiClient } from '../api/client';
import { PressableScale, Reveal } from '../components/motion';

const BaseSchema = {
  name: Yup.string().required('Full Name is required'),
  phone: Yup.string().required('Phone Number is required'),
  gender: Yup.string().oneOf(['Female', 'Male']).required('Gender is required'),
};
// Nurses also keep their professional details here; drivers edit vehicle details through onboarding.
const NurseSchema = Yup.object().shape({
  ...BaseSchema,
  hospitalAffiliation: Yup.string().nullable(),
  licenseNumber: Yup.string().required('License number is required'),
  yearsOfExperience: Yup.number()
    .typeError('Must be a number')
    .min(0, 'Cannot be negative')
    .required('Years of Experience is required'),
});
const BasicSchema = Yup.object().shape(BaseSchema);

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const uploadMutation = useUploadProfilePicture();

  const nurseProfile = (user as any)?.nurse_profile;
  const isNurse = user?.user_type === 'nurse';
  const licenseNumber = nurseProfile?.verification_documents?.licenseNumber || '';

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
          type: asset.mimeType || 'image/jpeg',
        });

        uploadMutation.mutate(formData, {
          onSuccess: () => {
            Toast.show({
              type: 'success',
              text1: 'Success',
              text2: 'Profile picture updated successfully!',
            });
            refreshUser();
          },
          onError: () => {
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: 'Failed to upload profile picture.',
            });
          },
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Reveal index={0}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="chevron-left" size={28} color="#111827" />
          </TouchableOpacity>
          <CalText style={styles.headerTitle}>Edit Profile</CalText>
          <View style={{ width: 28 }} />
        </View>
      </Reveal>

      <Formik
        initialValues={{
          name: user?.name || '',
          phone: user?.phone || '',
          hospitalAffiliation: nurseProfile?.hospital_affiliation || '',
          yearsOfExperience: nurseProfile?.years_of_experience?.toString() || '',
          gender: (user as any)?.gender || 'Female',
          licenseNumber,
        }}
        validationSchema={isNurse ? NurseSchema : BasicSchema}
        onSubmit={async (values, { setSubmitting }) => {
          try {
            if (isNurse) {
              if (values.gender !== (user as any)?.gender) {
                await apiClient.patch('/users/profile', { gender: values.gender });
              }
              await apiClient.patch('/users/nurse-profile', {
                name: values.name,
                phone: values.phone,
                hospital_affiliation: values.hospitalAffiliation,
                years_of_experience: parseInt(values.yearsOfExperience) || 0,
                license_number: values.licenseNumber,
              });
            } else {
              // Drivers and partners: the general profile endpoint (nurse-profile is nurses only).
              await apiClient.patch('/users/profile', { name: values.name, phone: values.phone, gender: values.gender });
            }

            await refreshUser();

            Toast.show({
              type: 'success',
              text1: 'Success',
              text2: 'Profile updated successfully!',
            });
            router.back();
          } catch (error: any) {
            console.log('Update profile error:', error);
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: error?.message || 'Failed to update profile.',
            });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({
          handleChange,
          handleBlur,
          handleSubmit,
          values,
          setFieldValue,
          isSubmitting,
          errors,
          touched,
        }) => (
          <>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {/* Avatar Section */}
              <Reveal index={1}>
                <View style={styles.avatarSection}>
                  <Image
                    source={{
                      uri: user?.profilePicture ||
                        'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=150&q=80',
                    }}
                    style={styles.avatar}
                  />
                  <TouchableOpacity
                    style={styles.editPhotoBtn}
                    onPress={handlePickImage}
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? (
                      <ActivityIndicator size="small" color="#111827" />
                    ) : (
                      <HelixaText style={styles.editPhotoText} weight="bold">
                        Edit Photo
                      </HelixaText>
                    )}
                  </TouchableOpacity>
                </View>
              </Reveal>

              {/* Form Fields */}
              <Reveal index={2}>
                <View style={styles.formGroup}>
                  <HelixaText style={styles.label}>Full Name</HelixaText>
                  <TextInput
                    style={[styles.input, touched.name && errors.name ? styles.inputError : null]}
                    value={values.name}
                    onChangeText={handleChange('name')}
                    onBlur={handleBlur('name')}
                    placeholder="e.g. Sarah Chen"
                    placeholderTextColor="#9CA3AF"
                  />
                  {touched.name && errors.name && (
                    <HelixaText style={styles.errorText}>{errors.name as string}</HelixaText>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <HelixaText style={styles.label}>Email</HelixaText>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={user?.email}
                    editable={false}
                    placeholder="Email address"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.formGroup}>
                  <HelixaText style={styles.label}>Phone Number</HelixaText>
                  <TextInput
                    style={[styles.input, touched.phone && errors.phone ? styles.inputError : null]}
                    value={values.phone}
                    onChangeText={handleChange('phone')}
                    onBlur={handleBlur('phone')}
                    placeholder="e.g. +1 (555) 234 - 5678"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                  />
                  {touched.phone && errors.phone && (
                    <HelixaText style={styles.errorText}>{errors.phone as string}</HelixaText>
                  )}
                </View>
              </Reveal>

              <Reveal index={3}>
                <View style={styles.formGroup}>
                  <HelixaText style={styles.label}>Gender *</HelixaText>
                  <View style={styles.genderRow}>
                    <TouchableOpacity
                      style={[styles.genderCard, values.gender === 'Female' && styles.genderCardActive]}
                      activeOpacity={0.7}
                      onPress={() => setFieldValue('gender', 'Female')}
                    >
                      <HelixaText style={styles.genderText} weight={values.gender === 'Female' ? 'bold' : 'regular'}>
                        Female
                      </HelixaText>
                      {values.gender === 'Female' ? (
                        <MaterialCommunityIcons name="check-circle" size={20} color="#D62D88" />
                      ) : (
                        <View style={styles.radioEmpty} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.genderCard, values.gender === 'Male' && styles.genderCardActive]}
                      activeOpacity={0.7}
                      onPress={() => setFieldValue('gender', 'Male')}
                    >
                      <HelixaText style={styles.genderText} weight={values.gender === 'Male' ? 'bold' : 'regular'}>
                        Male
                      </HelixaText>
                      {values.gender === 'Male' ? (
                        <MaterialCommunityIcons name="check-circle" size={20} color="#D62D88" />
                      ) : (
                        <View style={styles.radioEmpty} />
                      )}
                    </TouchableOpacity>
                  </View>
                  {touched.gender && errors.gender && (
                    <HelixaText style={styles.errorText}>{errors.gender as string}</HelixaText>
                  )}
                </View>
              </Reveal>

              {isNurse && (
              <Reveal index={4}>
                <View style={styles.formGroup}>
                  <HelixaText style={styles.label}>Hospital Affiliation</HelixaText>
                  <TextInput
                    style={[styles.input, touched.hospitalAffiliation && errors.hospitalAffiliation ? styles.inputError : null]}
                    value={values.hospitalAffiliation}
                    onChangeText={handleChange('hospitalAffiliation')}
                    onBlur={handleBlur('hospitalAffiliation')}
                    placeholder="e.g. General Hospital"
                    placeholderTextColor="#9CA3AF"
                  />
                  {touched.hospitalAffiliation && errors.hospitalAffiliation && (
                    <HelixaText style={styles.errorText}>{errors.hospitalAffiliation as string}</HelixaText>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <HelixaText style={styles.label}>Nursing License Number *</HelixaText>
                  <TextInput
                    style={[styles.input, touched.licenseNumber && errors.licenseNumber ? styles.inputError : null]}
                    value={values.licenseNumber}
                    onChangeText={handleChange('licenseNumber')}
                    onBlur={handleBlur('licenseNumber')}
                    autoCapitalize="characters"
                    placeholder="e.g. RN-2024-08742"
                    placeholderTextColor="#9CA3AF"
                  />
                  {touched.licenseNumber && errors.licenseNumber && (
                    <HelixaText style={styles.errorText}>{errors.licenseNumber as string}</HelixaText>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <HelixaText style={styles.label}>Years of Experience *</HelixaText>
                  <View style={[styles.inputWithIcon, touched.yearsOfExperience && errors.yearsOfExperience ? styles.inputError : null]}>
                    <TextInput
                      style={styles.inputInside}
                      value={values.yearsOfExperience}
                      onChangeText={handleChange('yearsOfExperience')}
                      onBlur={handleBlur('yearsOfExperience')}
                      placeholder="e.g. 6"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                    />
                    <Feather name="chevron-down" size={20} color="#6B7280" style={{ marginRight: 16 }} />
                  </View>
                  {touched.yearsOfExperience && errors.yearsOfExperience && (
                    <HelixaText style={styles.errorText}>{errors.yearsOfExperience as string}</HelixaText>
                  )}
                </View>
              </Reveal>
              )}
            </ScrollView>

            {/* Footer / Save Button */}
            <Reveal index={5}>
              <View style={styles.footer}>
                <PressableScale
                  style={styles.saveBtn}
                  onPress={() => handleSubmit()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <HelixaText style={styles.saveBtnText} weight="bold">
                      Save Changes
                    </HelixaText>
                  )}
                </PressableScale>
              </View>
            </Reveal>
          </>
        )}
      </Formik>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    color: '#111827',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  
  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  editPhotoBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  editPhotoText: {
    fontSize: 14,
    color: '#111827',
  },

  // Forms
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    fontFamily: 'Helixa-Regular',
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  inputDisabled: {
    backgroundColor: '#F9FAFB',
    color: '#9CA3AF',
  },

  // Gender radios
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  genderCardActive: {
    borderColor: '#FCE7F3',
    backgroundColor: '#FFFFFF',
  },
  genderText: {
    fontSize: 15,
    color: '#111827',
  },
  radioEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
  },

  // Input with icon
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
  },
  inputInside: {
    flex: 1,
    fontFamily: 'Helixa-Regular',
    fontSize: 15,
    color: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: '#D62D88',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
