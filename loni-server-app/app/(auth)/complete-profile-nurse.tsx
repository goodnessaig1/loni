import React, { useState } from 'react';
import { 
  View, 
  Pressable, 
  TextInput, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  Text,
  TouchableOpacity
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { UploadBox } from '../../components/UploadBox';
import { Reveal, PressableScale } from '../../components/motion';

import { useUploadDocument, useCompleteNurseProfile } from '../../hooks/useAuth';

type Gender = 'Female' | 'Male' | null;

export default function CompleteProfileNurseScreen() {
  const [gender, setGender] = useState<Gender>('Female');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string>('photo.jpg');
  const [licenseUri, setLicenseUri] = useState<string | null>(null);
  const [licenseName, setLicenseName] = useState<string>('license.pdf');
  const [idUri, setIdUri] = useState<string | null>(null);
  const [idName, setIdName] = useState<string>('id.pdf');
  
  const { mutateAsync: completeProfile, isPending } = useCompleteNurseProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('years_of_experience', yearsExperience);
      formData.append('hospital_affiliation', '');
      formData.append('gender', gender!);
      formData.append('licenseNumber', licenseNumber);

      formData.append('photo', {
        uri: photoUri,
        name: photoName,
        type: 'image/jpeg',
      } as any);

      formData.append('license', {
        uri: licenseUri,
        name: licenseName,
        type: 'image/jpeg',
      } as any);

      formData.append('id', {
        uri: idUri,
        name: idName,
        type: 'image/jpeg',
      } as any);
      
      await completeProfile(formData);
      
      router.push('/(auth)/review-profile-nurse'); 
    } catch (error) {
      console.error('Failed to complete profile', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = 
    gender !== null && 
    licenseNumber.trim() !== '' && 
    yearsExperience.trim() !== '' && 
    photoUri !== null && 
    licenseUri !== null && 
    idUri !== null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color="black" />
          </Pressable>

          <Reveal index={0}>
            <CalText style={styles.heading}>Complete Your Profile</CalText>
          </Reveal>

          <Reveal index={1}>

            {/* Gender */}
            <View style={styles.inputContainer}>
              <HelixaText style={styles.inputLabel} weight="bold">Gender *</HelixaText>
              <View style={styles.genderRow}>
                <PressableScale
                  style={[styles.genderBox, gender === 'Female' && styles.genderBoxSelected]}
                  onPress={() => setGender('Female')}
                >
                  <HelixaText style={styles.genderText}>Female</HelixaText>
                  <View style={[styles.radioEmpty, gender === 'Female' && styles.radioSelected]}>
                    {gender === 'Female' && <View style={styles.radioInner} />}
                  </View>
                </PressableScale>

                <PressableScale
                  style={[styles.genderBox, gender === 'Male' && styles.genderBoxSelected]}
                  onPress={() => setGender('Male')}
                >
                  <HelixaText style={styles.genderText}>Male</HelixaText>
                  <View style={[styles.radioEmpty, gender === 'Male' && styles.radioSelected]}>
                    {gender === 'Male' && <View style={styles.radioInner} />}
                  </View>
                </PressableScale>
              </View>
            </View>

            {/* Nursing License Number */}
            <View style={styles.inputContainer}>
              <HelixaText style={styles.inputLabel} weight="bold">Nursing License Number *</HelixaText>
              <TextInput 
                placeholder="RN-2024-08742" 
                style={styles.input} 
                onChangeText={setLicenseNumber}
                value={licenseNumber}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Years of Experience */}
            <View style={styles.inputContainer}>
              <HelixaText style={styles.inputLabel} weight="bold">Years of Experience *</HelixaText>
              <View style={styles.numberInputContainer}>
                <TextInput 
                  placeholder="6" 
                  style={styles.numberInput} 
                  keyboardType="numeric"
                  onChangeText={(text) => setYearsExperience(text.replace(/[^0-9]/g, ''))}
                  value={yearsExperience}
                  placeholderTextColor="#9CA3AF"
                />
                <View style={styles.upDownArrows}>
                  <Feather name="chevron-up" size={16} color="#6B7280" />
                  <Feather name="chevron-down" size={16} color="#6B7280" />
                </View>
              </View>
            </View>
          </Reveal>

          <Reveal index={2}>
            {/* Uploads */}
            <UploadBox label="Profile Photo *" fileUri={photoUri} fileName={photoName} setUri={setPhotoUri} setName={setPhotoName} />
            <UploadBox label="Nursing License *" fileUri={licenseUri} fileName={licenseName} setUri={setLicenseUri} setName={setLicenseName} />
            <UploadBox label="Government ID *" fileUri={idUri} fileName={idName} setUri={setIdUri} setName={setIdName} />

            <HelixaText style={styles.footerNote}>
              Documents must be clear, unexpired, and show your full name matching your profile. Verification typically takes 24-48 hours.
            </HelixaText>
          </Reveal>

          <Reveal index={3}>
            <Button 
              title="Continue"
              onPress={handleContinue}
              disabled={!isFormValid || isSubmitting || isPending}
              isLoading={isSubmitting || isPending}
              style={{ marginTop: 24 }}
            />
          </Reveal>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex1: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 24,
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    color: '#000000',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 15,
    color: '#000000',
    marginBottom: 12,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  genderBoxSelected: {
    borderColor: '#F9A8D4', 
  },
  genderText: {
    fontSize: 15,
    color: '#000000',
  },
  radioEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#D62D88',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D62D88',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Helvetica Neue',
    backgroundColor: '#FAF8F8',
  },
  numberInputContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FAF8F8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Helvetica Neue',
  },
  upDownArrows: {
    paddingRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadSection: {
    marginBottom: 24,
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#FAF8F8',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIcon: {
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
  },
  uploadPlusButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#6B7280', // Grey square
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadedFileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F5', // Light pink
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  uploadedFileName: {
    fontSize: 14,
    color: '#D62D88',
    marginBottom: 2,
  },
  uploadedFileSize: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  footerNote: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
    marginTop: 8,
  }
});
