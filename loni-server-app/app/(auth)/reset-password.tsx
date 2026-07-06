import React from 'react';
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

const ResetSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
});

export default function ResetPasswordScreen() {
  const handleReset = (values: any, { setSubmitting }: any) => {
    setTimeout(() => {
      setSubmitting(false);
      router.push({ pathname: '/(auth)/verify', params: { email: values.email, nextRoute: '/(auth)/create-password' } } as any);
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color="black" />
          </Pressable>

          <CalText style={styles.heading}>Reset Password</CalText>
          <HelixaText style={styles.subtext}>
            Enter your email address and we'll send you a verification code.
          </HelixaText>

          <Formik
            initialValues={{ email: '' }}
            validationSchema={ResetSchema}
            onSubmit={handleReset}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isSubmitting, isValid, dirty }) => (
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

                <Button 
                  title="Send Reset Code"
                  onPress={handleSubmit as any}
                  isLoading={isSubmitting}
                  disabled={!(isValid && dirty)}
                />
              </>
            )}
          </Formik>

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
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 40,
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
  continueButton: {
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: '#D62D88',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
});
