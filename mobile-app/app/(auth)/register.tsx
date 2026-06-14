import React, { useState } from 'react';
import { 
  View, 
  Pressable, 
  TextInput, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  Text
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { Button } from '../../components/Button';

const validationSchema = Yup.object().shape({
  name: Yup.string().required('Name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 chars').required('Password is required'),
  status: Yup.string().oneOf(['pregnant', 'newMom']).required('Please select your current status'),
  trimester: Yup.string().when('status', {
    is: 'pregnant',
    then: (schema) => schema.required('Please select your trimester'),
    otherwise: (schema) => schema.notRequired(),
  }),
  pregnancyWeek: Yup.string().when('status', {
    is: 'pregnant',
    then: (schema) => schema.required('Please select your pregnancy week'),
    otherwise: (schema) => schema.notRequired(),
  }),
  babyAge: Yup.string().when('status', {
    is: 'newMom',
    then: (schema) => schema.required('Please enter your baby\'s age'),
    otherwise: (schema) => schema.notRequired(),
  }),
});

const getWeeksForTrimester = (trimester: string) => {
  if (trimester === '1st') return Array.from({ length: 12 }, (_, i) => String(i + 1));
  if (trimester === '2nd') return Array.from({ length: 15 }, (_, i) => String(i + 13));
  if (trimester === '3rd') return Array.from({ length: 15 }, (_, i) => String(i + 28)); // 28 to 42
  return [];
};

export default function RegisterScreen() {
  return (
    <Formik
      initialValues={{ name: '', email: '', password: '', status: '', trimester: '', pregnancyWeek: '', babyAge: '' }}
      validationSchema={validationSchema}
      onSubmit={(values, { setSubmitting }) => {
        console.log('Form Submitted:', values);
        setTimeout(() => {
          setSubmitting(false);
          router.push({ pathname: '/(auth)/verify', params: { email: values.email } } as any);
        }, 1500);
      }}
    >
      {({ handleChange, handleBlur, handleSubmit, setFieldValue, values, errors, touched, isValid, dirty, isSubmitting }) => (
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              
              <Pressable onPress={() => router.back()} style={styles.backButton}>
                <Feather name="chevron-left" size={28} color="black" />
              </Pressable>

              <CalText style={styles.heading}>Let's set up your profile</CalText>
              <HelixaText style={styles.subtext}>This helps us provide the right support for your journey.</HelixaText>

              <View style={styles.inputContainer}>
                <HelixaText style={styles.inputLabel} weight="bold">Your name</HelixaText>
                <TextInput 
                  placeholder="Enter your name" 
                  style={[styles.input, touched.name && errors.name && styles.inputError]} 
                  onChangeText={handleChange('name')}
                  onBlur={handleBlur('name')}
                  value={values.name}
                  placeholderTextColor="#9CA3AF"
                />
                {touched.name && errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <HelixaText style={styles.inputLabel} weight="bold">Email</HelixaText>
                <TextInput 
                  placeholder="Enter your email" 
                  style={[styles.input, touched.email && errors.email && styles.inputError]} 
                  keyboardType="email-address" 
                  autoCapitalize="none"
                  onChangeText={handleChange('email')}
                  onBlur={handleBlur('email')}
                  value={values.email}
                  placeholderTextColor="#9CA3AF"
                />
                {touched.email && errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <HelixaText style={styles.inputLabel} weight="bold">Password</HelixaText>
                <TextInput 
                  placeholder="Create a password" 
                  style={[styles.input, touched.password && errors.password && styles.inputError]} 
                  secureTextEntry 
                  onChangeText={handleChange('password')}
                  onBlur={handleBlur('password')}
                  value={values.password}
                  placeholderTextColor="#9CA3AF"
                />
                {touched.password && errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              <View style={styles.statusSection}>
                <HelixaText style={styles.inputLabel} weight="bold">I am currently</HelixaText>
                
                <View style={styles.statusRow}>
                  {/* Pregnant Option */}
                  <Pressable 
                    style={[styles.statusBox, values.status === 'pregnant' && styles.statusBoxSelected]}
                    onPress={() => {
                      setFieldValue('status', 'pregnant');
                      setFieldValue('babyAge', ''); // clear other state
                    }}
                  >
                    <View style={styles.statusHeader}>
                      <HelixaText style={styles.statusTitle} weight="bold">Pregnant</HelixaText>
                      <View style={[styles.radioEmpty, values.status === 'pregnant' && styles.radioSelected]}>
                        {values.status === 'pregnant' && <View style={styles.radioInner} />}
                      </View>
                    </View>
                    <HelixaText style={styles.statusSubtitle}>Currently expecting</HelixaText>
                  </Pressable>

                  {/* New Mom Option */}
                  <Pressable 
                    style={[styles.statusBox, values.status === 'newMom' && styles.statusBoxSelected]}
                    onPress={() => {
                      setFieldValue('status', 'newMom');
                      setFieldValue('trimester', ''); // clear other state
                      setFieldValue('pregnancyWeek', '');
                    }}
                  >
                    <View style={styles.statusHeader}>
                      <HelixaText style={styles.statusTitle} weight="bold">A new mom</HelixaText>
                      <View style={[styles.radioEmpty, values.status === 'newMom' && styles.radioSelected]}>
                        {values.status === 'newMom' && <View style={styles.radioInner} />}
                      </View>
                    </View>
                    <HelixaText style={styles.statusSubtitle}>0-8 weeks postpartum</HelixaText>
                  </Pressable>
                </View>
                {touched.status && errors.status && <Text style={styles.errorText}>{errors.status}</Text>}
              </View>

              {/* Conditional Field: Trimester */}
              {values.status === 'pregnant' && (
                <View style={styles.conditionalSection}>
                  <HelixaText style={styles.inputLabelSubtitle}>Which trimester are you in?</HelixaText>
                  <View style={styles.trimesterRow}>
                    {['1st', '2nd', '3rd'].map((trim) => (
                      <Pressable 
                        key={trim}
                        style={[styles.trimesterBox, values.trimester === trim && styles.statusBoxSelected]}
                        onPress={() => {
                          setFieldValue('trimester', trim);
                          setFieldValue('pregnancyWeek', '');
                        }}
                      >
                        <HelixaText style={styles.statusTitle} weight={values.trimester === trim ? 'bold' : 'regular'}>{trim}</HelixaText>
                        <View style={[styles.radioEmpty, values.trimester === trim && styles.radioSelected]}>
                          {values.trimester === trim && <View style={styles.radioInner} />}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                  {touched.trimester && errors.trimester && <Text style={styles.errorText}>{errors.trimester as string}</Text>}

                  {values.trimester ? (
                    <View style={styles.weekSection}>
                      <HelixaText style={styles.inputLabelSubtitle}>Which week?</HelixaText>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekScrollContent}>
                        {getWeeksForTrimester(values.trimester).map((week) => (
                          <Pressable
                            key={week}
                            style={[
                              styles.weekBox,
                              values.pregnancyWeek === week && styles.weekBoxSelected
                            ]}
                            onPress={() => setFieldValue('pregnancyWeek', week)}
                          >
                            <HelixaText 
                              style={[styles.weekText, values.pregnancyWeek === week && styles.weekTextSelected]}
                              weight={values.pregnancyWeek === week ? 'bold' : 'regular'}
                            >
                              Week {week}
                            </HelixaText>
                          </Pressable>
                        ))}
                      </ScrollView>
                      {touched.pregnancyWeek && errors.pregnancyWeek && <Text style={styles.errorText}>{errors.pregnancyWeek as string}</Text>}
                    </View>
                  ) : null}
                </View>
              )}

              {/* Conditional Field: Baby Age */}
              {values.status === 'newMom' && (
                <View style={styles.conditionalSection}>
                  <HelixaText style={styles.inputLabelSubtitle}>How old is your baby? (in weeks)</HelixaText>
                  <TextInput 
                    placeholder="e.g., 2 weeks, 3 weeks" 
                    style={[styles.input, touched.babyAge && errors.babyAge && styles.inputError]}
                    onChangeText={handleChange('babyAge')}
                    onBlur={handleBlur('babyAge')}
                    value={values.babyAge}
                    placeholderTextColor="#9CA3AF"
                  />
                  {touched.babyAge && errors.babyAge && <Text style={styles.errorText}>{errors.babyAge}</Text>}
                </View>
              )}

              <Button 
                title="Continue"
                onPress={handleSubmit as any}
                isLoading={isSubmitting}
                disabled={!(isValid && dirty && values.status)}
              />

              <Pressable style={styles.switchModeContainer} onPress={() => router.replace('/(auth)/login')}>
                <HelixaText style={styles.switchModeText}>
                  Already have an account? <HelixaText style={styles.switchModeHighlight} weight="bold">Sign in</HelixaText>
                </HelixaText>
              </Pressable>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      )}
    </Formik>
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
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    color: '#000000',
    marginBottom: 8,
  },
  inputLabelSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 12,
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
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  statusSection: {
    marginTop: 8,
    marginBottom: 24, 
  },
  conditionalSection: {
    marginBottom: 40,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
  },
  trimesterRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statusBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  trimesterBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  statusBoxSelected: {
    // No border or background color for selected state
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 15,
    color: '#000000',
  },
  statusSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  radioEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#D62D88',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D62D88',
  },
  continueButton: {
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
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
  weekSection: {
    marginTop: 24,
  },
  weekScrollContent: {
    gap: 10,
    paddingVertical: 4,
  },
  weekBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  weekBoxSelected: {
    backgroundColor: '#D62D88',
    borderColor: '#D62D88',
  },
  weekText: {
    fontSize: 14,
    color: '#374151',
  },
  weekTextSelected: {
    color: '#FFFFFF',
  },
});
