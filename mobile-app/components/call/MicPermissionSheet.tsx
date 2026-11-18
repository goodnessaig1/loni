import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { recheckMicrophonePermission, retryMicrophonePermission, useMicGate } from '../../lib/micPermission';
import { openAppSettings } from '../../lib/permissions';

/**
 * Explains a missing microphone permission and offers the one action that can fix it:
 *  - denied (the OS will still prompt): "Allow microphone" -> the OS prompt again, once per tap;
 *  - blocked (the OS will not prompt):   "Open Settings", re-checked as soon as the app is back.
 * Or carry on muted, or cancel. Rendered as an overlay inside whichever call Modal is showing (or a
 * Modal of its own when none is), never as a second stacked Modal.
 *
 * Same file in mobile-app and loni-server-app.
 */
export function MicPermissionSheet() {
  const open = useMicGate((s) => s.open);
  const status = useMicGate((s) => s.status);
  const purpose = useMicGate((s) => s.purpose);
  const finish = useMicGate((s) => s.finish);
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  // Back from Settings (or from the OS prompt): pick up a grant without another tap.
  useEffect(() => {
    if (!open) return;
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') recheckMicrophonePermission(); });
    return () => sub.remove();
  }, [open]);

  if (!open) return null;

  const blocked = status === 'blocked';
  const title = 'Microphone access is off';
  const body = blocked
    ? 'LONI cannot use your microphone, so the other person will not hear you. Turn on Microphone for LONI in Settings, then come back.'
    : 'LONI needs your microphone so the other person can hear you. You can allow it now.';
  const goOnLabel = purpose === 'unmute' ? 'Not now' : purpose === 'answer' ? 'Answer muted' : 'Call muted';

  const allow = async () => {
    if (blocked) {
      openAppSettings();
      return;
    }
    setBusy(true);
    try { await retryMicrophonePermission(); } finally { setBusy(false); }
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.backdrop} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} accessibilityViewIsModal>
        <View style={styles.icon}><Feather name="mic-off" size={26} color="#FFF" /></View>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <Pressable style={[styles.primary, busy && { opacity: 0.6 }]} disabled={busy} onPress={allow} accessibilityRole="button">
          <Text style={styles.primaryText}>{blocked ? 'Open Settings' : 'Allow microphone'}</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => finish(purpose === 'unmute' ? 'cancelled' : 'muted')} accessibilityRole="button">
          <Text style={styles.secondaryText}>{goOnLabel}</Text>
        </Pressable>
        {purpose !== 'unmute' && (
          <Pressable style={styles.secondary} onPress={() => finish('cancelled')} accessibilityRole="button">
            <Text style={[styles.secondaryText, { color: '#FCA5A5' }]}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#0F172A',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 24, paddingHorizontal: 24, alignItems: 'center',
  },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  title: { color: '#FFF', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  body: { color: '#CBD5E1', fontSize: 15, lineHeight: 21, textAlign: 'center', marginBottom: 20 },
  primary: { alignSelf: 'stretch', minHeight: 52, borderRadius: 26, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  secondary: { alignSelf: 'stretch', minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  secondaryText: { color: '#E2E8F0', fontSize: 16, fontWeight: '600' },
});
