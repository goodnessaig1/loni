import React from 'react';
import { Alert, Linking, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HelixaText } from '../HelixaText';
import { useTheme } from '../../context/ThemeContext';
import type { ChatMeta } from '../../hooks/useAIChat';
import { handoffApi } from '../../api/handoff';

const ICONS: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  request_ride: 'truck',
  talk_to_nurse: 'phone-call',
  call_emergency: 'phone',
  invite_partner: 'user-plus',
};

/**
 * Buttons under an assistant reply. The server decides which actions exist (only things LONI can really do:
 * request a ride, talk to a nurse, call emergency services); this just renders them. Emergencies and urgent
 * replies also get a coloured strip so they cannot be mistaken for ordinary advice.
 */
export const SafetyActions = ({ meta, sessionId }: { meta?: ChatMeta; sessionId?: string | null }) => {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  if (!meta || meta.actions.length === 0) return null;

  const emergency = meta.urgency === 'emergency';
  const urgent = meta.urgency === 'urgent';
  const accent = emergency ? '#DC2626' : urgent ? '#D97706' : '#D62D88';

  const go = (route?: string) => {
    if (route) router.push(route as any);
  };

  const run = (a: ChatMeta['actions'][number]) => {
    if (a.type === 'call_emergency') {
      if (a.phone) Linking.openURL(`tel:${a.phone}`);
    } else if (a.type === 'talk_to_nurse' && !emergency) {
      // Ask before sharing anything. In an emergency we never add a step: the call starts straight away.
      Alert.alert(
        'Share a summary with the nurse?',
        "Loni can send the nurse a short summary: your stage, any warning signs from this chat, and allergies, medicines or concerns you've told Loni. Your messages are not included. No nurse has reviewed it yet.",
        [
          { text: "Don't share", style: 'cancel', onPress: () => go(a.route) },
          {
            text: 'Share',
            onPress: () => {
              handoffApi.share(sessionId).catch(() => {}); // sharing must never block reaching a nurse
              go(a.route);
            },
          },
        ],
      );
    } else {
      go(a.route);
    }
  };

  return (
    <View style={{ marginTop: 10, gap: 8 }}>
      {(emergency || urgent) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name="alert-triangle" size={14} color={accent} />
          <HelixaText weight="bold" style={{ fontSize: 12, color: accent }}>
            {emergency ? 'Emergency: get help now' : 'Please get checked today'}
          </HelixaText>
        </View>
      )}
      {meta.actions.map((a, i) => {
        const primary = i === 0 && (emergency || urgent);
        return (
          <TouchableOpacity
            key={a.type}
            activeOpacity={0.85}
            onPress={() => run(a)}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              height: 46,
              borderRadius: 23,
              backgroundColor: primary ? accent : isDark ? colors.surface : '#FFFFFF',
              borderWidth: primary ? 0 : 1,
              borderColor: accent,
            }}
          >
            <Feather name={ICONS[a.type] ?? 'arrow-right'} size={16} color={primary ? '#FFFFFF' : accent} />
            <HelixaText weight="bold" style={{ fontSize: 14, color: primary ? '#FFFFFF' : accent }}>{a.label}</HelixaText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
