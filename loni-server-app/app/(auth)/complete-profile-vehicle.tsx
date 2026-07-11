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
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { DatePickerInput } from '../../components/DatePickerInput';
import { SelectModal } from '../../components/SelectModal';
import { UploadBox } from '../../components/UploadBox';

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Hatchback', 'Minivan', 'Pickup'];

const AC_OPTIONS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
];

const COLOR_OPTIONS = [
  { label: 'White', value: 'White', colorHex: '#FFFFFF' },
  { label: 'Black', value: 'Black', colorHex: '#000000' },
  { label: 'Silver', value: 'Silver', colorHex: '#C0C0C0' },
  { label: 'Grey', value: 'Grey', colorHex: '#808080' },
  { label: 'Red', value: 'Red', colorHex: '#FF0000' },
  { label: 'Blue', value: 'Blue', colorHex: '#0000FF' },
  { label: 'Green', value: 'Green', colorHex: '#008000' },
  { label: 'Yellow', value: 'Yellow', colorHex: '#FFFF00' },
  { label: 'Orange', value: 'Orange', colorHex: '#FFA500' },
  { label: 'Brown', value: 'Brown', colorHex: '#A52A2A' },
  { label: 'Gold', value: 'Gold', colorHex: '#FFD700' },
  { label: 'Other', value: 'Other' },
];

