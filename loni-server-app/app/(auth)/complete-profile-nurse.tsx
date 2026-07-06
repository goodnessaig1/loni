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

  const handleContinue = () => {
    router.push('/(auth)/review-profile-nurse'); 
  };

  const isFormValid = 
    gender !== null && 
    licenseNumber.trim() !== '' && 
    yearsExperience.trim() !== '' && 
    photoUri !== null && 
    licenseUri !== null && 
    idUri !== null;

  const pickImage = async (setUri: (uri: string) => void, setName: (name: string) => void) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setUri(uri);
      const uriParts = uri.split('/');
      setName(uriParts[uriParts.length - 1] || 'uploaded_file.jpg');
    }
  };

  const renderUploadBox = (title: string, fileUri: string | null, fileName: string, setUri: (uri: string) => void, setName: (name: string) => void) => (
    <View style={styles.uploadSection}>
      <HelixaText style={styles.inputLabel} weight="bold">{title}</HelixaText>
      
      <TouchableOpacity 
        style={styles.uploadBox}
        onPress={() => pickImage(setUri, setName)}
        activeOpacity={0.7}
      >
        <Feather name="upload-cloud" size={24} color="#000000" style={styles.uploadIcon} />
        <HelixaText style={styles.uploadText}>Tap to upload photo</HelixaText>
        <View style={styles.uploadPlusButton}>
          <Feather name="plus" size={16} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {fileUri && (
        <View style={styles.uploadedFileBox}>
          <Feather name="file-text" size={20} color="#D62D88" style={{ marginRight: 12 }} />
          <View>
            <HelixaText style={styles.uploadedFileName} weight="bold">{fileName}</HelixaText>
            <HelixaText style={styles.uploadedFileSize}>200 KB</HelixaText>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color="black" />
          </Pressable>

          <CalText style={styles.heading}>Complete Your Profile</CalText>

          {/* Gender */}
          <View style={styles.inputContainer}>
            <HelixaText style={styles.inputLabel} weight="bold">Gender *</HelixaText>
            <View style={styles.genderRow}>
              <Pressable 
                style={[styles.genderBox, gender === 'Female' && styles.genderBoxSelected]}
                onPress={() => setGender('Female')}
              >
                <HelixaText style={styles.genderText}>Female</HelixaText>
                <View style={[styles.radioEmpty, gender === 'Female' && styles.radioSelected]}>
                  {gender === 'Female' && <View style={styles.radioInner} />}
                </View>
              </Pressable>

              <Pressable 
                style={[styles.genderBox, gender === 'Male' && styles.genderBoxSelected]}
                onPress={() => setGender('Male')}
              >
                <HelixaText style={styles.genderText}>Male</HelixaText>
                <View style={[styles.radioEmpty, gender === 'Male' && styles.radioSelected]}>
                  {gender === 'Male' && <View style={styles.radioInner} />}
                </View>
              </Pressable>
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

          {/* Uploads */}
          {renderUploadBox('Profile Photo *', photoUri, photoName, setPhotoUri, setPhotoName)}
          {renderUploadBox('Nursing License *', licenseUri, licenseName, setLicenseUri, setLicenseName)}
          {renderUploadBox('Government ID *', idUri, idName, setIdUri, setIdName)}

          <HelixaText style={styles.footerNote}>
            Documents must be clear, unexpired, and show your full name matching your profile. Verification typically takes 24-48 hours.
          </HelixaText>

          <Button 
            title="Continue"
            onPress={handleContinue}
            disabled={!isFormValid}
            style={{ marginTop: 24 }}
          />

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
