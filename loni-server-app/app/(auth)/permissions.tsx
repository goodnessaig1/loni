import React, { useState } from 'react';
import { 
  View, 
  Pressable, 
  StyleSheet, 
  ScrollView,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';

export default function PermissionsScreen() {
  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [contactsGranted, setContactsGranted] = useState(false);

  const canContinue = locationGranted && notificationsGranted;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="black" />
        </Pressable>

        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Feather name="check-circle" size={32} color="#10B981" />
          </View>
          <CalText style={styles.heading}>Enable permissions</CalText>
          <HelixaText style={styles.subtext}>
            These permissions help us provide the best care and support
          </HelixaText>
        </View>

        <View style={styles.cardsContainer}>
          {/* Location Access */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Feather name="map-pin" size={20} color="#4B5563" />
              </View>
              <View style={styles.cardTextContent}>
                <View style={styles.cardTitleRow}>
                  <HelixaText style={styles.cardTitle} weight="bold">Location Access</HelixaText>
                  <View style={styles.requiredBadge}>
                    <HelixaText style={styles.requiredText}>Required</HelixaText>
                  </View>
                </View>
                <HelixaText style={styles.cardDescription}>
                  Required for emergency ride dispatch and tracking.
                </HelixaText>
              </View>
            </View>
            
            <Pressable 
              style={[styles.grantButton, locationGranted && styles.grantedButton]}
              onPress={() => setLocationGranted(true)}
            >
              {locationGranted ? (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  <HelixaText style={styles.grantedText}>Permission Granted.</HelixaText>
                  <Feather name="check" size={16} color="#D62D88" />
                </View>
              ) : (
                <HelixaText style={styles.grantText}>Grant Permission</HelixaText>
              )}
            </Pressable>
          </View>

          {/* Notifications */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Feather name="bell" size={20} color="#4B5563" />
              </View>
              <View style={styles.cardTextContent}>
                <View style={styles.cardTitleRow}>
                  <HelixaText style={styles.cardTitle} weight="bold">Notifications</HelixaText>
                  <View style={styles.requiredBadge}>
                    <HelixaText style={styles.requiredText}>Required</HelixaText>
                  </View>
                </View>
                <HelixaText style={styles.cardDescription}>
                  Stay informed about rides, calls, and important updates.
                </HelixaText>
              </View>
            </View>
            
            <Pressable 
              style={[styles.grantButton, notificationsGranted && styles.grantedButton]}
              onPress={() => setNotificationsGranted(true)}
            >
              {notificationsGranted ? (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  <HelixaText style={styles.grantedText}>Permission Granted.</HelixaText>
                  <Feather name="check" size={16} color="#D62D88" />
                </View>
              ) : (
                <HelixaText style={styles.grantText}>Grant Permission</HelixaText>
              )}
            </Pressable>
          </View>

          {/* Emergency Contacts */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Feather name="users" size={20} color="#4B5563" />
              </View>
              <View style={styles.cardTextContent}>
                <View style={styles.cardTitleRow}>
                  <HelixaText style={styles.cardTitle} weight="bold">Emergency Contacts</HelixaText>
                </View>
                <HelixaText style={styles.cardDescription}>
                  Quick access to notify loved ones during emergencies.
                </HelixaText>
              </View>
            </View>
            
            <Pressable 
              style={[styles.grantButton, contactsGranted && styles.grantedButton]}
              onPress={() => setContactsGranted(true)}
            >
              {contactsGranted ? (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  <HelixaText style={styles.grantedText}>Permission Granted.</HelixaText>
                  <Feather name="check" size={16} color="#D62D88" />
                </View>
              ) : (
                <HelixaText style={styles.grantText}>Grant Permission</HelixaText>
              )}
            </Pressable>
          </View>
        </View>

        <Pressable 
          style={[styles.continueButton, canContinue ? styles.continueButtonActive : styles.continueButtonDisabled]}
          disabled={!canContinue}
          onPress={() => router.push('/(auth)/emergency-contacts')}
        >
          <HelixaText style={styles.continueButtonText} weight="bold">Continue</HelixaText>
        </Pressable>
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
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5', // Light green
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 26,
    lineHeight: 32,
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  card: {
    borderWidth: 1,
    borderColor: '#E9EAEB',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTextContent: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    color: '#111827',
  },
  requiredBadge: {
    backgroundColor: '#FDF2F8', // Light pink
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  requiredText: {
    fontSize: 11,
    color: '#D62D88',
  },
  cardDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  grantButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9EAEB',
    backgroundColor: '#FFFFFF',
  },
  grantedButton: {
    borderColor: '#FDF2F8',
    backgroundColor: '#FFFFFF',
  },
  grantText: {
    fontSize: 14,
    color: '#111827',
  },
  grantedText: {
    fontSize: 14,
    color: '#D62D88',
  },
  continueButton: {
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueButtonActive: {
    backgroundColor: '#D62D88',
  },
  continueButtonDisabled: {
    backgroundColor: '#F9C2D9',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
