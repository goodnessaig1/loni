import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { HelixaText } from '../../components/HelixaText';
import { ModalKeyboardAvoid } from '../../components/KeyboardAvoid';
import { Reveal } from '../../components/motion';
import { useTheme } from '../../context/ThemeContext';
import { useCheckinPreferences, useMemoryFacts } from '../../hooks/useCheckins';
import type { MemoryFact } from '../../api/checkins';

/**
 * Everything Loni remembers about her, item by item, with where each came from. She can correct, mark as better,
 * or delete any item, and add things Loni should know (an allergy, a medicine, a condition).
 */

const GROUPS: { kinds: MemoryFact['kind'][]; title: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { kinds: ['allergy'], title: 'Allergies', icon: 'alert-octagon' },
  { kinds: ['condition'], title: 'Health history', icon: 'clipboard' },
  { kinds: ['medication'], title: 'Medicines', icon: 'package' },
  { kinds: ['appointment'], title: 'Appointments', icon: 'calendar' },
  { kinds: ['symptom', 'concern'], title: 'Recent concerns', icon: 'heart' },
  { kinds: ['preference'], title: 'How you like to talk', icon: 'message-circle' },
];

const SOURCE: Record<MemoryFact['provenance'], string> = {
  user_reported: 'You told Loni',
  clinician_confirmed: 'Confirmed by a clinician',
  ai_inferred: "Loni's guess",
};

const EDITABLE: MemoryFact['kind'][] = ['allergy', 'medication', 'condition', 'symptom'];
const RESOLVABLE: MemoryFact['kind'][] = ['symptom', 'concern', 'medication'];
const ADDABLE: { kind: 'allergy' | 'medication' | 'condition'; label: string; placeholder: string }[] = [
  { kind: 'allergy', label: 'Allergy', placeholder: 'e.g. penicillin' },
  { kind: 'medication', label: 'Medicine', placeholder: 'e.g. folic acid' },
  { kind: 'condition', label: 'Condition', placeholder: 'e.g. sickle cell' },
];

const prettyDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

