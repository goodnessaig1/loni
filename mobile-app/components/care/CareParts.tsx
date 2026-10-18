import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { HelixaText } from '../HelixaText';
import { useTheme } from '../../context/ThemeContext';
import { useSubscription } from '../../hooks/useSubscription';
import { BRAND } from '../../lib/theme';

interface ScreenProps {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: React.ReactNode;
}

/** Shared frame for every LoniPlus care screen: back button, title, loading/error states, members-only guard. */
export const CareScreen = ({ title, subtitle, isLoading, isError, onRetry, onRefresh, refreshing, children }: ScreenProps) => {
  const router = useRouter();
  const { colors } = useTheme();
  const { hasAccess, isLoading: subLoading } = useSubscription();

  if (!subLoading && !hasAccess) return <Redirect href="/subscribe" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={BRAND.pink} /> : undefined}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ width: 44, height: 44, justifyContent: 'center', marginTop: 8 }}
        >
          <Feather name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <HelixaText weight="bold" style={{ fontSize: 24, marginTop: 4 }}>{title}</HelixaText>
        {subtitle ? <HelixaText style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: 6 }}>{subtitle}</HelixaText> : null}

        <View style={{ marginTop: 20 }}>
          {isLoading || subLoading ? (
            <ActivityIndicator color={BRAND.pink} style={{ marginVertical: 60 }} />
          ) : isError ? (
            <TouchableOpacity onPress={onRetry} style={{ paddingVertical: 60 }}>
              <HelixaText style={{ textAlign: 'center', color: colors.textSecondary }}>Something went wrong. Tap to retry.</HelixaText>
            </TouchableOpacity>
          ) : (
            children
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

/** Pink-to-peach banner used at the top of the plan screens. */
export const StageBanner = ({ pill, title }: { pill?: string; title: string }) => (
  <LinearGradient colors={['#FFC9DA', '#FFB9A8', '#FFC7A0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 18, minHeight: 112, justifyContent: 'space-between' }}>
    {pill ? (
      <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
        <HelixaText style={{ fontSize: 11, color: '#374151' }}>{pill}</HelixaText>
      </View>
    ) : <View />}
    <HelixaText weight="bold" style={{ fontSize: 20, color: '#111827' }}>{title}</HelixaText>
  </LinearGradient>
);

export const Checkbox = ({ checked }: { checked: boolean }) => {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: checked ? BRAND.pink : colors.textMuted,
        backgroundColor: checked ? BRAND.pink : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked && <Feather name="check" size={14} color="#FFFFFF" />}
    </View>
  );
};

export const SectionTitle = ({ children }: { children: string }) => (
  <HelixaText weight="bold" style={{ fontSize: 15, marginTop: 26, marginBottom: 12 }}>{children}</HelixaText>
);

/** Pill filter / tab. */
export const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={{ paddingHorizontal: 16, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? BRAND.pink : colors.surface }}
    >
      <HelixaText style={{ fontSize: 13, color: selected ? '#FFFFFF' : colors.text }}>{label}</HelixaText>
    </TouchableOpacity>
  );
};
