import React from 'react';
import { View, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { Reveal } from '../../components/motion';
import { useStartOnboarding } from '../../hooks/useDriverTraining';

export default function BecomeDriverScreen() {
  const { mutateAsync: startOnboarding, isPending } = useStartOnboarding();

  const handleContinue = async () => {
    try {
      await startOnboarding();
      router.push('/(auth)/driver-training');
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message ?? 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="black" />
        </Pressable>

        <View style={styles.content}>
          <Reveal index={0} style={{ width: '100%', alignItems: 'center' }}>
            <Image 
              source={require('../../assets/images/car.png')}
              style={styles.carImage}
              contentFit="contain"
            />

            <CalText style={styles.heading}>Become a LONI Driver</CalText>
            <HelixaText style={styles.subtitle}>
              Help mothers get safe transportation during urgent situations.
            </HelixaText>
          </Reveal>

          <Reveal index={1} style={{ width: '100%' }}>
            <View style={styles.infoBox}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="shield-plus-outline" size={20} color="#D62D88" />
              </View>
              <HelixaText style={styles.infoText}>
                Your vehicle helps ensure mothers reach medical care when they need it most.
              </HelixaText>
            </View>
          </Reveal>
        </View>

        <Reveal index={2}>
          <Button
            title="Continue"
            onPress={handleContinue}
            isLoading={isPending}
            style={styles.button}
          />
        </Reveal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  content: {
    // flex: 1,
    alignItems: 'center',
    paddingTop: 0,
    marginBottom:60
  },
  carImage: {
    width: '100%',
    height: 200,
    // marginBottom: 32,
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    color: '#000000',
    // marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: '#F3F3F3',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  button: {
    // marginTop: 'auto',
    paddingTop: 20,
  }
});
