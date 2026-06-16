import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';

export default function SuccessScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <LottieView
              source={require('../../assets/pregnant-woman.json')}
              autoPlay
              loop={true}
              style={styles.lottieIcon}
            />
          </View>
          <CalText style={styles.heading}>You're all set!</CalText>
          <HelixaText style={styles.subtext}>
            You now have free access to LONI's maternal support services
          </HelixaText>
        </View>

        <View style={styles.cardsContainer}>
          {/* Talk to a Nurse */}
          <View style={styles.card}>
            <View style={[styles.cardIconBox, { backgroundColor: '#ECFDF5' }]}>
              <Feather name="phone-call" size={20} color="#10B981" />
            </View>
            <View style={styles.cardTextContent}>
              <HelixaText style={styles.cardTitle} weight="bold">Talk to a Nurse</HelixaText>
              <HelixaText style={styles.cardDescription}>
                5 free nurse consultations per week
              </HelixaText>
            </View>
          </View>

          {/* Emergency Rides */}
          <View style={styles.card}>
            <View style={[styles.cardIconBox, { backgroundColor: '#FDF2F8' }]}>
              <Feather name="truck" size={20} color="#F43F5E" />
            </View>
            <View style={styles.cardTextContent}>
              <HelixaText style={styles.cardTitle} weight="bold">Emergency Rides</HelixaText>
              <HelixaText style={styles.cardDescription}>
                2 free emergency rides per week
              </HelixaText>
            </View>
          </View>

          {/* Recovery Plans */}
          <View style={styles.card}>
            <View style={[styles.cardIconBox, { backgroundColor: '#F5F3FF' }]}>
              <Feather name="clipboard" size={20} color="#8B5CF6" />
            </View>
            <View style={styles.cardTextContent}>
              <HelixaText style={styles.cardTitle} weight="bold">Recovery Plans</HelixaText>
              <HelixaText style={styles.cardDescription}>
                Personalized daily care plans
              </HelixaText>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={styles.startButton}
            onPress={() => router.replace('/(auth)/onboarding')}
          >
            <HelixaText style={styles.startButtonText} weight="bold">Get Started</HelixaText>
          </Pressable>

          <HelixaText style={styles.footerText}>
            You can upgrade to <HelixaText style={styles.upgradeHighlight} weight="bold">LoniPlus</HelixaText> anytime for unlimited access
          </HelixaText>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF', // Light gray background in success state usually or white
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottieIcon: {
    width: 80,
    height: 80,
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 22,
  },
  cardsContainer: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    marginBottom: 40,
    padding: 12,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF'
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardTextContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    color: '#111827',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#D62D88',
    borderRadius: 9999,
    paddingVertical: 18,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  upgradeHighlight: {
    color: '#10B981', // Green text for LoniPlus
  },
});
