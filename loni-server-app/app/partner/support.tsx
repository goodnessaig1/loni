import React from 'react';
import { View, Pressable, Linking, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { SupportIcon } from '../../components/icons/SupportIcon';
import { SUPPORT_PHONE, SUPPORT_EMAIL } from '../../lib/support';

export default function PartnerSupportScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <Feather name="chevron-left" size={24} color="#000000" />
        </Pressable>
        <CalText style={styles.headerTitle}>Help & Support</CalText>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.iconCircle}>
              <SupportIcon size={26} color="#FFA722" />
            </View>
            <View style={styles.rowText}>
              <HelixaText style={styles.rowTitle} weight="black">LONI Partner Support</HelixaText>
              <HelixaText style={styles.rowSubtitle}>Available 24/7 for active trips</HelixaText>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.callButton} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}>
              <Feather name="phone-call" size={18} color="#FFFFFF" />
              <HelixaText style={styles.callButtonText} weight="bold">Call Support</HelixaText>
            </Pressable>
            <Pressable style={styles.emailButton} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
              <Feather name="mail" size={18} color="#6B6B6B" />
              <HelixaText style={styles.emailButtonText} weight="bold">Email Us</HelixaText>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 21,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, color: '#000000' },
  content: { paddingHorizontal: 21, paddingTop: 16 },
  card: { gap: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF5E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { gap: 4, flex: 1 },
  rowTitle: { fontSize: 16, color: '#000000' },
  rowSubtitle: { fontSize: 13, color: '#6B6B6B' },
  actions: { flexDirection: 'row', gap: 12 },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFA722',
    borderRadius: 36,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  callButtonText: { fontSize: 14, color: '#FFFFFF' },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 36,
    paddingHorizontal: 22,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
  },
  emailButtonText: { fontSize: 14, color: '#475467' },
});
