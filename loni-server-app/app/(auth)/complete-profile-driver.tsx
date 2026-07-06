import React, { useState } from 'react';
import { 
  View, 
  Pressable, 
  StyleSheet, 
  ScrollView,
  TextInput,
  TouchableOpacity
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { DatePickerInput } from '../../components/DatePickerInput';

export default function CompleteProfileDriverScreen() {
  const [fullName, setFullName] = useState('Sarah Chen');
  const [phone, setPhone] = useState('+1 (555) 234 - 5678');
  const [dob, setDob] = useState('');
  
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);

  const pickImage = async (
    setUri: (uri: string) => void, 
    setName: (name: string) => void, 
    defaultName: string
  ) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setUri(result.assets[0].uri);
      const filename = result.assets[0].uri.split('/').pop() || defaultName;
      setName(filename);
    }
  };

  const handleContinue = () => {
    router.push('/(auth)/complete-profile-vehicle');
  };

  const isFormValid = fullName.trim() !== '' && phone.trim() !== '' && dob.trim() !== '' && photoUri !== null;

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
          <View style={[styles.inputContainer, styles.inputDisabled]}>
            <TextInput 
              style={[styles.input, { color: '#9CA3AF' }]}
              value={fullName}
              editable={false}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <HelixaText style={styles.label}>Phone Number</HelixaText>
          <View style={[styles.inputContainer, styles.inputDisabled]}>
            <TextInput 
              style={[styles.input, { color: '#9CA3AF' }]}
              value={phone}
              editable={false}
            />
          </View>
        </View>

        <DatePickerInput 
          label="Date of Birth"
          value={dob}
          onChangeText={setDob}
        />

        <View style={styles.formGroup}>
          <HelixaText style={styles.label}>Profile Photo *</HelixaText>
          <TouchableOpacity 
            style={styles.uploadBox}
            onPress={() => pickImage(setPhotoUri, setPhotoName, 'photo.jpg')}
          >
            <Feather name='upload-cloud' size={24} color="#000" style={{ marginBottom: 8 }} />
            <HelixaText style={styles.uploadText}>Tap to upload photo</HelixaText>
            <View style={styles.plusBox}>
              <Feather name="plus" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
          {photoUri && (
            <View style={styles.uploadedFileRow}>
              <Feather name="file-text" size={20} color="#D62D88" style={{ marginRight: 12 }} />
              <View>
                <HelixaText style={styles.fileName}>{photoName}</HelixaText>
                <HelixaText style={styles.fileSize}>200 KB</HelixaText>
              </View>
            </View>
          )}
        </View>

        <View style={styles.buttonWrapper}>
          <Button 
            title="Continue"
            onPress={handleContinue}
            disabled={!isFormValid}
          />
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    color: '#000000',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 32,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
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
  inputDisabled: {
    backgroundColor: '#F3F4F6',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    height: '100%',
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  uploadText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  plusBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadedFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  fileName: {
    fontSize: 14,
    color: '#D62D88',
    fontWeight: '500',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  buttonWrapper: {
    marginTop: 16,
  }
});
