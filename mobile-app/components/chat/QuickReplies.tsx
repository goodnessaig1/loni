import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { HelixaText } from '../HelixaText';
import { useTheme } from '../../context/ThemeContext';
import type { ChatMeta } from '../../hooks/useAIChat';

type Suggestion = NonNullable<ChatMeta['suggestions']>[number];

/** Tap-to-reply chips under Loni's check-in message ("I'm doing well", "A bit rough"...). */
export const QuickReplies = ({ suggestions, onReply, onNurse }: { suggestions: Suggestion[]; onReply: (text: string) => void; onNurse: () => void }) => {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
      {suggestions.map((s) => (
        <TouchableOpacity
          key={s.key}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={s.label}
          onPress={() => (s.message ? onReply(s.message) : onNurse())}
          style={{ paddingHorizontal: 14, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: '#D62D88' }}
        >
          <HelixaText style={{ fontSize: 13, color: '#D62D88' }}>{s.label}</HelixaText>
        </TouchableOpacity>
      ))}
    </View>
  );
};
