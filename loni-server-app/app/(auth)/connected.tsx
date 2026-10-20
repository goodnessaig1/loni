import React from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Reveal, PressableScale } from '../../components/motion';
import { usePartnerConnection } from '../../hooks/usePartnerConnection';

export default function ConnectedScreen() {
  const { data: connection } = usePartnerConnection();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Reveal index={0}>
          <View style={styles.header}>
            <Image
              source={{ uri: 'https://ik.imagekit.io/eqh0cjetc/amazon-image/support-emjoi.svg' }}
              style={styles.icon}
              contentFit="contain"
            />
            <CalText style={styles.heading}>You're connected</CalText>
            <HelixaText style={styles.subtext}>
              {connection?.inviter_name
                ? `You're now part of ${connection.inviter_name}'s LONI support system.`
                : "You're now part of her LONI support system."}
            </HelixaText>
          </View>
        </Reveal>

        <Reveal index={1}>
          <PressableScale
            style={styles.doneButton}
            onPress={() => router.replace('/(auth)/whats-shared')}
          >
            <HelixaText style={styles.doneButtonText} weight="bold">Done</HelixaText>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </PressableScale>
        </Reveal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
  },
  icon: {
    width: 140,
    height: 138,
    marginBottom: 32,
  },
  heading: {
    fontSize: 24,
    lineHeight: 31,
    color: '#000000',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 12,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D62D88',
    borderRadius: 9999,
    paddingVertical: 18,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
