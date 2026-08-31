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
import { Formik } from 'formik';
import * as Yup from 'yup';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { useLogin, useAuth } from '../../hooks/useAuth';
import { useEffect } from 'react';

const LoginSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
});

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const { mutateAsync: loginUser } = useLogin();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      if (user.user_type === 'nurse') {
        if (!user.nurse_profile) {
          router.replace('/(auth)/complete-profile-nurse');
        } else if (user.account_status === 'pending') {
          router.replace('/(auth)/verification-progress');
        } else {
          router.replace('/(tabs)');
        }
      } else if (user.user_type === 'driver') {
        if (!user.driver_profile) {
          router.replace('/(auth)/complete-profile-vehicle');
        } else if (user.account_status === 'pending') {
          router.replace('/(auth)/verification-progress');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        router.replace('/(auth)/role-selection');
      }
    }
  }, [user]);

  const handleLogin = async (values: any, { setSubmitting, setFieldError }: any) => {
    try {
      await loginUser({
        email: values.email,
        password: values.password,
      });
      // Navigation is now handled by the useEffect above
    } catch (error: any) {
      console.error('Login failed:', error.response?.data || error.message);
      setFieldError('email', error.response?.data?.message || error.response?.data?.error || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color="black" />
          </Pressable>

          <CalText style={styles.heading}>Log In</CalText>
          <HelixaText style={styles.subtext}>
            Log in to your LONI Server account.
          </HelixaText>

          <Formik
            initialValues={{ email: 'goodness6337+nurse@gmail.com', password: 'goodness' }}
            validationSchema={LoginSchema}
            onSubmit={handleLogin}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isSubmitting }) => (
              <>
                <View style={styles.inputGroup}>
                  <HelixaText style={styles.inputLabel} weight="bold">Email</HelixaText>
                  <TextInput
                    style={[styles.input, touched.email && errors.email ? styles.inputError : null]}
                    placeholder="Sarahchen@example.com"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={values.email}
                    onChangeText={handleChange('email')}
                    onBlur={handleBlur('email')}
                  />
                  {touched.email && errors.email && (
                    <HelixaText style={styles.errorText}>{errors.email}</HelixaText>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <HelixaText style={styles.inputLabel} weight="bold">Password</HelixaText>
                  <View style={[styles.passwordInputContainer, touched.password && errors.password ? styles.inputError : null]}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Min. 8 characters"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPassword}
                      value={values.password}
                      onChangeText={handleChange('password')}
                      onBlur={handleBlur('password')}
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                      <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#6B7280" />
                    </Pressable>
                  </View>
                  {touched.password && errors.password && (
                    <HelixaText style={styles.errorText}>{errors.password}</HelixaText>
                  )}
                </View>

                <Pressable onPress={() => router.push('/(auth)/reset-password')} style={styles.forgotPasswordContainer}>
                  <HelixaText style={styles.forgotPasswordText} weight="bold">Forgot Password?</HelixaText>
                </Pressable>

                <Button
                  title="Continue"
                  onPress={handleSubmit as any}
                  isLoading={isSubmitting}
                  style={styles.continueButtonSpacing}
                />
              </>
            )}
          </Formik>

          <View style={styles.signUpContainer}>
            <HelixaText style={styles.signUpText}>
              Don't have an account? <HelixaText style={styles.signUpTextBold} weight="bold" onPress={() => router.push('/(auth)/register')}>Sign Up</HelixaText>
            </HelixaText>
          </View>

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
    fontSize: 24,
    lineHeight: 34,
    color: '#000000',
    marginBottom: 6,
  },
  subtext: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 36,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#000000',
    fontFamily: 'Helvetica Neue',
    backgroundColor: '#FFFFFF',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#000000',
    fontFamily: 'Helvetica Neue',
  },
  eyeIcon: {
    padding: 14,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 32,
  },
  forgotPasswordText: {
    color: '#D62D88',
    fontSize: 14,
  },
  continueButtonSpacing: {
    marginBottom: 24,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  signUpContainer: {
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 14,
    color: '#6B7280',
  },
  signUpTextBold: {
    fontSize: 14,
    color: '#D62D88',
  },
});
