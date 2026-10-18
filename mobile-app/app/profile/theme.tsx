import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HelixaText } from '../../components/HelixaText';
import { useTheme } from '../../context/ThemeContext';
import { LIGHT, DARK, BRAND, type ThemePreference, type Palette } from '../../lib/theme';

interface Option {
  value: ThemePreference;
  title: string;
  description: string;
  /** Each card previews its own look, so these colours are fixed - they do not follow the active theme. */
  card: string;
  text: string;
  subText: string;
  border: string;
}

const OPTIONS: Option[] = [
  { value: 'light', title: 'Light', description: 'Clean, bright and easy on the eyes.', card: '#FFFFFF', text: '#000000', subText: '#6B7280', border: '#E5E7EB' },
  { value: 'dark', title: 'Dark', description: 'Sleek, modern and helps save battery.', card: '#2F2F2F', text: '#FFFFFF', subText: '#B5B5B5', border: '#2F2F2F' },
  { value: 'system', title: 'System', description: 'Automatically matches your device settings.', card: '#F3F3F3', text: '#000000', subText: '#6B7280', border: '#F3F3F3' },
];

/** Miniature app screen drawn from a palette, used as the option preview. */
const Thumbnail = ({ p }: { p: Palette }) => (
  <View style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: p.bg, borderWidth: 1, borderColor: p.divider, padding: 6, overflow: 'hidden' }}>
    <View style={{ width: '60%', height: 5, borderRadius: 3, backgroundColor: p.text, opacity: 0.85 }} />
    <View style={{ width: '85%', height: 3, borderRadius: 2, backgroundColor: p.textMuted, marginTop: 4 }} />
    <View style={{ height: 16, borderRadius: 5, backgroundColor: '#3B6EF5', marginTop: 7 }} />
    <View style={{ width: '45%', height: 5, borderRadius: 3, backgroundColor: BRAND.pink, marginTop: 5 }} />
  </View>
);

/** Half light / half dark thumbnail for the System option. */
const SplitThumbnail = () => (
  <View style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', flexDirection: 'row' }}>
    <View style={{ width: 28, overflow: 'hidden' }}>
      <Thumbnail p={LIGHT} />
    </View>
    <View style={{ width: 28, overflow: 'hidden' }}>
      <View style={{ marginLeft: -28 }}>
        <Thumbnail p={DARK} />
      </View>
    </View>
  </View>
);

export default function ThemeScreen() {
  const router = useRouter();
  const { colors, preference, setPreference } = useTheme();

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View className="px-6 py-4">
        <TouchableOpacity
          className="w-12 h-12 rounded-full border justify-center items-center"
          style={{ borderColor: colors.border }}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        <HelixaText className="text-[26px] mb-2" weight="bold">
          Theme
        </HelixaText>
        <HelixaText className="text-[14px] leading-6 mb-6" style={{ color: colors.textSecondary }}>
          Choose your preferred look and make the app feel like you.
        </HelixaText>

        <View className="gap-3" accessibilityRole="radiogroup">
          {OPTIONS.map((o) => {
            const selected = preference === o.value;
            return (
              <TouchableOpacity
                key={o.value}
                activeOpacity={0.85}
                onPress={() => setPreference(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${o.title} theme`}
                className="flex-row items-center rounded-[16px] p-4"
                style={{ backgroundColor: o.card, borderWidth: 1, borderColor: o.border }}
              >
                {o.value === 'system' ? <SplitThumbnail /> : <Thumbnail p={o.value === 'dark' ? DARK : LIGHT} />}
                <View className="flex-1 mx-4">
                  <HelixaText className="text-[15px]" weight="bold" style={{ color: o.text }}>
                    {o.title}
                  </HelixaText>
                  <HelixaText className="text-[12px] mt-1" style={{ color: o.subText }}>
                    {o.description}
                  </HelixaText>
                </View>
                {selected ? (
                  <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: BRAND.pink }}>
                    <Feather name="check" size={14} color="#FFFFFF" />
                  </View>
                ) : (
                  <View className="w-6 h-6 rounded-full" style={{ borderWidth: 1.5, borderColor: o.subText }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
