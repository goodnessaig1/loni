import React, { useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { UploadBox } from '../../components/UploadBox';
import { useAuth, useUploadDocument } from '../../hooks/useAuth';
import { useSaveDocuments, useSubmitApplication } from '../../hooks/useDriverTraining';

type Upload = { uri: string | null; name: string | null; changed: boolean };
const initUpload = (url?: string | null): Upload => ({
  uri: url ?? null,
  name: url ? 'document.jpg' : null,
  changed: false,
});

export default function CompleteProfileDocumentsScreen() {
  const { user } = useAuth();
  const savedDocs = user?.driver_profile?.verification_documents ?? {};

  const [license, setLicense] = useState<Upload>(initUpload(savedDocs.driver_license));
  const [govId, setGovId] = useState<Upload>(initUpload(savedDocs.government_id));
  const [papers, setPapers] = useState<Upload>(initUpload(savedDocs.vehicle_papers));

  const { mutateAsync: uploadDocument } = useUploadDocument();
  const { mutateAsync: saveDocuments, isPending: isSavingDocs } = useSaveDocuments();
  const { mutateAsync: submitApplication, isPending: isSubmittingApp } = useSubmitApplication();
  const [submitting, setSubmitting] = useState(false);

  const isFormValid = license.uri !== null && govId.uri !== null && papers.uri !== null;

  const setUploadUri = (setter: React.Dispatch<React.SetStateAction<Upload>>) => (uri: string) =>
    setter((prev) => ({ ...prev, uri, changed: true }));
  const setUploadName = (setter: React.Dispatch<React.SetStateAction<Upload>>) => (name: string) =>
    setter((prev) => ({ ...prev, name }));

  const uploadIfChanged = async (u: Upload, existing?: string): Promise<string> => {
    if (!u.changed && existing) return existing;
    if (!u.uri) throw new Error('Missing a document');
    const form = new FormData();
    form.append('file', { uri: u.uri, name: u.name ?? 'document.jpg', type: 'image/jpeg' } as any);
    const res = await uploadDocument(form);
    return res.data.url;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const [licenseUrl, govIdUrl, papersUrl] = await Promise.all([
        uploadIfChanged(license, savedDocs.driver_license),
        uploadIfChanged(govId, savedDocs.government_id),
        uploadIfChanged(papers, savedDocs.vehicle_papers),
      ]);

      await saveDocuments({
        driver_license: licenseUrl,
        government_id: govIdUrl,
        vehicle_papers: papersUrl,
      });
      await submitApplication();
      router.replace('/(auth)/verification-progress');
    } catch (e: any) {
      Alert.alert('Could not submit', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || isSavingDocs || isSubmittingApp;

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

        <UploadBox label="Driver's License" fileUri={license.uri} fileName={license.name} setUri={setUploadUri(setLicense)} setName={setUploadName(setLicense)} defaultFileName="license.jpg" />
        <UploadBox label="Government ID" fileUri={govId.uri} fileName={govId.name} setUri={setUploadUri(setGovId)} setName={setUploadName(setGovId)} defaultFileName="gov_id.jpg" />
        <UploadBox label="Vehicle Papers" fileUri={papers.uri} fileName={papers.name} setUri={setUploadUri(setPapers)} setName={setUploadName(setPapers)} defaultFileName="vehicle_papers.jpg" />

        <View style={styles.buttonWrapper}>
          <Button
            title="Submit for Review"
            onPress={handleSubmit}
            disabled={!isFormValid || busy}
            isLoading={busy}
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
  buttonWrapper: { marginTop: 16 },
});
