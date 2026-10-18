import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { WelcomeBurst } from '../../components/subscription/WelcomeBurst';
import { useSubscription } from '../../hooks/useSubscription';
import { BRAND } from '../../lib/theme';

export default function WelcomeToPlusScreen() {
  const router = useRouter();
  const { subscription } = useSubscription();
  const left = subscription?.days_left ?? 7;

  return (
    <LinearGradient colors={['#2A0420', '#5C0D3D', '#9B1360']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 20 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <WelcomeBurst size={240} />
          <CalText style={{ color: '#FFFFFF', fontSize: 30, textAlign: 'center', marginTop: 28 }}>Welcome to LONI Plus!</CalText>
          <HelixaText style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 12, paddingHorizontal: 12 }}>
            Your {subscription?.plan ? '7-day ' : ''}free trial has started. Unlimited Luma, recent nurses, priority dispatch, it&apos;s all yours.
          </HelixaText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 18 }}>
            <MaterialCommunityIcons name="crown" size={16} color="#FFFFFF" />
            <HelixaText style={{ color: '#FFFFFF', fontSize: 13 }}>
              Trial active · {left} {left === 1 ? 'day' : 'days'} left
            </HelixaText>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.replace('/(tabs)')}
          accessibilityRole="button"
          style={{ height: 56, borderRadius: 28, backgroundColor: BRAND.pink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginBottom: 24 }}
        >
          <HelixaText weight="bold" style={{ color: '#FFFFFF', fontSize: 16 }}>Go to Home</HelixaText>
          <Feather name="arrow-right" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}
