import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { PlanId } from '../../api/subscription';
import { usePlans, useStartTrial, useSubscription } from '../../hooks/useSubscription';
import { naira } from '../../lib/format';
import { BRAND } from '../../lib/theme';

const WHITE = '#FFFFFF';
const GREEN = '#22C55E';

/** Pricing / start-trial screen. Always dark-pink (it is brand artwork, like the splash), in both themes. */
export default function SubscribeScreen() {
  const router = useRouter();
  const { subscription, hasAccess, isLoading: subLoading } = useSubscription();
  const { data: plans, isLoading: plansLoading, isError, refetch } = usePlans();
  const startTrial = useStartTrial();
  const [selected, setSelected] = useState<PlanId>('annual');

  useEffect(() => {
    if (plans && !plans.plans.some((p) => p.id === selected)) setSelected(plans.plans[0].id);
  }, [plans, selected]);

  if (hasAccess) return <Redirect href="/(tabs)/upgrade" />;

  const canStart = !!subscription?.can_start_trial;
  const days = plans?.trial_days ?? 7;

  const onStart = () =>
    startTrial.mutate(selected, {
      onSuccess: () => router.replace('/subscribe/welcome'),
      onError: (e: any) =>
        Toast.show({ type: 'error', text1: 'Could not start your trial', text2: e?.response?.data?.message || e?.message }),
    });

  return (
    <LinearGradient colors={['#A3185F', '#7A0F47', '#3A0A27']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
          >
            <Feather name="arrow-left" size={22} color={WHITE} />
          </TouchableOpacity>

          <CalText style={{ color: WHITE, fontSize: 34, lineHeight: 40, marginTop: 64, marginBottom: 20 }}>
            Subscribe to pro{'\n'}version now
          </CalText>

          {plansLoading || subLoading ? (
            <ActivityIndicator color={WHITE} style={{ marginVertical: 60 }} />
          ) : isError || !plans ? (
            <TouchableOpacity onPress={() => refetch()} style={{ paddingVertical: 40 }}>
              <HelixaText style={{ color: WHITE, textAlign: 'center' }}>Couldn&apos;t load plans. Tap to retry.</HelixaText>
            </TouchableOpacity>
          ) : (
            <>
              <View style={{ gap: 14 }}>
                <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingVertical: 5, paddingRight: 12, paddingLeft: 4 }}>
                  <Check />
                  <HelixaText style={{ color: WHITE, fontSize: 13 }}>{days} Days free trial</HelixaText>
                </View>
                {plans.features.map((f) => (
                  <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Check />
                    <HelixaText style={{ color: WHITE, fontSize: 14 }}>{f}</HelixaText>
                  </View>
                ))}
              </View>

              <View style={{ gap: 14, marginTop: 40 }} accessibilityRole="radiogroup">
                {plans.plans.map((p) => {
                  const on = p.id === selected;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      activeOpacity={0.85}
                      onPress={() => setSelected(p.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${p.label}, ${naira(p.price)}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                        padding: 18,
                        borderRadius: 18,
                        borderWidth: 1.5,
                        borderColor: on ? BRAND.pink : 'rgba(255,255,255,0.18)',
                        backgroundColor: 'rgba(255,255,255,0.07)',
                      }}
                    >
                      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? BRAND.pink : 'rgba(255,255,255,0.5)', backgroundColor: on ? BRAND.pink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {on && <Feather name="check" size={13} color={WHITE} />}
                      </View>
                      <View>
                        <HelixaText style={{ color: WHITE, fontSize: 16 }}>
                          <HelixaText weight="bold" style={{ color: WHITE, fontSize: 16 }}>{naira(p.price)}</HelixaText> / {p.label}
                        </HelixaText>
                        <HelixaText style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }}>{p.billed}</HelixaText>
                      </View>
                      {p.badge ? (
                        <View style={{ position: 'absolute', right: 14, top: -10, backgroundColor: BRAND.pink, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
                          <HelixaText weight="bold" style={{ color: WHITE, fontSize: 11 }}>{p.badge}</HelixaText>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!canStart || startTrial.isPending}
                onPress={onStart}
                accessibilityRole="button"
                style={{ marginTop: 36, height: 56, borderRadius: 28, backgroundColor: BRAND.pink, opacity: canStart ? 1 : 0.5, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
              >
                {startTrial.isPending ? (
                  <ActivityIndicator color={WHITE} />
                ) : (
                  <>
                    <HelixaText weight="bold" style={{ color: WHITE, fontSize: 16 }}>Start free {days}-day trial</HelixaText>
                    <Feather name="arrow-right" size={18} color={WHITE} />
                  </>
                )}
              </TouchableOpacity>

              <HelixaText style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 }}>
                {canStart
                  ? `Your first ${days} days are free on either plan. You won't be charged until the trial ends.`
                  : "You've already used your free trial. Paid plans are coming soon."}
              </HelixaText>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const Check = () => (
  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' }}>
    <Feather name="check" size={12} color={WHITE} />
  </View>
);
