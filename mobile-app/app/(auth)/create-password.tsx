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
import { useTheme } from '../../context/ThemeContext';
import type { Palette } from '../../lib/theme';
import { Reveal } from '../../components/motion';

const PasswordSchema = Yup.object().shape({
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm your password'),
});

export default function CreatePasswordScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleCreatePassword = (values: any, { setSubmitting }: any) => {
    setTimeout(() => {
      setSubmitting(false);
      router.replace('/(auth)/login');
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Reveal index={0}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color={colors.text} />
          </Pressable>

          <CalText style={styles.heading}>Create New Password</CalText>
          </Reveal>

          <Formik
            initialValues={{ password: '', confirmPassword: '' }}
            validationSchema={PasswordSchema}
            onSubmit={handleCreatePassword}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isValid, dirty, isSubmitting }) => (
              <>
                <Reveal index={1}>
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

                <View style={styles.inputGroup}>
                  <HelixaText style={styles.inputLabel} weight="bold">Confirm Password</HelixaText>
                  <View style={[styles.passwordInputContainer, touched.confirmPassword && errors.confirmPassword ? styles.inputError : null]}>
                    <TextInput 
                      style={styles.passwordInput} 
                      placeholder="Re-enter password"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!showConfirmPassword}
                      value={values.confirmPassword}
                      onChangeText={handleChange('confirmPassword')}
                      onBlur={handleBlur('confirmPassword')}
                    />
                    <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                      <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={20} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                  {touched.confirmPassword && errors.confirmPassword && (
                    <HelixaText style={styles.errorText}>{errors.confirmPassword}</HelixaText>
                  )}
                </View>
                </Reveal>

                <Reveal index={2}>
                <Button 
                  title="Continue"
                  onPress={handleSubmit as any}
                  isLoading={isSubmitting}
                  disabled={!(isValid && dirty)}
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
    fontSize: 28,
    lineHeight: 34,
    color: c.text,
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: c.text,
    marginBottom: 8,
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
  continueButtonSpacing: {
    marginTop: 24,
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
