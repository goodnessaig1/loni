import React, { useState, useMemo } from 'react';
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
import { useLogin } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import type { Palette } from '../../lib/theme';
import { Reveal } from '../../components/motion';

const LoginSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
});

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [showPassword, setShowPassword] = useState(false);
  const { mutateAsync: loginUser } = useLogin();

  const handleLogin = async (values: any, { setSubmitting, setFieldError }: any) => {
    try {
      await loginUser({
        email: values.email,
        password: values.password,
      });
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Login failed:', error.response?.data || error.message);
      setFieldError('email', error.response?.data?.error || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Reveal index={0}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color={colors.text} />
          </Pressable>

          <CalText style={styles.heading}>Log In</CalText>
          <HelixaText style={styles.subtext}>
            Log in to your LONI Server account.
          </HelixaText>
          </Reveal>

          <Formik
            initialValues={{ email: 'goodness6337@gmail.com', password: 'goodness' }}
            validationSchema={LoginSchema}
            onSubmit={handleLogin}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isSubmitting }) => (
              <>
                <Reveal index={1}>
                <View style={styles.inputGroup}>
                  <HelixaText style={styles.inputLabel} weight="bold">Email</HelixaText>
                  <TextInput
                    style={[styles.input, touched.email && errors.email ? styles.inputError : null]}
                    placeholder="Sarahchen@example.com"
                    placeholderTextColor={colors.textMuted}
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
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!showPassword}
                      value={values.password}
                      onChangeText={handleChange('password')}
                      onBlur={handleBlur('password')}
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                      <Feather name={showPassword ? "eye" : "eye-off"} size={20} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                  {touched.password && errors.password && (
                    <HelixaText style={styles.errorText}>{errors.password}</HelixaText>
                  )}
                </View>

                <Pressable onPress={() => router.push('/(auth)/reset-password')} style={styles.forgotPasswordContainer}>
                  <HelixaText style={styles.forgotPasswordText} weight="bold">Forgot Password?</HelixaText>
                </Pressable>
                </Reveal>

                <Reveal index={2}>
                <Button
                  title="Continue"
                  onPress={handleSubmit as any}
                  isLoading={isSubmitting}
                  style={styles.continueButtonSpacing}
                />
                </Reveal>
              </>
            )}
          </Formik>

          <Reveal index={3}>
          <View style={styles.signUpContainer}>
            <HelixaText style={styles.signUpText}>
              Don't have an account? <HelixaText style={styles.signUpTextBold} weight="bold" onPress={() => router.push('/(auth)/register')}>Sign Up</HelixaText>
            </HelixaText>
          </View>
          </Reveal>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
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
    color: c.text,
    marginBottom: 6,
  },
  subtext: {
    fontSize: 15,
    color: c.textSecondary,
    lineHeight: 22,
    marginBottom: 36,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: c.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: c.text,
    fontFamily: 'Helvetica Neue',
    backgroundColor: c.bgSoft,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.bgSoft,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: c.text,
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
    color: c.textSecondary,
  },
  signUpTextBold: {
    fontSize: 14,
    color: '#D62D88',
  },
});
