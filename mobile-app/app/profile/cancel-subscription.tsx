import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { HelixaText } from '../../components/HelixaText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import Toast from 'react-native-toast-message';
import { CancelReason } from '../../api/subscription';
import { useCancelSubscription, useResumeSubscription, useSubscription } from '../../hooks/useSubscription';
import { longDate, planName } from '../../lib/format';

const { width } = Dimensions.get('window');

const REASONS: { id: CancelReason; label: string }[] = [
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'not_using_enough', label: 'Not using it enough' },
  { id: 'found_alternative', label: 'Found an alternative' },
  { id: 'temporary_break', label: 'Temporary break' },
  { id: 'other', label: 'Other' },
];

export default function CancelSubscriptionScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedReason, setSelectedReason] = useState<CancelReason | null>(null);
  const [otherReason, setOtherReason] = useState('');
  const { subscription: sub, hasAccess, isLoading } = useSubscription();
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const isCanceling = cancel.isPending;
  const endDate = longDate(sub?.access_ends_at);

  const handleNext = () => {
    if (step === 1) {
      if (!selectedReason) return;
      if (selectedReason === 'other' && !otherReason.trim()) return;
      setStep(2);
    } else if (step === 2 && selectedReason) {
      cancel.mutate(
        { reason: selectedReason, note: selectedReason === 'other' ? otherReason.trim() : undefined },
        {
          onSuccess: () => setStep(3),
          onError: (e: any) =>
            Toast.show({ type: 'error', text1: 'Could not cancel', text2: e?.response?.data?.message || e?.message }),
        },
      );
    }
  };

  const onReschedule = () =>
    resume.mutate(undefined, {
      onSuccess: () => router.replace('/(tabs)/upgrade'),
      onError: (e: any) =>
        Toast.show({ type: 'error', text1: 'Could not resume', text2: e?.response?.data?.message || e?.message }),
    });

  // Nothing to cancel: a free user who deep-linked here, or a subscription that already ended.
  if (!isLoading && !hasAccess && step !== 3) {
    return <Redirect href="/subscribe" />;
  }

  const renderHeader = (title: string, showBack = true) => (
    <View className="flex-row items-center justify-center py-4 mb-4 relative">
      {showBack && (
        <TouchableOpacity
          className="absolute left-0 w-12 h-12 rounded-full border justify-center items-center"
          style={{ borderColor: colors.border }}
          onPress={() => step > 1 ? setStep(step - 1 as 1|2) : router.back()}
        >
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
      )}
      <HelixaText className="text-[18px]" weight="bold">
        {title}
      </HelixaText>
    </View>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <ScrollView className="flex-1 px-6 mt-4" showsVerticalScrollIndicator={false}>
        
        {step === 1 && (
          <View className="flex-1">
            {renderHeader('Cancel Subscription')}

            <View className="items-center mt-6 mb-8">
              <Image 
                source={require('../../assets/images/cancel-sad.png')} 
                style={{ width: 120, height: 120 }} 
                contentFit="contain" 
              />
            </View>

            <HelixaText className="text-[24px] text-center mb-2" weight="bold">
              Why are you leaving?
            </HelixaText>
            <HelixaText className="text-[15px] text-gray-500 text-center mb-8 px-4">
              Your feedback helps us make Loni better for every mother.
            </HelixaText>

            <View className="flex flex-col gap-3 rounded-[12px] p-4 mb-8" style={{ backgroundColor: colors.surface }}>
              {REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  className="flex-row items-center justify-between p-4 rounded-[14px] border"
                  style={{ backgroundColor: colors.elevated, borderColor: selectedReason === reason.id ? '#D62D88' : 'transparent' }}
                  onPress={() => setSelectedReason(reason.id)}
                >
                  <HelixaText className="text-[15px]">{reason.label}</HelixaText>
                  <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.surface }}>
                    <Feather name="arrow-right" size={16} color={colors.text} />
                  </View>
                </TouchableOpacity>
              ))}

              {selectedReason === 'other' && (
                <View className="mt-2 mb-2 px-2">
                  <TextInput
                    className="rounded-[16px] p-4 text-[15px] min-h-[100px] border"
                    style={{ backgroundColor: colors.elevated, borderColor: colors.border, color: colors.text }}
                    placeholderTextColor={colors.textMuted}
                    placeholder="Please tell us more..."
                    multiline
                    textAlignVertical="top"
                    value={otherReason}
                    onChangeText={setOtherReason}
                  />
                </View>
              )}
            </View>

            <HelixaText className="text-center text-gray-500 text-[13px] leading-5 px-6 mb-8">
              Your premium access will continue until the end of your current billing period. You can resubscribe anytime.
            </HelixaText>

            <TouchableOpacity 
              className="w-full py-4 rounded-full items-center mb-6"
              style={{ backgroundColor: selectedReason ? (isDark ? '#D62D88' : '#000') : (isDark ? '#3A3D44' : '#D1D5DB') }}
              onPress={handleNext}
              disabled={!selectedReason || (selectedReason === 'other' && !otherReason.trim())}
            >
              <HelixaText className="text-white text-[16px]" weight="bold">Next</HelixaText>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View className="flex-1">
            {renderHeader('Cancel Subscription')}

            <View className="items-center mb-8">
              <Image 
                source={require('../../assets/images/cry.png')} 
                style={{ width: 140, height: 140 }} 
                contentFit="contain" 
              />
            </View>

            <HelixaText className="text-[24px] text-center mb-2" weight="bold">
              We are sorry to see you go.
            </HelixaText>
            <HelixaText className="text-[15px] text-gray-500 text-center mb-10">
              We are constantly improving.
            </HelixaText>

            <HelixaText className="text-[16px] mb-4" weight="bold">
              What happens next:
            </HelixaText>

            <View className="mb-12">
              {[
                `Your premium access continues until ${endDate}`,
                'Emergency SOS and basic chat stay free',
                'You can resubscribe anytime with one tap'
              ].map((item, idx) => (
                <View key={idx} className="flex-row items-center mb-4">
                  <View className="w-6 h-6 rounded-full items-center justify-center mr-3" style={{ backgroundColor: colors.surface }}>
                    <Feather name="check" size={14} color={colors.textSecondary} />
                  </View>
                  <HelixaText className="text-gray-500 text-[15px]">{item}</HelixaText>
                </View>
              ))}
            </View>

            <TouchableOpacity 
              className="w-full bg-[#D62D88] py-4 rounded-full items-center mb-4"
              onPress={handleNext}
              disabled={isCanceling}
            >
              <HelixaText className="text-white text-[16px]" weight="bold">
                {isCanceling ? 'Canceling...' : 'Confirm Cancellation'}
              </HelixaText>
            </TouchableOpacity>

            <TouchableOpacity 
              className="w-full py-4 items-center mb-6"
              onPress={() => router.back()}
            >
              <HelixaText className="text-gray-500 text-[16px]" weight="bold">Keep Subscription</HelixaText>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View className="flex-1">
            <View className="flex-row items-center justify-center py-4 mb-8">
              <TouchableOpacity
                className="absolute left-0 w-12 h-12 rounded-full border justify-center items-center"
                style={{ borderColor: colors.border }}
                onPress={() => router.back()}
              >
                <Feather name="arrow-left" size={24} color={colors.text} />
              </TouchableOpacity>
              <HelixaText className="text-[18px]" weight="bold">
                Cancel Subscription
              </HelixaText>
            </View>

            <View className="items-center mt-4 mb-8">
              <Image 
                source={require('../../assets/images/cry-star.png')} 
                style={{ width: 140, height: 140 }} 
                contentFit="contain" 
              />
            </View>

            <HelixaText className="text-[24px] text-center mb-4" weight="bold">
              Subscription Cancelled
            </HelixaText>
            <HelixaText className="text-[15px] text-gray-500 text-center mb-10 leading-6 px-4">
              Your premium access will continue until {endDate}. After that, your account will switch to the free plan.
            </HelixaText>

            <View style={{ height: 96, borderRadius: 24, marginBottom: 48, overflow: 'hidden', position: 'relative', backgroundColor: colors.surface }}>
              <Image 
                source={isDark ? require('../../assets/images/support-dark.png') : require('../../assets/images/support.png')} 
                style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }}
                contentFit="cover"
                contentPosition="right"
              />
              <View style={{ flex: 1, justifyContent: 'flex-start', paddingLeft: 24, zIndex: 10 }}>
                <HelixaText className="text-[15px] mb-1 pt-7" weight="bold">{planName(sub?.plan)}</HelixaText>
                <HelixaText className="text-[13px] text-gray-500">Ends {endDate}</HelixaText>
              </View>
            </View>

            <TouchableOpacity 
              className="w-full bg-[#D62D88] py-4 rounded-full items-center mb-4"
              onPress={onReschedule}
              disabled={resume.isPending}
            >
              <HelixaText className="text-white text-[16px]" weight="bold">{resume.isPending ? 'Resuming...' : 'Reschedule Now'}</HelixaText>
            </TouchableOpacity>

            <TouchableOpacity 
              className="w-full py-4 items-center mb-6"
              onPress={() => router.replace('/(tabs)')}
            >
              <HelixaText className="text-gray-500 text-[16px]" weight="bold">Back to home</HelixaText>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
