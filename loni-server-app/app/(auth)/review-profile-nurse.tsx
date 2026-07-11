import React from 'react';
import { 
  View, 
  Pressable, 
  StyleSheet, 
  ScrollView,
  Image
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { useAuth } from '../../hooks/useAuth';

export default function ReviewProfileNurseScreen() {
  const { user } = useAuth();
  
  const handleSubmit = () => {
    router.push('/(auth)/verification-progress');
  };

  const InfoRow = ({ label, value, valueFirst = true }: { label: string, value: string, valueFirst?: boolean }) => (
    <View style={styles.infoRow}>
      {valueFirst ? (
        <>
          <HelixaText style={styles.infoValueLeft}>{value}</HelixaText>
          <HelixaText style={styles.infoLabelRight}>{label}</HelixaText>
        </>
      ) : (
        <>
          <HelixaText style={styles.infoLabelLeft}>{label}</HelixaText>
          <HelixaText style={styles.infoValueRight}>{value}</HelixaText>
        </>
      )}
    </View>
  );

  const profilePhoto = user?.nurse_profile?.verification_documents?.photo || user?.profile_picture || 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?ixlib=rb-1.2.1&auto=format&fit=crop&w=300&q=80';
  const licenseNumber = user?.nurse_profile?.verification_documents?.licenseNumber || 'N/A';
  const experience = user?.nurse_profile?.years_of_experience ? `${user.nurse_profile.years_of_experience} years` : 'N/A';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="black" />
        </Pressable>

        <CalText style={styles.heading}>Review Your Profile</CalText>

        <View style={styles.profileHeader}>
          <Image 
            source={{ uri: profilePhoto }}
            style={styles.profileImage}
          />
          <View style={styles.profileInfo}>
            <HelixaText style={styles.profileName} weight="bold">{user?.name || 'Sarah Chen'}</HelixaText>
            <HelixaText style={styles.profileRole}>Nurse</HelixaText>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <InfoRow value={user?.gender || "Female"} label="Gender" />
          <InfoRow label="Phone" value={user?.phone || "+1 (555) 234 - 5678"} valueFirst={false} />
          <InfoRow label="Email" value={user?.email || "Sarahchen@example.com"} valueFirst={false} />
          <InfoRow label="License No." value={licenseNumber} valueFirst={false} />
          <InfoRow label="Experience" value={experience} valueFirst={false} />
        </View>

        <HelixaText style={styles.footerNote}>
          Your profile information will be verified by our team. Make sure everything is correct.
        </HelixaText>

        <Button 
          title="Submit Profile"
          onPress={handleSubmit}
          style={{ marginTop: 32 }}
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  profileImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    color: '#000000',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 15,
    color: '#6B7280',
  },
  infoContainer: {
    marginBottom: 40,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  infoValueLeft: {
    fontSize: 15,
    color: '#6B7280',
  },
  infoLabelRight: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
  },
  infoLabelLeft: {
    fontSize: 15,
    color: '#6B7280',
  },
  infoValueRight: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
  },
  footerNote: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
    marginBottom: 24,
  }
});