const ago = (iso: string) => {
  const days = Math.round((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

export default function LoniMemoryScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { prefs } = useCheckinPreferences();
  const { facts, isLoading, correct, remove, add } = useMemoryFacts();
  const [editing, setEditing] = useState<{ fact?: MemoryFact; kind: MemoryFact['kind']; text: string } | null>(null);

  const fail = (e: any, what: string) =>
    Toast.show({ type: 'error', text1: what, text2: e?.response?.data?.detail || e?.message });

  const confirmDelete = (f: MemoryFact) =>
    Alert.alert('Forget this?', `Loni will forget "${f.label}". This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: () => remove.mutate(f.id, { onError: (e) => fail(e, 'Could not delete it') }),
      },
    ]);

  const toggleResolved = (f: MemoryFact) =>
    correct.mutate(
      { id: f.id, status: f.status === 'resolved' ? 'active' : 'resolved' },
      { onError: (e) => fail(e, 'Could not update it') },
    );

  const save = () => {
    if (!editing) return;
    const text = editing.text.trim();
    if (text.length < 2) return;
    const done = { onSuccess: () => setEditing(null), onError: (e: any) => fail(e, 'Could not save it') };
    if (editing.fact) correct.mutate({ id: editing.fact.id, key: text }, done);
    else add.mutate({ kind: editing.kind as 'allergy' | 'medication' | 'condition', key: text }, done);
  };

  const line = (f: MemoryFact) => {
    const bits = [SOURCE[f.provenance] ?? f.provenance];
    if (f.kind === 'appointment') {
      const when = prettyDate(f.event_date);
      bits.unshift(when ? when : 'date not given');
    } else {
      bits.push(`last mentioned ${ago(f.last_noted)}`);
    }
    return bits.join(' · ');
  };

  const renderFact = (f: MemoryFact) => {
    const resolved = f.status === 'resolved';
    return (
      <View key={f.id} className="p-4 rounded-[14px]" style={{ backgroundColor: colors.elevated, opacity: resolved ? 0.7 : 1 }}>
        <View className="flex-row items-start">
          <View className="flex-1 pr-3">
            <HelixaText className="text-[15px] mb-1" weight="bold" style={resolved ? { textDecorationLine: 'line-through' } : undefined}>
              {f.label}
            </HelixaText>
            <HelixaText className="text-[12px] leading-4" style={{ color: colors.textSecondary }}>{line(f)}</HelixaText>
            {(f.stale || resolved) && (
              <HelixaText className="text-[12px] mt-1" style={{ color: resolved ? '#16A34A' : '#D97706' }}>
                {resolved ? 'Marked as better' : 'Older note: Loni will ask before assuming'}
              </HelixaText>
            )}
          </View>
          <View className="flex-row gap-2">
            {RESOLVABLE.includes(f.kind) && (
              <TouchableOpacity
                onPress={() => toggleResolved(f)}
                accessibilityRole="button"
                accessibilityLabel={resolved ? `Mark ${f.label} as still a concern` : `Mark ${f.label} as better`}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.surface }}
              >
                <Feather name={resolved ? 'rotate-ccw' : 'check'} size={15} color={colors.text} />
              </TouchableOpacity>
            )}
            {EDITABLE.includes(f.kind) && (
              <TouchableOpacity
                onPress={() => setEditing({ fact: f, kind: f.kind, text: f.key })}
                accessibilityRole="button"
                accessibilityLabel={`Correct ${f.label}`}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.surface }}
              >
                <Feather name="edit-2" size={14} color={colors.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => confirmDelete(f)}
              accessibilityRole="button"
              accessibilityLabel={`Forget ${f.label}`}
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Feather name="trash-2" size={14} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const groups = GROUPS.map((g) => ({ ...g, items: facts.filter((f) => g.kinds.includes(f.kind)) })).filter((g) => g.items.length);
  const memoryOff = prefs?.remember === false;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <Reveal index={0}>
        <View className="flex-row items-center justify-center py-4 mb-2 relative px-6">
          <TouchableOpacity
            className="absolute left-6 w-12 h-12 rounded-full border justify-center items-center"
            style={{ borderColor: colors.border }}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Feather name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <HelixaText className="text-[18px]" weight="bold">What Loni Remembers</HelixaText>
        </View>
      </Reveal>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        <Reveal index={1}>
          <View className="rounded-[16px] p-5 mb-6 mt-4 flex-row" style={{ backgroundColor: colors.roseSoft }}>
            <Feather name="info" size={18} color="#E11D48" style={{ marginRight: 12, marginTop: 2 }} />
            <HelixaText className="flex-1 text-[14px] leading-5" style={{ color: colors.textSecondary }}>
              {memoryOff
                ? "Memory is switched off, so Loni isn't learning anything new. You can still review or delete what's here."
                : 'Loni keeps short notes so your chats feel continuous. Fix anything that is wrong, mark things as better, or delete them. A nurse only sees these if you choose to share them.'}
            </HelixaText>
          </View>
        </Reveal>

        <Reveal index={2}>
          <HelixaText className="text-[16px] mb-3">Add something Loni should know</HelixaText>
          <View className="flex-row gap-2 mb-6">
            {ADDABLE.map((a) => (
              <TouchableOpacity
                key={a.kind}
                onPress={() => setEditing({ kind: a.kind, text: '' })}
                accessibilityRole="button"
                accessibilityLabel={`Add ${a.label.toLowerCase()}`}
                className="flex-1 flex-row items-center justify-center gap-1 py-3 rounded-[14px]"
                style={{ backgroundColor: colors.surface }}
              >
                <Feather name="plus" size={14} color={colors.text} />
                <HelixaText className="text-[13px]">{a.label}</HelixaText>
              </TouchableOpacity>
            ))}
          </View>
        </Reveal>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.text} />
        ) : groups.length === 0 ? (
          <HelixaText className="text-[14px] text-center mt-6 px-4 leading-5" style={{ color: colors.textSecondary }}>
            Loni hasn&apos;t noted anything yet. As you chat, things like symptoms, medicines or appointments you mention will appear here.
          </HelixaText>
        ) : (
          groups.map((g, i) => (
            <Reveal index={3 + i} key={g.title}>
              <View className="flex-row items-center gap-2 mb-3">
                <Feather name={g.icon} size={15} color={colors.text} />
                <HelixaText className="text-[16px]">{g.title}</HelixaText>
              </View>
              <View className="flex flex-col gap-3 p-4 rounded-[12px] mb-6" style={{ backgroundColor: colors.surface }}>
                {g.items.map(renderFact)}
              </View>
            </Reveal>
          ))
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <ModalKeyboardAvoid style={{ flex: 1, backgroundColor: colors.overlay }}>
          <View className="flex-1 justify-end">
            <TouchableOpacity className="absolute top-0 bottom-0 left-0 right-0" onPress={() => setEditing(null)} activeOpacity={1} />
            <View className="rounded-t-[32px] p-6 pt-4 pb-12" style={{ backgroundColor: colors.bg }}>
              <View className="items-center mb-6">
                <View className="w-12 h-1.5 rounded-full mb-6" style={{ backgroundColor: isDark ? '#3A3D44' : '#D1D5DB' }} />
                <HelixaText className="text-[20px] text-center" weight="bold">
                  {editing?.fact ? 'Correct this' : `Add ${ADDABLE.find((a) => a.kind === editing?.kind)?.label.toLowerCase() ?? 'note'}`}
                </HelixaText>
              </View>
              <TextInput
                autoFocus
                className="border rounded-[16px] px-4 py-4 text-[15px]"
                style={{ backgroundColor: colors.bgSoft, color: colors.text, borderColor: colors.border }}
                placeholderTextColor={colors.textMuted}
                placeholder={ADDABLE.find((a) => a.kind === editing?.kind)?.placeholder ?? ''}
                value={editing?.text ?? ''}
                maxLength={60}
                onChangeText={(text) => setEditing((e) => (e ? { ...e, text } : e))}
                onSubmitEditing={save}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={save}
                disabled={(editing?.text.trim().length ?? 0) < 2 || correct.isPending || add.isPending}
                className="mt-5 h-[52px] rounded-full items-center justify-center"
                style={{ backgroundColor: '#D62D88', opacity: (editing?.text.trim().length ?? 0) < 2 ? 0.5 : 1 }}
              >
                {correct.isPending || add.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <HelixaText weight="bold" style={{ color: '#FFFFFF', fontSize: 15 }}>Save</HelixaText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ModalKeyboardAvoid>
      </Modal>
    </SafeAreaView>
  );
}
