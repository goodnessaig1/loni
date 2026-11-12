import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalText } from '../CalText';
import { HelixaText } from '../HelixaText';
import { ModalKeyboardAvoid } from '../KeyboardAvoid';
import { REPORT_NOTE_MAX } from '../../api/community';
import { useReportPost, useReportReasons } from '../../hooks/useCommunity';
import { useTheme } from '../../context/ThemeContext';

const PINK = '#C93A86';

interface Props {
  visible: boolean;
  postId: number;
  authorName: string;
  onClose: () => void;
}

/**
 * "Report post" card: pick a reason, optionally add a few words, send. Reports are anonymous: the author
 * is never told who reported them. Reporting the same post again just updates your reason.
 */
export function ReportModal({ visible, postId, authorName, onClose }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const reasons = useReportReasons(visible);
  const report = useReportPost();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [typing, setTyping] = useState(false);

  // Start fresh each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setReason(null);
      setNote('');
    }
  }, [visible]);

  const canSend = !!reason && !report.isPending;
  const close = () => !report.isPending && onClose();

  const submit = () => {
    if (!reason || report.isPending) return;
    report.mutate({ postId, reason, note }, { onSuccess: onClose });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <ModalKeyboardAvoid style={{ flex: 1, backgroundColor: colors.overlay }}>
        <Pressable
          onPress={close}
          style={{ flex: 1, justifyContent: typing ? 'flex-start' : 'center', paddingHorizontal: 22, paddingTop: insets.top + 12, paddingBottom: 12 }}>
          {/* Swallow touches so tapping inside the card doesn't dismiss it. */}
          <Pressable
            onPress={() => {}}
            style={{
              maxHeight: '100%', backgroundColor: colors.card, borderRadius: 22, padding: 22,
              shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 10,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
              <CalText style={{ fontSize: 22, color: colors.text }}>Report post</CalText>
              <TouchableOpacity onPress={close} hitSlop={12} accessibilityLabel="Close" disabled={report.isPending}>
                <Feather name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
              <HelixaText style={{ fontSize: 15, lineHeight: 22, color: colors.textSecondary, marginTop: 14 }}>
                Why are you reporting {authorName}&apos;s post? The LONI team will review it. {authorName} won&apos;t see who reported it.
              </HelixaText>

              <View accessibilityRole="radiogroup" style={{ marginTop: 14, gap: 8 }}>
                {reasons.map((r) => {
                  const selected = reason === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      onPress={() => setReason(r.key)}
                      disabled={report.isPending}
                      activeOpacity={0.75}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={r.label}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 14,
                        borderWidth: 1, borderColor: selected ? PINK : colors.border,
                        backgroundColor: selected ? (isDark ? '#3A1F2E' : '#FDF0F7') : colors.bgSoft,
                      }}>
                      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? PINK : colors.textMuted, alignItems: 'center', justifyContent: 'center' }}>
                        {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PINK }} />}
                      </View>
                      <HelixaText style={{ flex: 1, fontSize: 16, color: colors.text }}>{r.label}</HelixaText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                value={note}
                onChangeText={setNote}
                onFocus={() => setTyping(true)} // the card moves up so Send stays above the keyboard
                onBlur={() => setTyping(false)}
                placeholder="Anything else we should know? (optional)"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={REPORT_NOTE_MAX}
                editable={!report.isPending}
                textAlignVertical="top"
                accessibilityLabel="Add details to your report (optional)"
                style={{
                  marginTop: 14, minHeight: 84, maxHeight: 160, borderWidth: 1, borderColor: colors.border, borderRadius: 14,
                  padding: 14, fontSize: 15, lineHeight: 22, color: colors.text, fontFamily: 'Helixa-Regular', backgroundColor: colors.bgSoft,
                }}
              />
              {note.length > REPORT_NOTE_MAX - 80 && (
                <HelixaText style={{ alignSelf: 'flex-end', marginTop: 6, fontSize: 12, color: note.length >= REPORT_NOTE_MAX ? '#D62D88' : colors.textMuted }}>
                  {note.length}/{REPORT_NOTE_MAX}
                </HelixaText>
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                onPress={close}
                disabled={report.isPending}
                activeOpacity={0.7}
                style={{ flex: 1, height: 50, borderRadius: 25, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <HelixaText style={{ fontSize: 16, color: colors.textSecondary }}>Cancel</HelixaText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submit}
                disabled={!canSend}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSend }}
                accessibilityLabel="Send report"
                style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: PINK, opacity: canSend ? 1 : 0.45, alignItems: 'center', justifyContent: 'center' }}>
                {report.isPending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <HelixaText weight="bold" style={{ fontSize: 16, color: '#FFF' }}>Send report</HelixaText>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </ModalKeyboardAvoid>
    </Modal>
  );
}
