import React, { useState } from 'react';
import { 
  View, 
  Pressable, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';

export default function CompleteProfileDocumentsScreen() {
  // Upload states
  const [licenseUri, setLicenseUri] = useState<string | null>(null);
  const [licenseName, setLicenseName] = useState<string | null>(null);
  const [idUri, setIdUri] = useState<string | null>(null);
  const [idName, setIdName] = useState<string | null>(null);
  const [papersUri, setPapersUri] = useState<string | null>(null);
  const [papersName, setPapersName] = useState<string | null>(null);

  const isFormValid = licenseUri !== null && idUri !== null && papersUri !== null;

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

  const handleSubmit = () => {
    // Final step, submit and go to verification progress
    router.push('/(auth)/verification-progress');
  };

  const renderUploadBox = (
    label: string, 
    uri: string | null, 
    name: string | null, 
    setUri: (uri: string) => void, 
    setName: (name: string) => void,
    defaultFilename: string
  ) => (
    <View style={styles.formGroup}>
      <HelixaText style={styles.label}>{label}</HelixaText>
      <TouchableOpacity 
        style={styles.uploadBox}
        onPress={() => pickImage(setUri, setName, defaultFilename)}
      >
        <Feather name="upload-cloud" size={24} color="#000" style={{ marginBottom: 8 }} />
        <HelixaText style={styles.uploadText}>Tap to upload photo</HelixaText>
        <View style={styles.plusBox}>
          <Feather name="plus" size={16} color="#FFF" />
        </View>
      </TouchableOpacity>
      {uri && (
        <View style={styles.uploadedFileRow}>
          <Feather name="file-text" size={20} color="#D62D88" style={{ marginRight: 12 }} />
          <View>
            <HelixaText style={styles.fileName}>{name}</HelixaText>
            <HelixaText style={styles.fileSize}>200 KB</HelixaText>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="black" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <CalText style={styles.heading}>Complete Your Profile</CalText>
        <HelixaText style={styles.subtext}>Document Upload</HelixaText>

        {renderUploadBox("Driver's License", licenseUri, licenseName, setLicenseUri, setLicenseName, 'license.jpg')}
        {renderUploadBox("Government ID", idUri, idName, setIdUri, setIdName, 'gov_id.jpg')}
        {renderUploadBox("Vehicle Papers", papersUri, papersName, setPapersUri, setPapersName, 'vehicle_papers.jpg')}

        <View style={styles.buttonWrapper}>
          <Button 
            title="Submit for Review"
            onPress={handleSubmit}
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
    marginBottom: 12,
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
