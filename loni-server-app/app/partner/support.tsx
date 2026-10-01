import React from 'react';
import { View, Pressable, Linking, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { SUPPORT_PHONE, SUPPORT_EMAIL } from '../../lib/support';

export default function PartnerSupportScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="#000000" />
        </Pressable>
        <CalText style={styles.headerTitle}>Help & Support</CalText>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.iconCircle}>
            <Feather name="headphones" size={22} color="#FFA722" />
          </View>
          <View style={styles.rowText}>
            <HelixaText style={styles.rowTitle} weight="black">LONI Partner Support</HelixaText>
            <HelixaText style={styles.rowSubtitle}>Available 24/7 for active trips</HelixaText>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.callButton} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}>
            <Feather name="phone-call" size={20} color="#FFFFFF" />
            <HelixaText style={styles.callButtonText} weight="bold">Call Support</HelixaText>
          </Pressable>
          <Pressable style={styles.emailButton} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            <Feather name="mail" size={20} color="#6B6B6B" />
            <HelixaText style={styles.emailButtonText} weight="bold">Email Us</HelixaText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 21, paddingTop: 16,
  },
  backButton: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, color: '#000000' },
  content: { paddingHorizontal: 21, paddingTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 20 },
  iconCircle: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,167,34,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { gap: 6 },
  rowTitle: { fontSize: 16, color: '#000000' },
  rowSubtitle: { fontSize: 14, color: '#000000' },
  actions: { flexDirection: 'row', gap: 8 },
  callButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFA722', borderRadius: 36, paddingHorizontal: 22, paddingVertical: 13,
    shadowColor: '#101828', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1,
  },
  callButtonText: { fontSize: 14, color: '#FFFFFF' },
  emailButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: '#CED2D8', borderRadius: 36, paddingHorizontal: 22, paddingVertical: 13,
  },
  emailButtonText: { fontSize: 14, color: '#6B6B6B' },
});
