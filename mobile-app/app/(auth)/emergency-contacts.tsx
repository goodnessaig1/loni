import React from 'react';
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

const ContactSchema = Yup.object().shape({
  contacts: Yup.array().of(
    Yup.object().shape({
      name: Yup.string().required('Name is required'),
      phone: Yup.string().required('Phone number is required'),
      relationship: Yup.string().required('Relationship is required'),
    })
  ).min(1, 'At least one contact is required'),
});

export default function EmergencyContactsScreen() {
  const handleContactsSubmit = (values: any, { setSubmitting }: any) => {
    setTimeout(() => {
      setSubmitting(false);
      router.replace('/(auth)/success');
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color="black" />
          </Pressable>

          <CalText style={styles.heading}>Emergency Contacts</CalText>
          <HelixaText style={styles.subtext}>
            We'll notify these people if you request emergency help
          </HelixaText>

          <Formik
            initialValues={{ contacts: [{ name: '', phone: '', relationship: '' }] }}
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
                        <View key={index} style={styles.formContainer}>
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
                              placeholderTextColor="#9CA3AF"
                              value={contact.name}
                              onChangeText={handleChange(`contacts.${index}.name`)}
                              onBlur={handleBlur(`contacts.${index}.name`)}
                            />
                            {contactTouched.name && contactErrors.name && (
                              <HelixaText style={styles.errorText}>{contactErrors.name}</HelixaText>
                            )}
                          </View>

                          <View style={styles.inputGroup}>
                            <HelixaText style={styles.inputLabel} weight="bold">Phone number</HelixaText>
                            <TextInput
                              style={[styles.input, contactTouched.phone && contactErrors.phone ? styles.inputError : null]}
                              placeholder="Enter phone number"
                              placeholderTextColor="#9CA3AF"
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
                              placeholderTextColor="#9CA3AF"
                              value={contact.relationship}
                              onChangeText={handleChange(`contacts.${index}.relationship`)}
                              onBlur={handleBlur(`contacts.${index}.relationship`)}
                            />
                            {contactTouched.relationship && contactErrors.relationship && (
                              <HelixaText style={styles.errorText}>{contactErrors.relationship}</HelixaText>
                            )}
                          </View>
                        </View>
                      );
                    })}

                    <Pressable style={styles.addAnotherButton} onPress={() => push({ name: '', phone: '', relationship: '' })}>
                      <Feather name="plus" size={16} color="#D62D88" />
                      <HelixaText style={styles.addAnotherText}>Add another contact</HelixaText>
                    </Pressable>

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
    fontSize: 26,
    lineHeight: 32,
    color: '#000000',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 32,
  },
  formContainer: {
    borderWidth: 1,
    backgroundColor: "#FAFAFA",
    borderColor: '#E5E5E5',
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
    backgroundColor: '#F9C2D9',
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
    color: '#6B7280',
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
