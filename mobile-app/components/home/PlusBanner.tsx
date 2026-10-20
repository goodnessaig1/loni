import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { HelixaText } from '../HelixaText';
import { usePlans } from '../../hooks/useSubscription';

const AMBER = '#FFA722';

/** Home banner for mothers without LoniPlus: "Try LONI Plus free for 7 days". */
export const PlusBanner = ({ onPress }: { onPress: () => void }) => {
  const { data: plans } = usePlans();
  const days = plans?.trial_days ?? 7;

  return (
    <LinearGradient colors={['#FFF3C9', '#FFE3C4', '#FFD2D9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 18 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: AMBER, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name="diamond-stone" size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <HelixaText weight="bold" style={{ fontSize: 15, color: '#1F2937' }}>Try LONI Plus free for {days} days</HelixaText>
          <HelixaText style={{ fontSize: 12, lineHeight: 18, color: '#6B7280', marginTop: 4 }}>
            Unlimited Luma, recent nurses, multiple emergency contacts, priority dispatch.
          </HelixaText>
        </View>
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Take a peek at LoniPlus"
        style={{ marginTop: 16, height: 48, borderRadius: 24, backgroundColor: AMBER, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        <HelixaText weight="bold" style={{ color: '#FFFFFF', fontSize: 14 }}>Take a Peek</HelixaText>
        <Feather name="arrow-right" size={16} color="#FFFFFF" />
      </TouchableOpacity>
    </LinearGradient>
  );
};
