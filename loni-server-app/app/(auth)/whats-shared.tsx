import React from 'react';
import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Reveal, RevealList, PressableScale } from '../../components/motion';
import { usePartnerConnection } from '../../hooks/usePartnerConnection';

const SHARE_ITEMS = [
  {
    key: 'location' as const,
    icon: 'map-pin' as const,
    title: 'Location Access',
    description: 'See her shared location when available.',
  },
  {
    key: 'updates' as const,
    icon: 'refresh-cw' as const,
    title: 'Updates',
    description: "Receive the pregnancy updates she's chosen to share.",
  },
  {
    key: 'emergency' as const,
    icon: 'alert-triangle' as const,
    title: 'Emergency',
    description: 'Receive notifications when she triggers an emergency alert.',
  },
];

export default function WhatsSharedScreen() {
  const { data: connection } = usePartnerConnection();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="black" />
        </Pressable>

        <Reveal index={0}>
          <HelixaText style={styles.eyebrow} weight="bold">She chooses what you can see</HelixaText>
          <CalText style={styles.heading}>Here's what she's chosen to share</CalText>
          <HelixaText style={styles.subtext}>
            These permissions help us provide the best care and support
          </HelixaText>
        </Reveal>

        <Reveal index={1}>
          <View style={styles.cardsContainer}>
            {SHARE_ITEMS.map((item, i) => {
              const shared = connection ? connection[item.key] : true;
              return (
                <RevealList key={item.key} index={i}>
                  <View style={styles.cardWrapper}>
                    <View style={styles.card}>
                      <View style={styles.cardIcon}>
                        <Feather name={item.icon} size={18} color="#4B5563" />
                      </View>
                      <View style={styles.cardTextContent}>
                        <View style={styles.cardTitleRow}>
                          <HelixaText style={styles.cardTitle} weight="bold">{item.title}</HelixaText>
                          <View style={[styles.badge, !shared && styles.badgeMuted]}>
                            <HelixaText style={[styles.badgeText, !shared && styles.badgeTextMuted]} weight="bold">
                              {shared ? 'Shared' : 'Not shared'}
                            </HelixaText>
                          </View>
                        </View>
                        <HelixaText style={styles.cardDescription}>{item.description}</HelixaText>
                      </View>
                    </View>
                  </View>
                </RevealList>
              );
            })}
          </View>
        </Reveal>

        <Reveal index={2}>
          <HelixaText style={styles.footnote}>
            You can view this information, but you can't change what's shared.
          </HelixaText>

          <PressableScale style={styles.okayButton} onPress={() => router.replace('/(partner)' as any)}>
            <HelixaText style={styles.okayButtonText} weight="bold">Okay</HelixaText>
          </PressableScale>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 14,
    color: '#D62D88',
    marginBottom: 12,
  },
  heading: {
    fontSize: 24,
    lineHeight: 31,
    color: '#000000',
    marginBottom: 10,
  },
  subtext: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 32,
  },
  cardsContainer: {
    gap: 11,
    marginBottom: 24,
  },
  cardWrapper: {
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 11,
    padding: 11,
  },
  card: {
    flexDirection: 'row',
    gap: 16,
    borderWidth: 1,
    borderColor: '#E9EAEB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  cardIcon: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextContent: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 7,
  },
  cardTitle: {
    fontSize: 15,
    color: '#000000',
  },
  badge: {
    backgroundColor: '#E9FDE7',
    paddingHorizontal: 15,
    paddingVertical: 3,
    borderRadius: 36,
  },
  badgeMuted: {
    backgroundColor: '#F5F5F5',
  },
  badgeText: {
    fontSize: 13,
    color: '#15B300',
  },
  badgeTextMuted: {
    color: '#6B7280',
  },
  cardDescription: {
    fontSize: 14,
    color: '#535862',
    lineHeight: 20,
  },
  footnote: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  okayButton: {
    backgroundColor: '#D62D88',
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
  },
  okayButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
