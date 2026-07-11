import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileScreen() {
  const { user, logoutUser } = useAuth();
  const router = useRouter();

  const nurseProfile = (user as any)?.nurse_profile;
  const firstName = user?.name ? user.name.split(' ')[0] : 'Nurse';
  const licenseNumber = nurseProfile?.verification_documents?.licenseNumber ?? '—';
  const yearsExp = nurseProfile?.years_of_experience ?? 0;

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => logoutUser() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Original decorative background */}
      <View style={styles.bgContainer}>
        <Image
          source={require('../../assets/images/profile-bgn.png')}
          style={styles.bgImage}
          contentFit="cover"
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <CalText style={styles.heading}>Profile</CalText>

        {/* Profile card */}
        <View style={styles.profileCard}>
          {/* Top row: avatar + name / info */}
          <View style={styles.profileTop}>
            <Image
              source={{
                uri: user?.profilePicture ||
                  'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=150&q=80',
              }}
              style={styles.avatar}
            />
            <View style={styles.profileInfo}>
              <HelixaText style={styles.profileName} weight="bold">{firstName}</HelixaText>
              <View style={styles.profileSubRow}>
                <HelixaText style={styles.profileRole}>Nurse</HelixaText>
                <HelixaText style={styles.dot}> • </HelixaText>
                <HelixaText style={styles.licenseNumber}>
                  {licenseNumber !== '—' ? `RN-${licenseNumber}` : '—'}
                </HelixaText>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.statsDivider} />

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={16} color="#F59E0B" />
                <HelixaText style={styles.statValue} weight="bold">4.9</HelixaText>
              </View>
              <HelixaText style={styles.statLabel}>Rating</HelixaText>
            </View>

            <View style={styles.statSeparator} />

            <View style={styles.statItem}>
              <HelixaText style={styles.statValue} weight="bold">342</HelixaText>
              <HelixaText style={styles.statLabel}>Calls</HelixaText>
            </View>

            <View style={styles.statSeparator} />

            <View style={styles.statItem}>
              <HelixaText style={styles.statValue} weight="bold">{yearsExp}</HelixaText>
              <HelixaText style={styles.statLabel}>Years Exp</HelixaText>
            </View>
          </View>
        </View>

        {/* Edit Profile */}
        <TouchableOpacity 
          style={styles.menuCard} 
          activeOpacity={0.7}
          onPress={() => router.push('/edit-profile')}
        >
          <View style={styles.menuRow}>
            <Feather name="edit-2" size={20} color="#111827" style={styles.menuIcon} />
            <HelixaText style={styles.menuLabel} weight="bold">Edit Profile</HelixaText>
          </View>
          <View style={styles.chevronBox}>
            <Feather name="arrow-right" size={18} color="#111827" />
          </View>
        </TouchableOpacity>

        {/* Settings + Support */}
        <View style={styles.groupCard}>
          <TouchableOpacity style={styles.groupMenuRow} activeOpacity={0.7}>
            <Feather name="settings" size={20} color="#111827" style={styles.menuIcon} />
            <HelixaText style={styles.menuLabel} weight="bold">Settings</HelixaText>
            <View style={[styles.chevronBox, styles.chevronRight]}>
              <Feather name="arrow-right" size={18} color="#111827" />
            </View>
          </TouchableOpacity>

          <View style={styles.groupDivider} />

          <TouchableOpacity style={styles.groupMenuRow} activeOpacity={0.7}>
            <Feather name="help-circle" size={20} color="#111827" style={styles.menuIcon} />
            <HelixaText style={styles.menuLabel} weight="bold">Support</HelixaText>
            <View style={[styles.chevronBox, styles.chevronRight]}>
              <Feather name="arrow-right" size={18} color="#111827" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutCard} onPress={handleSignOut} activeOpacity={0.8}>
          <View style={styles.menuRow}>
            <Feather name="log-out" size={20} color="#FA3532" style={styles.menuIcon} />
            <HelixaText style={styles.signOutLabel} weight="bold">Sign Out</HelixaText>
          </View>
          <View style={styles.signOutChevron}>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  bgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 140,
    zIndex: 1,
  },
  heading: {
    fontSize: 28,
    color: '#111827',
    marginBottom: 20,
  },

  // Profile card
  profileCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    color: '#D62D88',
    marginBottom: 4,
  },
  profileSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileRole: {
    fontSize: 13,
    color: '#6B7280',
  },
  dot: {
    fontSize: 13,
    color: '#6B7280',
  },
  licenseNumber: {
    fontSize: 13,
    color: '#15B300',
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statSeparator: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Single-item card
  menuCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    marginRight: 14,
  },
  menuLabel: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },
  chevronBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronRight: {
    marginLeft: 'auto',
  },

  // Grouped card
  groupCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  groupMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
  },
  groupDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },

  // Sign out
  signOutCard: {
    backgroundColor: '#FFE3E3',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  signOutLabel: {
    fontSize: 15,
    color: '#FA3532',
    flex: 1,
  },
  signOutChevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FA3532',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
