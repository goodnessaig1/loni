import React, { useMemo } from 'react';
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
import { useAddPhone } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import type { Palette } from '../../lib/theme';
import { Reveal } from '../../components/motion';

const PhoneSchema = Yup.object().shape({
  phone: Yup.string()
    .required('Phone number is required')
    .test('len', 'Must be a valid 10 or 11 digit phone number', val => {
      if (!val) return false;
      const cleanPhone = val.replace(/[^0-9]/g, '');
      return cleanPhone.length === 10 || cleanPhone.length === 11;
    })
});

export default function PhoneScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { mutateAsync: addPhone } = useAddPhone();

  const handlePhoneSubmit = async (values: any, { setSubmitting, setFieldError }: any) => {
    try {
      await addPhone({ phone: values.phone });
      router.push({ pathname: '/(auth)/verify-phone', params: { phone: values.phone } } as any);
    } catch (error: any) {
      console.error('Adding phone failed:', error.response?.data || error.message);
      setFieldError('phone', error.response?.data?.error || 'Failed to add phone');
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

          <CalText style={styles.heading}>Your Phone Number</CalText>
          <HelixaText style={styles.subtext}>
            We'll send you a verification code to confirm your number
          </HelixaText>
          </Reveal>

          <Formik
            initialValues={{ phone: '' }}
            validationSchema={PhoneSchema}
            onSubmit={handlePhoneSubmit}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isValid, dirty, isSubmitting }) => (
              <>
                <Reveal index={1}>
                <View style={styles.inputContainer}>
                  <HelixaText style={styles.inputLabel} weight="bold">Your phone number</HelixaText>

                  <View style={[styles.phoneInputWrapper, touched.phone && errors.phone ? styles.inputError : null]}>
                    <View style={styles.countryPicker}>
                      <View style={styles.flagCircle}>
                        <View style={styles.flagGreen} />
                        <View style={styles.flagWhite} />
                        <View style={styles.flagGreen} />
                      </View>
                      <HelixaText style={styles.countryCode} weight="bold">+234</HelixaText>
                    </View>

                    <View style={styles.divider} />

                    <TextInput
                      placeholder="800 000 0000"
                      style={styles.phoneInput}
                      keyboardType="phone-pad"
                      value={values.phone}
                      onChangeText={handleChange('phone')}
                      onBlur={handleBlur('phone')}
                      placeholderTextColor="#D1D5DB"
                    />
                  </View>
                  {touched.phone && errors.phone && (
                    <HelixaText style={styles.errorText}>{errors.phone}</HelixaText>
                  )}
                </View>
                </Reveal>

                <Reveal index={2}>
                <Button
                  title="Send Verification Code"
                  onPress={handleSubmit as any}
                  isLoading={isSubmitting}
                  disabled={!(isValid && dirty)}
                />
                </Reveal>
              </>
            )}
          </Formik>

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
    marginBottom: 8,
  },
  subtext: {
    fontSize: 16,
    color: c.textSecondary,
    lineHeight: 24,
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 15,
    color: c.text,
    marginBottom: 8,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: c.bgSoft,
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
    color: c.text,
  },
  divider: {
    width: 1,
    height: '60%',
    backgroundColor: c.divider,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: c.text,
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
    backgroundColor: c.primaryDisabled,
    opacity: 0.8,
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
    marginTop: 8,
  },
});
