import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../HelixaText';
import { useTheme } from '../../context/ThemeContext';

export type CareTone = 'orange' | 'blue' | 'pink';

export const TONES: Record<CareTone, string> = { orange: '#D9722B', blue: '#2F8EDB', pink: '#DE3F86' };

interface Props {
  tone: CareTone;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  /** Small progress line under the description, e.g. "3 of 12 done". */
  meta?: string;
  onPress: () => void;
  compact?: boolean;
}

/** A LoniPlus feature card: coloured title strip, one line of description and a "View Detail" button. */
export const CareCard = ({ tone, title, description, icon, meta, onPress, compact }: Props) => {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ flex: compact ? 1 : undefined, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.divider }}>
      <View style={{ backgroundColor: TONES[tone], paddingHorizontal: 14, paddingVertical: 8 }}>
        <HelixaText weight="bold" style={{ color: '#FFFFFF', fontSize: 12 }}>{title}</HelixaText>
      </View>
      <View style={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name={icon} size={16} color={TONES[tone]} />
          </View>
          <View style={{ flex: 1 }}>
            <HelixaText style={{ fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>{description}</HelixaText>
            {meta ? <HelixaText weight="bold" style={{ fontSize: 12, marginTop: 4, color: TONES[tone] }}>{meta}</HelixaText> : null}
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`View ${title}`}
          style={{ alignSelf: compact ? 'stretch' : 'flex-end', height: 36, borderRadius: 18, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#FFFFFF' : '#000000' }}
        >
          <HelixaText weight="bold" style={{ fontSize: 12, color: isDark ? '#000000' : '#FFFFFF' }}>View Detail</HelixaText>
        </TouchableOpacity>
      </View>
    </View>
  );
};
