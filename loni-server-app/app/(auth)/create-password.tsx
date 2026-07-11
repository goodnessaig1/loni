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
import { useLocalSearchParams } from 'expo-router';
import { useResetPassword } from '../../hooks/useAuth';

const PasswordSchema = Yup.object().shape({
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm your password'),
});

export default function CreatePasswordScreen() {
  const { email, otp } = useLocalSearchParams<{ email: string, otp: string }>();
  const { mutateAsync: resetPassword } = useResetPassword();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleCreatePassword = async (values: any, { setSubmitting, setFieldError }: any) => {
    try {
      await resetPassword({
        email,
        otp,
        newPassword: values.password
      });
      router.replace('/(auth)/login');
    } catch (error: any) {
      console.error('Password reset failed:', error.response?.data || error.message);
      setFieldError('password', error.response?.data?.error || 'Failed to reset password');
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

          <CalText style={styles.heading}>Create New Password</CalText>

          <Formik
            initialValues={{ password: '', confirmPassword: '' }}
            validationSchema={PasswordSchema}
            onSubmit={handleCreatePassword}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isValid, dirty, isSubmitting }) => (
              <>
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

                <View style={styles.inputGroup}>
                  <HelixaText style={styles.inputLabel} weight="bold">Confirm Password</HelixaText>
                  <View style={[styles.passwordInputContainer, touched.confirmPassword && errors.confirmPassword ? styles.inputError : null]}>
                    <TextInput 
                      style={styles.passwordInput} 
                      placeholder="Re-enter password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showConfirmPassword}
                      value={values.confirmPassword}
                      onChangeText={handleChange('confirmPassword')}
                      onBlur={handleBlur('confirmPassword')}
                    />
                    <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                      <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={20} color="#6B7280" />
                    </Pressable>
                  </View>
                  {touched.confirmPassword && errors.confirmPassword && (
                    <HelixaText style={styles.errorText}>{errors.confirmPassword}</HelixaText>
                  )}
                </View>

                <Button 
                  title="Continue"
                  onPress={handleSubmit as any}
                  isLoading={isSubmitting}
                  disabled={!(isValid && dirty)}
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
    fontSize: 28,
    lineHeight: 34,
    color: '#000000',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
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
    color: '#6B7280',
  },
  signUpTextBold: {
    fontSize: 14,
    color: '#D62D88',
  },
});
