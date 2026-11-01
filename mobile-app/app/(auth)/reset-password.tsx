import React, { useMemo } from 'react';
import { 
  View, 
  Pressable, 
  TextInput, 
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { KeyboardScrollView } from '../../components/KeyboardAvoid';
import { useTheme } from '../../context/ThemeContext';
import type { Palette } from '../../lib/theme';
import { Reveal } from '../../components/motion';

const ResetSchema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
});

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const handleReset = (values: any, { setSubmitting }: any) => {
    setTimeout(() => {
      setSubmitting(false);
      router.push({ pathname: '/(auth)/verify', params: { email: values.email, nextRoute: '/(auth)/create-password' } } as any);
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardScrollView contentContainerStyle={styles.scrollContent}>
          <Reveal index={0}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color={colors.text} />
          </Pressable>

          <CalText style={styles.heading}>Reset Password</CalText>
          <HelixaText style={styles.subtext}>
            Enter your email address and we'll send you a verification code.
          </HelixaText>
          </Reveal>

          <Formik
            initialValues={{ email: '' }}
            validationSchema={ResetSchema}
            onSubmit={handleReset}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isSubmitting, isValid, dirty }) => (
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
                </Reveal>

                <Reveal index={2}>
                <Button 
                  title="Send Reset Code"
                  onPress={handleSubmit as any}
                  isLoading={isSubmitting}
                  disabled={!(isValid && dirty)}
                />
                </Reveal>
              </>
            )}
          </Formik>

        </KeyboardScrollView>
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
    marginBottom: 24,
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    color: c.text,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 15,
    color: c.textSecondary,
    lineHeight: 22,
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 40,
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
