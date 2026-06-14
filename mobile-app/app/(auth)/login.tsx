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
import { Image } from 'expo-image';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color="black" />
          </Pressable>

          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logo.svg')}
              style={{ width: 80, height: 80 }}
              contentFit="contain"
            />
          </View>

          <CalText style={styles.heading}>Welcome back</CalText>
          <HelixaText style={styles.subtext}>Sign in to continue your journey.</HelixaText>

          <View style={styles.inputContainer}>
            <HelixaText style={styles.inputLabel} weight="bold">Email</HelixaText>
            <TextInput 
              placeholder="Enter your email" 
              style={styles.input} 
              keyboardType="email-address" 
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputContainer}>
            <HelixaText style={styles.inputLabel} weight="bold">Password</HelixaText>
            <TextInput 
              placeholder="Enter your password" 
              style={styles.input} 
              secureTextEntry 
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <Pressable 
            style={styles.continueButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <HelixaText style={styles.continueButtonText} weight="bold">Sign In</HelixaText>
          </Pressable>

          <Pressable style={styles.switchModeContainer} onPress={() => router.replace('/(auth)/register')}>
            <HelixaText style={styles.switchModeText}>
              Don't have an account? <HelixaText style={styles.switchModeHighlight} weight="bold">Sign up</HelixaText>
            </HelixaText>
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Helvetica Neue',
  },
  continueButton: {
    backgroundColor: '#D62D88',
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  switchModeContainer: {
    marginTop: 24,
    alignItems: 'center',
    padding: 8,
  },
  switchModeText: {
    fontSize: 15,
    color: '#6B7280',
  },
  switchModeHighlight: {
    color: '#D62D88',
  },
});
