import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../HelixaText';
import { useTheme } from '../../context/ThemeContext';
import { BRAND } from '../../lib/theme';
import type { DailyTip } from '../../lib/pregnancy';

/** "Today's tip" row: label plus a bordered card with an icon tile, title and one-line advice. */
export const TodaysTip = ({ tip }: { tip: DailyTip }) => {
  const { colors } = useTheme();

  return (
    <View style={{ marginBottom: 28 }}>
      <HelixaText style={{ fontSize: 16, color: colors.text, marginBottom: 12 }}>Today&apos;s tip</HelixaText>
      <View
        accessible
        accessibilityLabel={`Today's tip: ${tip.title}. ${tip.body}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          padding: 16,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.divider,
          backgroundColor: colors.card,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name={tip.icon} size={22} color={BRAND.pink} />
        </View>
        <View style={{ flex: 1 }}>
          <HelixaText weight="bold" style={{ fontSize: 16, marginBottom: 4 }}>
            {tip.title}
          </HelixaText>
          <HelixaText style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary }}>{tip.body}</HelixaText>
        </View>
      </View>
    </View>
  );
};