export default function CompleteProfileVehicleScreen() {
  const [vehicleType, setVehicleType] = useState('SUV');
  const [hasAC, setHasAC] = useState('');
  const [brand, setBrand] = useState('');
  const [year, setYear] = useState('');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');
  const [color, setColor] = useState('');
  const [customColor, setCustomColor] = useState('');

  // Upload states
  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [frontName, setFrontName] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);
  const [backName, setBackName] = useState<string | null>(null);
  const [vinUri, setVinUri] = useState<string | null>(null);
  const [vinName, setVinName] = useState<string | null>(null);
  const [interiorUri, setInteriorUri] = useState<string | null>(null);
  const [interiorName, setInteriorName] = useState<string | null>(null);

  const [acModalVisible, setAcModalVisible] = useState(false);
  const [colorModalVisible, setColorModalVisible] = useState(false);

  const isFormValid = 
    vehicleType.trim() !== '' && 
    hasAC.trim() !== '' && 
    brand.trim() !== '' && 
    year.trim() !== '' && 
    model.trim() !== '' && 
    plate.trim() !== '' && 
    (color === 'Other' ? customColor.trim() !== '' : color.trim() !== '') && 
    frontUri !== null && 
    backUri !== null && 
    vinUri !== null && 
    interiorUri !== null;

  const handleContinue = () => {
    const vehicleData = {
      vehicleType,
      hasAC,
      brand,
      year,
      model,
      plate,
      color: color === 'Other' ? customColor : color,
      frontUri,
      frontName,
      backUri,
      backName,
      vinUri,
      vinName,
      interiorUri,
      interiorName,
    };
    
    // Navigate to document upload step
    router.push({
      pathname: '/(auth)/complete-profile-documents',
      params: { vehicleData: JSON.stringify(vehicleData) }
    });
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
        <HelixaText style={styles.subtext}>Vehicle Information</HelixaText>

        <View style={styles.formGroup}>
          <HelixaText style={styles.label}>Vehicle Type</HelixaText>
          <View style={styles.pillsContainer}>
            {VEHICLE_TYPES.map(type => (
              <TouchableOpacity 
                key={type}
                style={[styles.pill, vehicleType === type && styles.pillSelected]}
                onPress={() => setVehicleType(type)}
              >
                <HelixaText style={[styles.pillText, vehicleType === type && styles.pillTextSelected]}>
                  {type}
                </HelixaText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <HelixaText style={styles.label}>Does your Car have AC?</HelixaText>
          <TouchableOpacity 
            style={styles.inputContainer}
            onPress={() => setAcModalVisible(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="air-conditioner" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput 
              style={[styles.input, { color: hasAC ? '#000' : '#9CA3AF' }]}
              placeholder="Yes / No"
              placeholderTextColor="#9CA3AF"
              value={hasAC}
              editable={false}
              pointerEvents="none"
            />
            <Feather name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={styles.rowGroup}>
          <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
            <HelixaText style={styles.label}>Vehicle Brand</HelixaText>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons name="car-side" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                placeholder="SUV"
                placeholderTextColor="#9CA3AF"
                value={brand}
                onChangeText={setBrand}
              />
            </View>
          </View>
          <DatePickerInput 
            label="Vehicle Year"
            value={year}
            onChangeText={setYear}
            placeholder="12/03/2023"
            style={{ flex: 1 }}
          />
        </View>

        <View style={styles.formGroup}>
          <HelixaText style={styles.label}>Vehicle Model</HelixaText>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="car-side" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput 
              style={styles.input}
              placeholder="Camry"
              placeholderTextColor="#9CA3AF"
              value={model}
              onChangeText={setModel}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <HelixaText style={styles.label}>Plate Number</HelixaText>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="car-side" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput 
              style={styles.input}
              placeholder="ABC-1234"
              placeholderTextColor="#9CA3AF"
              value={plate}
              onChangeText={setPlate}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <HelixaText style={styles.label}>Vehicle Color</HelixaText>
          <TouchableOpacity 
            style={styles.inputContainer}
            onPress={() => setColorModalVisible(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="palette-outline" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput 
              style={[styles.input, { color: color ? '#000' : '#9CA3AF' }]}
              placeholder="Select Color"
              placeholderTextColor="#9CA3AF"
              value={color}
              editable={false}
              pointerEvents="none"
            />
            <Feather name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {color === 'Other' && (
          <View style={[styles.formGroup, { marginTop: -8 }]}>
            <HelixaText style={styles.label}>Specify Color</HelixaText>
            <View style={styles.inputContainer}>
              <TextInput 
                style={styles.input}
                placeholder="e.g. Matte Black"
                placeholderTextColor="#9CA3AF"
                value={customColor}
                onChangeText={setCustomColor}
              />
            </View>
          </View>
        )}

        <UploadBox label="Vehicle Front View" fileUri={frontUri} fileName={frontName} setUri={setFrontUri} setName={setFrontName} defaultFileName="front_view.jpg" />
        <UploadBox label="Vehicle Back View" fileUri={backUri} fileName={backName} setUri={setBackUri} setName={setBackName} defaultFileName="back_view.jpg" />
        <UploadBox label="Vehicle VIN" fileUri={vinUri} fileName={vinName} setUri={setVinUri} setName={setVinName} defaultFileName="vin.jpg" />
        <UploadBox label="Vehicle Interior" fileUri={interiorUri} fileName={interiorName} setUri={setInteriorUri} setName={setInteriorName} defaultFileName="interior.jpg" />

        <View style={styles.buttonWrapper}>
          <Button 
            title="Continue"
            onPress={handleContinue}
            disabled={!isFormValid}
          />
        </View>

        <SelectModal 
          title="Does your Car have AC?"
          visible={acModalVisible}
          onClose={() => setAcModalVisible(false)}
          options={AC_OPTIONS}
          selectedValue={hasAC}
          onSelect={setHasAC}
        />

        <SelectModal 
          title="Vehicle Color"
          visible={colorModalVisible}
          onClose={() => setColorModalVisible(false)}
          options={COLOR_OPTIONS}
          selectedValue={color}
          onSelect={setColor}
        />

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
  rowGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillSelected: {
    backgroundColor: '#D62D88',
    borderColor: '#D62D88',
  },
  pillText: {
    fontSize: 14,
    color: '#6B7280',
  },
  pillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '500',
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
  inputIcon: {
    marginRight: 12,
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
