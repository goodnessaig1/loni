import React, { useState, useMemo } from 'react';
import {
  View,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Formik, FieldArray } from 'formik';
import * as Yup from 'yup';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { emergencyContactsApi } from '../../api/emergencyContacts';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';
import type { Palette } from '../../lib/theme';
import { Reveal, RevealList } from '../../components/motion';

const ContactSchema = Yup.object().shape({
  contacts: Yup.array().of(
    Yup.object().shape({
      name: Yup.string().required('Name is required'),
      phone: Yup.string().required('Phone number is required'),
      email: Yup.string().email('Invalid email address').required('Email is required'),
      relationship: Yup.string().required('Relationship is required'),
    })
  ).min(1, 'At least one contact is required'),
});

export default function EmergencyContactsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContactsSubmit = async (values: any, { setSubmitting }: any) => {
    try {
      setSubmitting(true);
      await emergencyContactsApi.addContacts(values.contacts);
      router.replace('/(auth)/success');
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to save emergency contacts',
      });
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

          <CalText style={styles.heading}>Emergency Contacts</CalText>
          <HelixaText style={styles.subtext}>
            We'll notify these people if you request emergency help
          </HelixaText>
          </Reveal>

          <Formik
            initialValues={{ contacts: [{ name: '', phone: '', email: '', relationship: '' }] }}
            validationSchema={ContactSchema}
            onSubmit={handleContactsSubmit}
          >
            {({ handleChange, handleBlur, handleSubmit, values, errors, touched, isValid, dirty, isSubmitting }) => (
              <FieldArray name="contacts">
                {({ push, remove }) => (
                  <>
                    {values.contacts.map((contact, index) => {
                      const contactErrors = (errors.contacts?.[index] as any) || {};
                      const contactTouched = (touched.contacts?.[index] as any) || {};

                      return (
                        <RevealList key={index} index={index + 1}>
                        <View style={styles.formContainer}>
                          {values.contacts.length > 1 && (
                            <Pressable onPress={() => remove(index)} style={styles.removeContactButton}>
                              <Feather name="trash-2" size={16} color="#EF4444" />
                            </Pressable>
                          )}
                          <View style={styles.inputGroup}>
                            <HelixaText style={styles.inputLabel} weight="bold">Name</HelixaText>
                            <TextInput
                              style={[styles.input, contactTouched.name && contactErrors.name ? styles.inputError : null]}
                              placeholder="Enter name"
                              placeholderTextColor={colors.textMuted}
                              value={contact.name}
                              onChangeText={handleChange(`contacts.${index}.name`)}
                              onBlur={handleBlur(`contacts.${index}.name`)}
                            />
                            {contactTouched.name && contactErrors.name && (
                              <HelixaText style={styles.errorText}>{contactErrors.name}</HelixaText>
                            )}
                          </View>

                          <View style={styles.inputGroup}>
                            <HelixaText style={styles.inputLabel} weight="bold">Email address</HelixaText>
                            <TextInput
                              style={[styles.input, contactTouched.email && contactErrors.email ? styles.inputError : null]}
                              placeholder="Enter email address"
                              placeholderTextColor={colors.textMuted}
                              keyboardType="email-address"
                              autoCapitalize="none"
                              value={contact.email}
                              onChangeText={handleChange(`contacts.${index}.email`)}
                              onBlur={handleBlur(`contacts.${index}.email`)}
                            />
                            {contactTouched.email && contactErrors.email && (
                              <HelixaText style={styles.errorText}>{contactErrors.email}</HelixaText>
                            )}
                          </View>

                          <View style={styles.inputGroup}>
                            <HelixaText style={styles.inputLabel} weight="bold">Phone number</HelixaText>
                            <TextInput
                              style={[styles.input, contactTouched.phone && contactErrors.phone ? styles.inputError : null]}
                              placeholder="Enter phone number"
                              placeholderTextColor={colors.textMuted}
                              keyboardType="phone-pad"
                              value={contact.phone}
                              onChangeText={handleChange(`contacts.${index}.phone`)}
                              onBlur={handleBlur(`contacts.${index}.phone`)}
                            />
                            {contactTouched.phone && contactErrors.phone && (
                              <HelixaText style={styles.errorText}>{contactErrors.phone}</HelixaText>
                            )}
                          </View>

                          <View style={styles.inputGroup}>
                            <HelixaText style={styles.inputLabel} weight="bold">Relationship</HelixaText>
                            <TextInput
                              style={[styles.input, contactTouched.relationship && contactErrors.relationship ? styles.inputError : null]}
                              placeholder="e.g., Partner, Mother"
                              placeholderTextColor={colors.textMuted}
                              value={contact.relationship}
                              onChangeText={handleChange(`contacts.${index}.relationship`)}
                              onBlur={handleBlur(`contacts.${index}.relationship`)}
                            />
                            {contactTouched.relationship && contactErrors.relationship && (
                              <HelixaText style={styles.errorText}>{contactErrors.relationship}</HelixaText>
                            )}
                          </View>
                        </View>
                        </RevealList>
                      );
                    })}

                    <Reveal index={2}>
                    <Pressable style={styles.addAnotherButton} onPress={() => push({ name: '', phone: '', email: '', relationship: '' })}>
                      <Feather name="plus" size={16} color="#D62D88" />
                      <HelixaText style={styles.addAnotherText}>Add another contact</HelixaText>
                    </Pressable>
                    </Reveal>

                    <Reveal index={3}>
                    <View style={styles.footer}>
                      <Button 
                        title="Continue"
                        onPress={handleSubmit as any}
                        isLoading={isSubmitting}
                        disabled={!(isValid && dirty)}
                      />

                      <Pressable
                        style={styles.skipButton}
                        onPress={() => router.replace('/(auth)/success')}
                      >
                        <HelixaText style={styles.skipButtonText} weight="bold">Skip for now</HelixaText>
                      </Pressable>
                    </View>
                    </Reveal>
                  </>
                )}
              </FieldArray>
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
    fontSize: 26,
    lineHeight: 32,
    color: c.text,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 15,
    color: c.textSecondary,
    lineHeight: 22,
    marginBottom: 32,
  },
  formContainer: {
    borderWidth: 1,
    backgroundColor: "#FAFAFA",
    borderColor: c.border,
    borderStyle: 'solid',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
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
  },
  addAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 40,
  },
  addAnotherText: {
    color: '#D62D88',
    fontSize: 15,
  },
  footer: {
    gap: 16,
  },
  removeContactButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
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
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: c.textSecondary,
    fontSize: 15,
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
