import React, { useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { DatePickerInput } from '../../components/DatePickerInput';
import { SelectModal } from '../../components/SelectModal';
import { UploadBox } from '../../components/UploadBox';
import { useAuth, useUploadDocument } from '../../hooks/useAuth';
import { useSaveVehicleInfo } from '../../hooks/useDriverTraining';

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

type Upload = { uri: string | null; name: string | null; changed: boolean };
const initUpload = (url?: string | null): Upload => ({
  uri: url ?? null,
  name: url ? 'photo.jpg' : null,
  changed: false,
});

export default function CompleteProfileVehicleScreen() {
  const { user } = useAuth();
  const saved = user?.driver_profile ?? {};
  const savedDocs = saved.verification_documents ?? {};

  const [vehicleType, setVehicleType] = useState(saved.vehicle_type ?? 'SUV');
  const [hasAC, setHasAC] = useState(
    saved.has_ac === true ? 'Yes' : saved.has_ac === false ? 'No' : ''
  );
  const [brand, setBrand] = useState(saved.vehicle_brand ?? '');
  const [year, setYear] = useState(saved.vehicle_year ?? '');
  const [model, setModel] = useState(saved.vehicle_model ?? '');
  const [plate, setPlate] = useState(saved.plate_number ?? '');
  const [color, setColor] = useState(saved.vehicle_color ?? '');
  const [customColor, setCustomColor] = useState('');

  const [front, setFront] = useState<Upload>(initUpload(savedDocs.front_view));
  const [back, setBack] = useState<Upload>(initUpload(savedDocs.back_view));
  const [vin, setVin] = useState<Upload>(initUpload(savedDocs.vin));
  const [interior, setInterior] = useState<Upload>(initUpload(savedDocs.interior));

  const [acModalVisible, setAcModalVisible] = useState(false);
  const [colorModalVisible, setColorModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { mutateAsync: uploadDocument } = useUploadDocument();
  const { mutateAsync: saveVehicleInfo, isPending } = useSaveVehicleInfo();

  const isFormValid =
    vehicleType.trim() !== '' &&
    hasAC.trim() !== '' &&
    brand.trim() !== '' &&
    year.trim() !== '' &&
    model.trim() !== '' &&
    plate.trim() !== '' &&
    (color === 'Other' ? customColor.trim() !== '' : color.trim() !== '') &&
    front.uri !== null &&
    back.uri !== null &&
    vin.uri !== null &&
    interior.uri !== null;

  const uploadIfChanged = async (u: Upload, existing?: string): Promise<string> => {
    if (!u.changed && existing) return existing;
    if (!u.uri) throw new Error('Missing an image');
    const form = new FormData();
    form.append('file', { uri: u.uri, name: u.name ?? 'photo.jpg', type: 'image/jpeg' } as any);
    const res = await uploadDocument(form);
    return res.data.url;
  };

  const handleContinue = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const [frontUrl, backUrl, vinUrl, interiorUrl] = await Promise.all([
        uploadIfChanged(front, savedDocs.front_view),
        uploadIfChanged(back, savedDocs.back_view),
        uploadIfChanged(vin, savedDocs.vin),
        uploadIfChanged(interior, savedDocs.interior),
      ]);

      await saveVehicleInfo({
        vehicle_type: vehicleType,
        has_ac: hasAC === 'Yes',
        vehicle_brand: brand.trim(),
        vehicle_year: year.trim(),
        vehicle_model: model.trim(),
        plate_number: plate.trim(),
        vehicle_color: color === 'Other' ? customColor.trim() : color,
        front_view: frontUrl,
        back_view: backUrl,
        vin: vinUrl,
        interior: interiorUrl,
      });
      router.replace('/(auth)/complete-profile-documents');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const setUploadUri =
    (setter: React.Dispatch<React.SetStateAction<Upload>>) => (uri: string) =>
      setter((prev) => ({ ...prev, uri, changed: true }));
  const setUploadName =
    (setter: React.Dispatch<React.SetStateAction<Upload>>) => (name: string) =>
      setter((prev) => ({ ...prev, name }));

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
            {VEHICLE_TYPES.map((type) => (
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
          <TouchableOpacity style={styles.inputContainer} onPress={() => setAcModalVisible(true)} activeOpacity={0.7}>
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
                placeholder="Toyota"
                placeholderTextColor="#9CA3AF"
                value={brand}
                onChangeText={setBrand}
              />
            </View>
          </View>
          <DatePickerInput label="Vehicle Year" value={year} onChangeText={setYear} placeholder="12/03/2023" style={{ flex: 1 }} />
        </View>

        <View style={styles.formGroup}>
          <HelixaText style={styles.label}>Vehicle Model</HelixaText>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="car-side" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Camry" placeholderTextColor="#9CA3AF" value={model} onChangeText={setModel} />
          </View>
        </View>

        <View style={styles.formGroup}>
          <HelixaText style={styles.label}>Plate Number</HelixaText>
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons name="car-side" size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="ABC-1234" placeholderTextColor="#9CA3AF" value={plate} onChangeText={setPlate} />
          </View>
        </View>

        <View style={styles.formGroup}>
          <HelixaText style={styles.label}>Vehicle Color</HelixaText>
          <TouchableOpacity style={styles.inputContainer} onPress={() => setColorModalVisible(true)} activeOpacity={0.7}>
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

        <UploadBox label="Vehicle Front View" fileUri={front.uri} fileName={front.name} setUri={setUploadUri(setFront)} setName={setUploadName(setFront)} defaultFileName="front_view.jpg" />
        <UploadBox label="Vehicle Back View" fileUri={back.uri} fileName={back.name} setUri={setUploadUri(setBack)} setName={setUploadName(setBack)} defaultFileName="back_view.jpg" />
        <UploadBox label="Vehicle VIN" fileUri={vin.uri} fileName={vin.name} setUri={setUploadUri(setVin)} setName={setUploadName(setVin)} defaultFileName="vin.jpg" />
        <UploadBox label="Vehicle Interior" fileUri={interior.uri} fileName={interior.name} setUri={setUploadUri(setInterior)} setName={setUploadName(setInterior)} defaultFileName="interior.jpg" />

        <View style={styles.buttonWrapper}>
          <Button
            title="Continue"
            onPress={handleContinue}
            disabled={!isFormValid || submitting || isPending}
            isLoading={submitting || isPending}
          />
        </View>

        <SelectModal title="Does your Car have AC?" visible={acModalVisible} onClose={() => setAcModalVisible(false)} options={AC_OPTIONS} selectedValue={hasAC} onSelect={setHasAC} />
        <SelectModal title="Vehicle Color" visible={colorModalVisible} onClose={() => setColorModalVisible(false)} options={COLOR_OPTIONS} selectedValue={color} onSelect={setColor} />
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
  rowGroup: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '500', color: '#000000', marginBottom: 8 },
  pillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillSelected: { backgroundColor: '#D62D88', borderColor: '#D62D88' },
  pillText: { fontSize: 14, color: '#6B7280' },
  pillTextSelected: { color: '#FFFFFF', fontWeight: '500' },
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
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, color: '#000', height: '100%' },
  buttonWrapper: { marginTop: 16 },
});
