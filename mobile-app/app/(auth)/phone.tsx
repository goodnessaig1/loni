import React, { useState } from 'react';
import {
  View,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const isValidPhone = cleanPhone.length === 10 || cleanPhone.length === 11;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color="black" />
          </Pressable>

          <CalText style={styles.heading}>Your Phone Number</CalText>
          <HelixaText style={styles.subtext}>
            We'll send you a verification code to confirm your number
          </HelixaText>

          <View style={styles.inputContainer}>
            <HelixaText style={styles.inputLabel} weight="bold">Your phone number</HelixaText>

            <View style={styles.phoneInputWrapper}>
              <View style={styles.countryPicker}>
                <View style={styles.flagCircle}>
                  <View style={styles.flagGreen} />
                  <View style={styles.flagWhite} />
                  <View style={styles.flagGreen} />
                </View>
                <HelixaText style={styles.countryCode} weight="bold">+234</HelixaText>
                {/* <Feather name="chevron-down" size={16} color="#9CA3AF" /> */}
              </View>

              <View style={styles.divider} />

              <TextInput
                placeholder="800 000 0000"
                style={styles.phoneInput}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                placeholderTextColor="#D1D5DB"
              />
            </View>
          </View>

          <Pressable
            style={[styles.continueButton, isValidPhone ? styles.continueButtonActive : styles.continueButtonDisabled]}
            disabled={!isValidPhone}
            onPress={() => router.push({ pathname: '/(auth)/verify-phone', params: { phone } })}
          >
            <HelixaText style={styles.continueButtonText} weight="bold">Send Verification Code</HelixaText>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex1: {
    flex: 1,
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
    marginBottom: 8,
  },
  subtext: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 15,
    color: '#000000',
    marginBottom: 8,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  flagCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  flagGreen: {
    flex: 1,
    backgroundColor: '#008751',
  },
  flagWhite: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  countryCode: {
    fontSize: 16,
    color: '#111827',
  },
  divider: {
    width: 1,
    height: '60%',
    backgroundColor: '#E5E7EB',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Helvetica Neue',
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
    opacity: 0.8,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
