import React, { useEffect, useState, useMemo } from 'react';
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
import { useTheme } from '../../context/ThemeContext';
import type { Palette } from '../../lib/theme';
import { PressableScale, Reveal } from '../../components/motion';
import {
  PermissionStatus,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  getMicrophonePermissionStatus,
  requestMicrophonePermission,
  openAppSettings,
} from '../../lib/permissions';

/**
 * Production permission requirement: request microphone access here, during
 * onboarding, instead of waiting for the user's first call. This screen
 * previously "granted" all three of its cards (Location, Notifications,
 * Emergency Contacts) by just flipping local React state - none of them
 * called a real permission API, and Microphone wasn't even listed. The
 * actual mic prompt only ever fired later, inside components/CallModals.tsx,
 * gated on a call already being in progress - which is exactly the
 * "permission dialog interrupts my first call" problem this screen now
 * exists to prevent. Notifications and Microphone are now real, requested in
 * that order (matching the product's expected onboarding sequence), via the
 * centralized lib/permissions.ts. Location and Emergency Contacts are
 * unrelated to voice calling and are left as they were.
 */
export default function PermissionsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<PermissionStatus>('undetermined');
  const [micStatus, setMicStatus] = useState<PermissionStatus>('undetermined');
  const [contactsGranted, setContactsGranted] = useState(false);

  useEffect(() => {
    // If the user backgrounded the app to grant permission from a previous
    // "blocked" state, or is revisiting this screen, reflect the real
    // current status instead of always starting from "not granted".
    getNotificationPermissionStatus().then(setNotificationStatus);
    getMicrophonePermissionStatus().then(setMicStatus);
  }, []);

  const canContinue = locationGranted && notificationStatus === 'granted' && micStatus === 'granted';

  async function handleGrantNotifications() {
    if (notificationStatus === 'blocked') {
      openAppSettings();
      return;
    }
    const result = await requestNotificationPermission();
    setNotificationStatus(result);
  }

  async function handleGrantMicrophone() {
    if (micStatus === 'blocked') {
      openAppSettings();
      return;
    }
    const result = await requestMicrophonePermission();
    setMicStatus(result);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Reveal index={0}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color={colors.text} />
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
        </Reveal>

        <View style={styles.cardsContainer}>
          {/* Notifications */}
          <Reveal index={1}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Feather name="bell" size={20} color={colors.textSecondary} />
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
              style={[styles.grantButton, notificationStatus === 'granted' && styles.grantedButton]}
              onPress={handleGrantNotifications}
            >
              {notificationStatus === 'granted' ? (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  <HelixaText style={styles.grantedText}>Permission Granted.</HelixaText>
                  <Feather name="check" size={16} color="#D62D88" />
                </View>
              ) : notificationStatus === 'blocked' ? (
                <HelixaText style={styles.grantText}>Open Settings</HelixaText>
              ) : (
                <HelixaText style={styles.grantText}>Grant Permission</HelixaText>
              )}
            </Pressable>
          </View>
          </Reveal>

          {/* Microphone */}
          <Reveal index={2}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Feather name="mic" size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.cardTextContent}>
                <View style={styles.cardTitleRow}>
                  <HelixaText style={styles.cardTitle} weight="bold">Microphone</HelixaText>
                  <View style={styles.requiredBadge}>
                    <HelixaText style={styles.requiredText}>Required</HelixaText>
                  </View>
                </View>
                <HelixaText style={styles.cardDescription}>
                  Needed so a voice call can start the moment you tap Call - no waiting on a prompt.
                </HelixaText>
              </View>
            </View>

            <Pressable
              style={[styles.grantButton, micStatus === 'granted' && styles.grantedButton]}
              onPress={handleGrantMicrophone}
            >
              {micStatus === 'granted' ? (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                  <HelixaText style={styles.grantedText}>Permission Granted.</HelixaText>
                  <Feather name="check" size={16} color="#D62D88" />
                </View>
              ) : micStatus === 'blocked' ? (
                <HelixaText style={styles.grantText}>Open Settings</HelixaText>
              ) : (
                <HelixaText style={styles.grantText}>Grant Permission</HelixaText>
              )}
            </Pressable>
          </View>
          </Reveal>

          {/* Location Access */}
          <Reveal index={3}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Feather name="map-pin" size={20} color={colors.textSecondary} />
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
          </Reveal>

          {/* Emergency Contacts */}
          <Reveal index={4}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Feather name="users" size={20} color={colors.textSecondary} />
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
          </Reveal>
        </View>

        <Reveal index={5}>
        <PressableScale
          style={[styles.continueButton, canContinue ? styles.continueButtonActive : styles.continueButtonDisabled]}
          disabled={!canContinue}
          onPress={() => router.push('/(auth)/emergency-contacts')}
        >
          <HelixaText style={styles.continueButtonText} weight="bold">Continue</HelixaText>
        </PressableScale>
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
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
    backgroundColor: c.successSoft, // Light green
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 26,
    lineHeight: 32,
    color: c.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 15,
    color: c.textSecondary,
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
    borderColor: c.border,
    borderRadius: 16,
    padding: 16,
    backgroundColor: c.bgSoft,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.bgSoft,
    borderWidth: 1,
    borderColor: c.border,
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
    color: c.text,
  },
  requiredBadge: {
    backgroundColor: c.primarySoft, // Light pink
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
    color: c.textSecondary,
    lineHeight: 18,
  },
  grantButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bgSoft,
  },
  grantedButton: {
    borderColor: c.primarySoft,
    backgroundColor: c.bgSoft,
  },
  grantText: {
    fontSize: 14,
    color: c.text,
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
    backgroundColor: c.primaryDisabled,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
