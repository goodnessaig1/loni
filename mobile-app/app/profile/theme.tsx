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
}

const OPTIONS: Option[] = [
  { value: 'light', title: 'Light', description: 'Always use the light appearance' },
  { value: 'dark', title: 'Dark', description: 'Always use the dark appearance' },
  { value: 'system', title: 'System', description: 'Match your device settings' },
];

/** Miniature app screen drawn from a palette, used as the option preview. */
const Thumbnail = ({ p, width = 56 }: { p: Palette; width?: number }) => (
  <View
    style={{
      width,
      height: 72,
      borderRadius: 10,
      backgroundColor: p.bg,
      borderWidth: 1,
      borderColor: p.divider,
      padding: 7,
      overflow: 'hidden',
    }}
  >
    <View style={{ width: '55%', height: 6, borderRadius: 3, backgroundColor: p.text, opacity: 0.85 }} />
    <View style={{ width: '80%', height: 4, borderRadius: 2, backgroundColor: p.textMuted, marginTop: 5 }} />
    <View style={{ height: 22, borderRadius: 6, backgroundColor: p.surface, marginTop: 8 }} />
    <View style={{ width: '45%', height: 8, borderRadius: 4, backgroundColor: BRAND.pink, marginTop: 7 }} />
  </View>
);

/** Half light / half dark thumbnail for the System option. */
const SplitThumbnail = () => (
  <View style={{ width: 56, height: 72, borderRadius: 10, overflow: 'hidden', flexDirection: 'row', borderWidth: 1, borderColor: DARK.divider }}>
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
        <HelixaText className="text-[28px] mb-2" weight="bold">
          Theme
        </HelixaText>
        <HelixaText className="text-[15px] leading-6 mb-6" style={{ color: colors.textSecondary }}>
          Choose how LONI looks. System follows your device appearance automatically.
        </HelixaText>

        <View className="gap-3">
          {OPTIONS.map((o) => {
            const selected = preference === o.value;
            return (
              <TouchableOpacity
                key={o.value}
                activeOpacity={0.8}
                onPress={() => setPreference(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${o.title} theme`}
                className="flex-row items-center rounded-[20px] p-4"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1.5,
                  borderColor: selected ? BRAND.pink : 'transparent',
                }}
              >
                {o.value === 'system' ? <SplitThumbnail /> : <Thumbnail p={o.value === 'dark' ? DARK : LIGHT} />}
                <View className="flex-1 mx-4">
                  <HelixaText className="text-[17px]" weight="bold">
                    {o.title}
                  </HelixaText>
                  <HelixaText className="text-[13px] mt-1" style={{ color: colors.textSecondary }}>
                    {o.description}
                  </HelixaText>
                </View>
                {selected ? (
                  <View
                    className="w-6 h-6 rounded-full items-center justify-center"
                    style={{ backgroundColor: BRAND.pink }}
                  >
                    <Feather name="check" size={14} color="#FFFFFF" />
                  </View>
                ) : (
                  <View className="w-6 h-6 rounded-full" style={{ borderWidth: 1.5, borderColor: colors.textMuted }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
