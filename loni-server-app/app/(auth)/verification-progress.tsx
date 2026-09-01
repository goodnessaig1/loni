import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Image
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { VerificationIcon } from '../../components/VerificationIcon';
import { useAuth } from '../../hooks/useAuth';

export default function VerificationProgressScreen() {
  const { user, logoutUser, refreshUser } = useAuth();
  const navigatedRef = useRef(false);

  const goToDashboardIfApproved = useCallback(() => {
    if (navigatedRef.current) return;
    if (user?.account_status === 'active') {
      navigatedRef.current = true;
      router.replace('/(tabs)');
    }
  }, [user?.account_status]);

  // React immediately if the user object is already (or becomes) active -
  // e.g. a push / WebSocket approval landed while this screen was mounted.
  useEffect(goToDashboardIfApproved, [goToDashboardIfApproved]);

  // Fallback for when neither the push nor the socket reached us: while the
  // screen is focused, re-check the account status every 15s.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const check = async () => {
        try {
          await refreshUser();
        } catch {
          /* offline / transient - try again next tick */
        }
      };
      check();
      const id = setInterval(() => {
        if (!cancelled) check();
      }, 15000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }, [refreshUser])
  );

  const handleCheckBack = async () => {
    await logoutUser();
    router.replace('/(auth)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={handleCheckBack} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="black" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.illustrationContainer}>
          <VerificationIcon />
        </View>

        <CalText style={styles.heading}>Verification in Progress</CalText>
        
        <HelixaText style={styles.subtitle}>
          We're reviewing your information.
        </HelixaText>

        <Button 
          title="Check Back Later"
          onPress={handleCheckBack}
          style={styles.button}
        />

        <HelixaText style={styles.footerNote}>
          This usually takes 24-48 hours. We'll notify you once your verification is complete.
        </HelixaText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  illustrationContainer: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  iconPlaceholder: {
    position: 'absolute',
    zIndex: 2,
    bottom: 20,
    left: 20,
  },
  iconBg: {
    position: 'absolute',
    zIndex: 1,
    top: 20,
    right: 20,
  },
  heading: {
    fontSize: 24,
    lineHeight: 30,
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    width: '100%',
    marginBottom: 40,
  },
  footerNote: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  }
});
