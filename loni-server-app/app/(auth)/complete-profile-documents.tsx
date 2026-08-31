import React, { useState } from 'react';
import { 
  View, 
  Pressable, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { UploadBox } from '../../components/UploadBox';
import { useUploadDocument, useCompleteDriverProfile } from '../../hooks/useAuth';

export default function CompleteProfileDocumentsScreen() {
  const { vehicleData } = useLocalSearchParams();
  const parsedVehicleData = vehicleData ? JSON.parse(vehicleData as string) : {};

  // Upload states
  const [licenseUri, setLicenseUri] = useState<string | null>(null);
  const [licenseName, setLicenseName] = useState<string | null>(null);
  const [idUri, setIdUri] = useState<string | null>(null);
  const [idName, setIdName] = useState<string | null>(null);
  const [papersUri, setPapersUri] = useState<string | null>(null);
  const [papersName, setPapersName] = useState<string | null>(null);

  const { mutateAsync: completeProfile, isPending } = useCompleteDriverProfile();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormValid = licenseUri !== null && idUri !== null && papersUri !== null;

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('vehicle_type', parsedVehicleData.vehicleType);
      formData.append('has_ac', parsedVehicleData.hasAC === 'Yes' ? 'true' : 'false');
      formData.append('vehicle_brand', parsedVehicleData.brand);
      formData.append('vehicle_year', parsedVehicleData.year);
      formData.append('vehicle_model', parsedVehicleData.model);
      formData.append('plate_number', parsedVehicleData.plate);
      formData.append('vehicle_color', parsedVehicleData.color);
      formData.append('licenseNumber', ''); // The driver form didn't collect licenseNumber, leaving empty string to satisfy backend

      const appendFile = (key: string, uri: string | null, name: string | null) => {
        if (uri && name) {
          formData.append(key, { uri, name, type: 'image/jpeg' } as any);
        }
      };

      appendFile('front_view', parsedVehicleData.frontUri, parsedVehicleData.frontName);
      appendFile('back_view', parsedVehicleData.backUri, parsedVehicleData.backName);
      appendFile('vin', parsedVehicleData.vinUri, parsedVehicleData.vinName);
      appendFile('interior', parsedVehicleData.interiorUri, parsedVehicleData.interiorName);
      appendFile('driver_license', licenseUri, licenseName);
      appendFile('government_id', idUri, idName);
      appendFile('vehicle_papers', papersUri, papersName);
      
      // await completeProfile(formData);

      router.push('/(auth)/verification-progress');
    } catch (error) {
      console.error('Failed to complete driver profile', error);
    } finally {
      setIsSubmitting(false);
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
        <HelixaText style={styles.subtext}>Document Upload</HelixaText>

        <UploadBox label="Driver's License" fileUri={licenseUri} fileName={licenseName} setUri={setLicenseUri} setName={setLicenseName} defaultFileName="license.jpg" />
        <UploadBox label="Government ID" fileUri={idUri} fileName={idName} setUri={setIdUri} setName={setIdName} defaultFileName="gov_id.jpg" />
        <UploadBox label="Vehicle Papers" fileUri={papersUri} fileName={papersName} setUri={setPapersUri} setName={setPapersName} defaultFileName="vehicle_papers.jpg" />

        <View style={styles.buttonWrapper}>
          <Button 
            title="Submit for Review"
            onPress={handleSubmit}
            disabled={!isFormValid || isSubmitting || isPending}
            isLoading={isSubmitting || isPending}
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
