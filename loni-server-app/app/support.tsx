import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, ScrollView, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { HelixaText } from '../components/HelixaText';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ScreenHeader';
import { SelectModal } from '../components/SelectModal';
import { useAuth } from '../hooks/useAuth';
import { useContactSupport, useSupportInfo } from '../hooks/useAccount';

/** Figma "Support": a message form, plus how to reach the team directly. Shared by every role. */
export default function SupportScreen() {
  const { user } = useAuth();
  const { data: info } = useSupportInfo();
  const send = useContactSupport();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [picking, setPicking] = useState(false);

  const canSend = subject.length > 0 && message.trim().length >= 5 && !send.isPending;

  const submit = () => {
    send.mutate({ subject, message: message.trim(), name: name.trim() || undefined, email: email.trim() || undefined }, {
      onSuccess: (res) => {
        Toast.show({ type: 'success', text1: 'Message sent', text2: res.message });
        router.back();
      },
      onError: (e: any) => Toast.show({ type: 'error', text1: 'Could not send', text2: e?.response?.data?.message || 'Please try again.' }),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Support" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <HelixaText weight="bold" style={styles.label}>Your Name</HelixaText>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#9CA3AF" />

          <HelixaText weight="bold" style={styles.label}>Email Address</HelixaText>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor="#9CA3AF" />

          <HelixaText weight="bold" style={styles.label}>Subject</HelixaText>
          <Pressable style={[styles.input, styles.select]} onPress={() => setPicking(true)}>
            <HelixaText style={{ color: subject ? '#111827' : '#9CA3AF', fontSize: 15 }}>{subject || 'Select a topic'}</HelixaText>
            <Feather name="chevron-down" size={18} color="#6B7280" />
          </Pressable>

          <HelixaText weight="bold" style={styles.label}>Message</HelixaText>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={4000}
            placeholder="How can we help?"
            placeholderTextColor="#9CA3AF"
          />

          <Button title={send.isPending ? 'Sending…' : 'Send Message'} onPress={submit} disabled={!canSend} style={{ marginTop: 8 }} />

          <View style={styles.contactCard}>
            <HelixaText weight="bold" style={styles.contactTitle}>Other Ways to Reach Us</HelixaText>
            {!!info?.email && (
              <Pressable style={styles.contactRow} onPress={() => Linking.openURL(`mailto:${info.email}`)}>
                <Feather name="mail" size={16} color="#D62D88" />
                <HelixaText style={styles.contactText}>{info.email}</HelixaText>
              </Pressable>
            )}
            {!!info?.phone && (
              <Pressable style={styles.contactRow} onPress={() => Linking.openURL(`tel:${info.phone.replace(/\s/g, '')}`)}>
                <Feather name="phone" size={16} color="#D62D88" />
                <HelixaText style={styles.contactText}>{info.phone}</HelixaText>
              </Pressable>
            )}
            {!!info?.hours && (
              <View style={styles.contactRow}>
                <Feather name="clock" size={16} color="#D62D88" />
                <HelixaText style={styles.contactText}>{info.hours}</HelixaText>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectModal
        visible={picking}
        title="Subject"
        options={(info?.subjects ?? ['General question', 'Report a problem', 'Other']).map((s) => ({ label: s, value: s }))}
        selectedValue={subject}
        onSelect={(v: string) => { setSubject(v); setPicking(false); }}
        onClose={() => setPicking(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: 21, paddingTop: 12, paddingBottom: 48 },
  label: { fontSize: 14, color: '#111827', marginBottom: 8, marginTop: 6 },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, height: 52,
    backgroundColor: '#F9FAFB', fontSize: 15, color: '#111827', marginBottom: 12,
  },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textarea: { height: 130, paddingTop: 14, textAlignVertical: 'top' },
  contactCard: { marginTop: 28, borderRadius: 14, borderWidth: 1, borderColor: '#F0F0F0', padding: 16, gap: 14 },
  contactTitle: { fontSize: 15, color: '#111827' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactText: { fontSize: 14, color: '#374151' },
});
