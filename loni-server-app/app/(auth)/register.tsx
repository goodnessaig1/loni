import React, { useState } from 'react';
import { 
  View, 
  Pressable, 
  TextInput, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  Text,
  TouchableOpacity
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { Button } from '../../components/Button';
import { Reveal } from '../../components/motion';
import { useRegister } from '../../hooks/useAuth';

const validationSchema = Yup.object().shape({
  name: Yup.string().required('Name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
  phone: Yup.string().required('Phone number is required'),
  password: Yup.string().min(8, 'Password must be at least 8 chars').required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm Password is required'),
  agreedToTerms: Yup.boolean().oneOf([true], 'You must agree to the Terms of Service'),
});

export default function RegisterScreen() {
  const { mutateAsync: registerUser } = useRegister();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <Formik
      initialValues={{ name: '', email: '', phone: '', password: '', confirmPassword: '', agreedToTerms: false }}
      validationSchema={validationSchema}
      onSubmit={async (values, { setSubmitting, setFieldError }) => {
        try {
          await registerUser({
            name: values.name,
            email: values.email,
            password: values.password,
            phone: values.phone,
          } as any);

          router.push({ pathname: '/(auth)/verify', params: { email: values.email } } as any);
        } catch (error: any) {
          console.error('Registration failed:', error.response?.data || error.message);
          const errData = error.response?.data;
          if (errData?.errors && Array.isArray(errData.errors)) {
            errData.errors.forEach((err: any) => {
              if (err.path) {
                setFieldError(err.path, err.message);
              }
            });
          } else {
            setFieldError('email', errData?.message || errData?.error || 'Registration failed');
          }
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ handleChange, handleBlur, handleSubmit, setFieldValue, values, errors, touched, isValid, dirty, isSubmitting }) => (
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex1}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
              
              <Pressable onPress={() => router.back()} style={styles.backButton}>
                <Feather name="chevron-left" size={28} color="black" />
              </Pressable>

              <Reveal index={0}>
                <CalText style={styles.heading}>Create Account</CalText>
                <HelixaText style={styles.subtext}>Join LONI Server and start making a difference.</HelixaText>
              </Reveal>

              <Reveal index={1}>
                {/* Full Name */}
                <View style={styles.inputContainer}>
                  <HelixaText style={styles.inputLabel} weight="bold">Full Name</HelixaText>
                  <TextInput 
                    placeholder="Sarah Chen" 
                    style={[styles.input, touched.name && errors.name && styles.inputError]} 
                    onChangeText={handleChange('name')}
                    onBlur={handleBlur('name')}
                    value={values.name}
                    placeholderTextColor="#9CA3AF"
                  />
                  {touched.name && errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
                </View>

                {/* Email */}
                <View style={styles.inputContainer}>
                  <HelixaText style={styles.inputLabel} weight="bold">Email</HelixaText>
                  <TextInput 
                    placeholder="Sarahchen@example.com" 
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

                {/* Phone Number */}
                <View style={styles.inputContainer}>
                  <HelixaText style={styles.inputLabel} weight="bold">Phone Number</HelixaText>
                  <TextInput 
                    placeholder="+1 (555) 234 - 5678" 
                    style={[styles.input, touched.phone && errors.phone && styles.inputError]} 
                    keyboardType="phone-pad"
                    onChangeText={handleChange('phone')}
                    onBlur={handleBlur('phone')}
                    value={values.phone}
                    placeholderTextColor="#9CA3AF"
                  />
                  {touched.phone && errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
                </View>

                {/* Password */}
                <View style={styles.inputContainer}>
                  <HelixaText style={styles.inputLabel} weight="bold">Password</HelixaText>
                  <View style={styles.passwordContainer}>
                    <TextInput 
                      placeholder="Min. 8 characters" 
                      style={[styles.input, styles.passwordInput, touched.password && errors.password && styles.inputError]} 
                      secureTextEntry={!showPassword} 
                      onChangeText={handleChange('password')}
                      onBlur={handleBlur('password')}
                      value={values.password}
                      placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                      <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  {touched.password && errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
                </View>

                {/* Confirm Password */}
                <View style={styles.inputContainer}>
                  <HelixaText style={styles.inputLabel} weight="bold">Confirm Password</HelixaText>
                  <View style={styles.passwordContainer}>
                    <TextInput 
                      placeholder="Re-enter password" 
                      style={[styles.input, styles.passwordInput, touched.confirmPassword && errors.confirmPassword && styles.inputError]} 
                      secureTextEntry={!showConfirmPassword} 
                      onChangeText={handleChange('confirmPassword')}
                      onBlur={handleBlur('confirmPassword')}
                      value={values.confirmPassword}
                      placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                      <Feather name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  {touched.confirmPassword && errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
                </View>
              </Reveal>

              <Reveal index={2}>
                {/* Terms Checkbox */}
                <View style={styles.checkboxContainer}>
                  <TouchableOpacity 
                    style={styles.checkbox} 
                    onPress={() => setFieldValue('agreedToTerms', !values.agreedToTerms)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radioEmpty, values.agreedToTerms && styles.radioSelected]}>
                      {values.agreedToTerms && <View style={styles.radioInner} />}
                    </View>
                    <HelixaText style={styles.checkboxText}>
                      I agree to the <HelixaText style={styles.pinkLink} onPress={() => {}}>Terms of Service</HelixaText> and <HelixaText style={styles.pinkLink} onPress={() => {}}>Privacy Policy</HelixaText>
                    </HelixaText>
                  </TouchableOpacity>
                  {touched.agreedToTerms && errors.agreedToTerms && <Text style={styles.errorText}>{errors.agreedToTerms as string}</Text>}
                </View>

                <Button 
                  title="Create Account"
                  onPress={handleSubmit as any}
                  isLoading={isSubmitting}
                  disabled={!(isValid && dirty)}
                  style={{ marginTop: 10 }}
                />

                <Pressable style={styles.switchModeContainer} onPress={() => router.replace('/(auth)/login')}>
                  <HelixaText style={styles.switchModeText}>
                    Already have an account? <HelixaText style={styles.switchModeHighlight} weight="bold">Sign in</HelixaText>
                  </HelixaText>
                </Pressable>
              </Reveal>

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
    marginBottom: 16,
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
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Helvetica Neue',
    backgroundColor: '#FAF8F8', // Slightly grey background as in mockup
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50, // Space for the eye icon
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
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
  checkboxContainer: {
    marginBottom: 24,
    marginTop: 8,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxText: {
    fontSize: 14,
    color: '#000000',
    marginLeft: 12,
    flex: 1,
  },
  pinkLink: {
    color: '#D62D88',
  },
  radioEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
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
});
