import React, { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionModal } from '../ActionModal';
import { HelixaText } from '../HelixaText';
import { usePlans } from '../../hooks/useSubscription';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after the second confirmation; the caller starts the reason flow. */
  onContinue: () => void;
}

/** The two bottom sheets shown before the cancellation flow: "Cancel Subscription?" then "Before you go...". */
export const CancelPrompt = ({ visible, onClose, onContinue }: Props) => {
  const [step, setStep] = useState<1 | 2>(1);
  const { data: plans } = usePlans();

  useEffect(() => {
    if (visible) setStep(1);
  }, [visible]);

  const perks = plans ? [`${plans.trial_days} Days free trial`, ...plans.features] : [];

  return (
    <ActionModal
      visible={visible}
      onClose={onClose}
      title={step === 1 ? 'Cancel Subscription?' : 'Before you go...'}
      description={
        step === 1
          ? 'Your premium access will continue until the end of your billing period. You can resubscribe anytime.'
          : 'Here is what you will miss without LoniPlus:'
      }
      primaryButtonText={step === 1 ? 'Continue to Cancel' : 'I Understand, Cancel'}
      onPrimaryPress={() => (step === 1 ? setStep(2) : onContinue())}
      secondaryButtonText="Keep Subscription"
      onSecondaryPress={onClose}
      icon={
        step === 1 ? (
          <Image source={require('../../assets/images/iconn.png')} style={{ width: 120, height: 120 }} contentFit="contain" />
        ) : (
          <View className="w-24 h-24 bg-[#D62D88] rounded-[32px] items-center justify-center shadow-md shadow-pink-200">
            <MaterialCommunityIcons name="robot-outline" size={56} color="#FFF" />
          </View>
        )
      }
    >
      {step === 2 && (
        <View className="w-full pl-2 pr-4">
          {perks.map((perk) => (
            <View key={perk} className="flex-row items-center mb-3">
              <View className="w-5 h-5 rounded-full items-center justify-center mr-3" style={{ backgroundColor: '#22C55E' }}>
                <Feather name="check" size={12} color="#FFFFFF" />
              </View>
              <HelixaText className="text-[14px]" style={{ opacity: 0.75 }}>{perk}</HelixaText>
            </View>
          ))}
        </View>
      )}
    </ActionModal>
  );
};
