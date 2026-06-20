import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../../components/HelixaText';
import { Image } from 'expo-image';
import CarShieldIcon from '../../components/CarShieldIcon';
import { CalText } from 'components/CalText';
// import rideImage from '../../assets/images/ride.svg';
export default function EmergencyRideRequestScreen() {
  const router = useRouter();
  const [notifyContacts, setNotifyContacts] = useState(true);

  const handleConfirm = () => {
    // Pass a parameter to the home screen to start the ride tracker
    router.replace({ pathname: '/(tabs)/', params: { startRide: 'true' } } as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Header Icon */}
        <View style={styles.iconContainer}>
          <Image
            source={require('../../assets/images/ride1.svg')}
            style={{ width: 111, height: 78.95 }}
            contentFit='fill'
          />
          {/* We will use a generic wrapper around the provided SVG path, colored with pink/blue as needed.
              But since the SVG is a single path, it will be a single color. Let's use the brand pink. */}
          {/* <CarShieldIcon size={120} color="#D62D88" /> */}
        </View>

        <CalText style={styles.title}>
          Request Emergency Ride
        </CalText>

        <HelixaText style={styles.subtitle}>
          We'll immediately dispatch a trained driver to take you to the nearest hospital
        </HelixaText>

        <View style={styles.warningBanner}>
          <Feather name="alert-circle" size={20} color="#DC2626" style={styles.warningIcon} />
          <View style={styles.warningTextContainer}>
            <HelixaText weight="bold" style={styles.warningTitle}>
              This is for emergencies only
            </HelixaText>
            <HelixaText style={styles.warningDesc}>
              If you're experiencing severe pain, heavy bleeding, or other urgent symptoms
            </HelixaText>
          </View>
        </View>

        <View style={styles.cardContainer}>
          <View style={styles.locationCard}>
            <View style={styles.locationIconWrapper}>
              <Feather name="map-pin" size={16} color="#6B7280" />
            </View>
            <View style={styles.locationInfo}>
              <HelixaText style={styles.locationLabel}>Pickup Location</HelixaText>
              <HelixaText weight="bold" style={styles.locationValue}>123 Main Street, Apt 4B</HelixaText>
              <HelixaText style={styles.locationSub}>San Francisco, CA</HelixaText>
            </View>
          </View>
          <TouchableOpacity style={styles.useLiveLocationBtn}>
            <HelixaText weight="bold" style={styles.useLiveLocationText}>Use LIVE Location</HelixaText>
          </TouchableOpacity>
        </View>

        <View style={styles.cardContainer}>
          <View style={styles.locationCard}>
            <View style={styles.locationIconWrapper}>
              <Feather name="map-pin" size={16} color="#6B7280" />
            </View>
            <View style={styles.locationInfo}>
              <HelixaText style={styles.locationLabel}>Destination</HelixaText>
              <HelixaText weight="bold" style={styles.locationValue}>UCSF Medical Center</HelixaText>
              <HelixaText style={styles.locationSub}>2.4 miles away • 8 min</HelixaText>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setNotifyContacts(!notifyContacts)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, notifyContacts && styles.checkboxChecked]}>
            {notifyContacts && <Feather name="check" size={14} color="#FFF" />}
          </View>
          <View style={styles.checkboxTextContainer}>
            <HelixaText weight="bold" style={styles.checkboxTitle}>Notify emergency contacts</HelixaText>
            <HelixaText style={styles.checkboxDesc}>
              We'll alert your partner and emergency contacts with your location
            </HelixaText>
          </View>
        </TouchableOpacity>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
          <HelixaText style={styles.confirmBtnText}>Confirm Emergency Request</HelixaText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <HelixaText style={styles.cancelBtnText}>Cancel</HelixaText>
        </TouchableOpacity>

        <View style={styles.footerDisclaimer}>
          <HelixaText style={styles.disclaimerText}>Life-threatening emergency?</HelixaText>
          <HelixaText style={styles.disclaimerTextBold}>Call 911 immediately</HelixaText>
        </View>
      </View>
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
    paddingTop: 20,
    paddingBottom: 40,
  },
  iconContainer: {
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    color: '#000',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 24,
  },
  warningIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    color: '#B91C1C',
    fontSize: 16,
    marginBottom: 4,
  },
  warningDesc: {
    color: '#B91C1C',
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  locationValue: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 4,
  },
  locationSub: {
    fontSize: 14,
    color: '#6B7280',
  },
  useLiveLocationBtn: {
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  useLiveLocationText: {
    fontSize: 14,
    color: '#111827',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxTitle: {
    fontSize: 16,
    color: '#B91C1C',
    marginBottom: 4,
  },
  checkboxDesc: {
    fontSize: 14,
    color: '#B91C1C',
    lineHeight: 20,
    opacity: 0.8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  confirmBtn: {
    backgroundColor: '#D62D88',
    width: '100%',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelBtn: {
    backgroundColor: '#FFF1F2',
    width: '100%',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  cancelBtnText: {
    color: '#D62D88',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerDisclaimer: {
    alignItems: 'center',
  },
  disclaimerText: {
    color: '#EF4444',
    fontSize: 14,
  },
  disclaimerTextBold: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
