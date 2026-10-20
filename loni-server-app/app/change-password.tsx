import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import Toast from 'react-native-toast-message';
import { HelixaText } from '../components/HelixaText';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { useChangePassword } from '../hooks/useAuth';
import { Reveal } from '../components/motion';

const Schema = Yup.object().shape({
  oldPassword: Yup.string().required('Current password is required'),
  newPassword: Yup.string().min(8, 'Password must be at least 8 characters').required('New password is required')
    .notOneOf([Yup.ref('oldPassword')], 'Choose a password different from your current one'),
  confirmPassword: Yup.string().oneOf([Yup.ref('newPassword')], 'Passwords do not match').required('Please confirm your new password'),
});

function PasswordField({ label, value, onChange, onBlur, error }: {
  label: string; value: string; onChange: (t: string) => void; onBlur: () => void; error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginBottom: 18 }}>
      <HelixaText weight="bold" style={styles.label}>{label}</HelixaText>
      <View style={[styles.inputWrap, !!error && { borderColor: '#EF4444' }]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          secureTextEntry={!show}
          autoCapitalize="none"
          placeholder="••••••••"
          placeholderTextColor="#9CA3AF"
        />
        <Pressable onPress={() => setShow((s) => !s)} hitSlop={8}>
          <Feather name={show ? 'eye-off' : 'eye'} size={18} color="#6B7280" />
        </Pressable>
      </View>
      {!!error && <HelixaText style={styles.error}>{error}</HelixaText>}
    </View>
  );
}

export default function ChangePasswordScreen() {
  const { mutateAsync, isPending } = useChangePassword();
  const f = useFormik({
    initialValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
    validationSchema: Schema,
    onSubmit: async (v, { setFieldError }) => {
      try {
        await mutateAsync({ old_password: v.oldPassword, new_password: v.newPassword });
        Toast.show({ type: 'success', text1: 'Password updated' });
        router.back();
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || 'Could not change your password.';
        if (/incorrect|current/i.test(msg)) setFieldError('oldPassword', msg);
        else Toast.show({ type: 'error', text1: 'Error', text2: msg });
      }
    },
  });
  const err = (k: keyof typeof f.values) => (f.touched[k] ? f.errors[k] : undefined);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Reveal index={0}>
        <ScreenHeader title="Change Password" />
      </Reveal>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Reveal index={1}>
            <HelixaText style={styles.hint}>Your new password must be at least 8 characters and different from your current one.</HelixaText>
          </Reveal>
          <Reveal index={2}>
            <PasswordField label="Current Password" value={f.values.oldPassword} onChange={f.handleChange('oldPassword')} onBlur={() => f.setFieldTouched('oldPassword')} error={err('oldPassword')} />
          </Reveal>
          <Reveal index={3}>
            <PasswordField label="New Password" value={f.values.newPassword} onChange={f.handleChange('newPassword')} onBlur={() => f.setFieldTouched('newPassword')} error={err('newPassword')} />
          </Reveal>
          <Reveal index={4}>
            <PasswordField label="Confirm New Password" value={f.values.confirmPassword} onChange={f.handleChange('confirmPassword')} onBlur={() => f.setFieldTouched('confirmPassword')} error={err('confirmPassword')} />
          </Reveal>
          <Reveal index={5}>
            <Button title={isPending ? 'Updating…' : 'Update Password'} onPress={() => f.handleSubmit()} disabled={isPending} style={{ marginTop: 12 }} />
          </Reveal>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 21, paddingTop: 12, paddingBottom: 40 },
  hint: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 24 },
  label: { fontSize: 14, color: '#111827', marginBottom: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, height: 52, backgroundColor: '#F9FAFB',
  },
  input: { flex: 1, fontSize: 15, color: '#111827' },
  error: { color: '#EF4444', fontSize: 12, marginTop: 6 },
});
