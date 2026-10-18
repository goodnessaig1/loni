import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { CancelPrompt } from '../../components/subscription/CancelPrompt';
import { useTheme } from '../../context/ThemeContext';
import { useResumeSubscription, useSubscription } from '../../hooks/useSubscription';
import { naira, shortDate } from '../../lib/format';
import { BRAND } from '../../lib/theme';
import { Reveal } from '../../components/motion';

interface RowProps {
  title: string;
  subtitle: string;
  onPress: () => void;
  loading?: boolean;
}

/** LoniPlus management page. Members see this tab; everyone else is sent to the subscribe screen. */
export default function UpgradeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { subscription: sub, hasAccess, isLoading } = useSubscription();
  const resume = useResumeSubscription();
  const [promptOpen, setPromptOpen] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={BRAND.pink} />
      </SafeAreaView>
    );
  }
  if (!sub || !hasAccess) return <Redirect href="/subscribe" />;

  const cancelled = sub.state === 'cancelled';
  const trialing = sub.state === 'trialing';
  const badge = cancelled ? 'Cancelled' : trialing ? 'Trial' : 'Active';
  const banner = cancelled
    ? `Access ends ${shortDate(sub.access_ends_at)}`
    : trialing
      ? `Trial ends ${shortDate(sub.trial_ends_at)}`
      : `Renews ${shortDate(sub.access_ends_at)}`;

  const soon = (what: string) => Toast.show({ type: 'info', text1: what, text2: "Payments aren't switched on yet, so there's nothing to manage here." });

  const onResume = () =>
    resume.mutate(undefined, {
      onSuccess: () => Toast.show({ type: 'success', text1: 'Welcome back', text2: 'Your LoniPlus is on again.' }),
      onError: (e: any) => Toast.show({ type: 'error', text1: 'Could not resume', text2: e?.response?.data?.message || e?.message }),
    });

  const Row = ({ title, subtitle, onPress, loading }: RowProps) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.elevated, borderRadius: 14, padding: 16 }}
    >
      <View style={{ flex: 1 }}>
        <HelixaText style={{ fontSize: 15 }}>{title}</HelixaText>
        <HelixaText style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{subtitle}</HelixaText>
      </View>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        {loading ? <ActivityIndicator size="small" color={colors.text} /> : <Feather name="arrow-right" size={16} color={colors.text} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <Reveal index={0}>
        <CalText style={{ color: BRAND.pink, fontSize: 30, marginBottom: 6 }}>LoniPlus</CalText>
        <HelixaText style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 24 }}>
          Extra support when you need it most. Because you deserve peace of mind.
        </HelixaText>
        </Reveal>

        <Reveal index={1}>
        <View style={{ borderRadius: 26, padding: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.divider, marginBottom: 32 }}>
          <LinearGradient colors={['#FBD3E6', '#FDE6EE', '#FDEBD3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <HelixaText weight="bold" style={{ color: '#111827', fontSize: 13 }}>LoniPlus</HelixaText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: cancelled ? '#FEE2E2' : '#DCFCE7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cancelled ? '#EF4444' : '#16A34A' }} />
                <HelixaText style={{ fontSize: 11, color: cancelled ? '#B91C1C' : '#166534' }}>{badge}</HelixaText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 14 }}>
              <CalText style={{ color: '#111827', fontSize: 34 }}>{naira(sub.price ?? 0)}</CalText>
              <HelixaText style={{ color: '#4B5563', fontSize: 13, marginLeft: 4, marginBottom: 6 }}>
                /Per {sub.plan === 'annual' ? 'Annual' : 'Month'}
              </HelixaText>
            </View>
            <HelixaText style={{ color: '#4B5563', fontSize: 13, marginTop: 4 }}>Cancel anytime • No commitments</HelixaText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, backgroundColor: 'rgba(214,45,136,0.12)', borderRadius: 12, padding: 14 }}>
              <Feather name="clock" size={16} color="#111827" />
              <HelixaText style={{ color: '#111827', fontSize: 14 }}>{banner}</HelixaText>
            </View>
          </LinearGradient>
        </View>
        </Reveal>

        <Reveal index={2}>
        <HelixaText style={{ fontSize: 14, marginBottom: 12 }}>Manage</HelixaText>
        <View style={{ gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors.surface }}>
          <Row title="Change Payment Method" subtitle="Update your card or wallet" onPress={() => soon('Payment methods')} />
          {cancelled ? (
            <Row title="Resume Subscription" subtitle="Keep your premium access" onPress={onResume} loading={resume.isPending} />
          ) : (
            <Row title="Cancel Subscription" subtitle="End your premium access" onPress={() => setPromptOpen(true)} />
          )}
          <Row title="Download Invoices" subtitle="Get PDF copies of your bills" onPress={() => soon('Invoices')} />
        </View>
        </Reveal>
      </ScrollView>

      <CancelPrompt
        visible={promptOpen}
        onClose={() => setPromptOpen(false)}
        onContinue={() => { setPromptOpen(false); router.push('/profile/cancel-subscription'); }}
      />
    </SafeAreaView>
  );
}
