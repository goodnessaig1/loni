import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useCallStore } from '../store/callStore';
import { useCall } from '../hooks/useCall';
import { PressableScale, Reveal } from '../components/motion';

const { width, height } = Dimensions.get('window');

/**
 * Issue 2 / Issue 4 fix: this screen previously called
 * POST /calls/{id}/join directly on Accept. `/join` does NOT run the
 * accept state machine at all - it never sets Call.status=ACCEPTED, never
 * creates the LiveKit room, never sets receiver_id, and never notifies the
 * caller. If a Nurse ever landed on this specific screen and pressed
 * Accept, the call would silently never actually get accepted server-side:
 * the Nurse would connect to an ad-hoc auto-created LiveKit room alone
 * while the Mother's app waited forever for a `call_accepted` event that
 * was never sent. It also read caller info from raw route params instead
 * of the shared store, so it never got the real name/trimester data
 * (Issue 6) `applyServerCallEvent` puts in the store.
 *
 * In the primary flow, `components/CallModals.tsx` (mounted globally in
 * `app/_layout.tsx`) already renders an equivalent incoming-call UI
 * reactively whenever `callStore.isIncoming` is true, which is how a
 * foregrounded app - or one that was just woken and cold-started via the
 * notifee full-screen intent, see NotificationContext.tsx's
 * `getInitialNotification()` handling - shows the incoming call. This
 * route is kept only as an explicit deep-link target (and now uses the
 * same store + useCall()->POST /accept path CallModals uses) rather than
 * a second, divergent implementation.
 */
export default function IncomingCallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const specificCallId = params.callId ? parseInt(params.callId as string, 10) : null;
  const { incomingRequests } = useCallStore();
  const { acceptCall, rejectCall } = useCall();
  
  const specificRequest = incomingRequests.find(r => r.callId === specificCallId);
  const remoteParticipant = specificRequest?.remote;

  const handleAccept = async () => {
    if (!specificCallId) { router.replace('/'); return; }
    try {
      await acceptCall(specificCallId);
    } catch (e) {
      console.error('Failed to accept call', e);
    } finally {
      router.replace('/');
    }
  };

  const handleDecline = async () => {
    if (specificCallId) {
      await rejectCall(specificCallId);
    }
    router.replace('/');
  };

  return (
    <LinearGradient
      colors={['#8B7355', '#2F4F4F', '#001F3F']}
      style={styles.container}
    >
      <Reveal index={0}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {remoteParticipant?.profile_picture ? (
              <Image
                source={{ uri: remoteParticipant.profile_picture }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="white" />
              </View>
            )}
          </View>
          <View style={styles.callerInfo}>
            <Text style={styles.callerName}>{remoteParticipant?.name || 'Unknown Caller'}</Text>
            {!!remoteParticipant?.trimester && (
              <Text style={styles.statusText}>
                {remoteParticipant.trimester}{remoteParticipant.pregnancy_week ? ` · ${remoteParticipant.pregnancy_week}` : ''}
              </Text>
            )}
          </View>
        </View>
      </Reveal>

      <Reveal index={1}>
        <View style={styles.buttonContainer}>
          <View style={styles.buttonWrapper}>
            <PressableScale style={[styles.actionButton, styles.declineButton]} onPress={handleDecline}>
              <MaterialIcons name="call-end" size={32} color="white" />
            </PressableScale>
            <Text style={styles.buttonLabel}>Decline</Text>
          </View>

          <View style={styles.buttonWrapper}>
            <PressableScale style={[styles.actionButton, styles.acceptButton]} onPress={handleAccept}>
              <Feather name="phone" size={32} color="white" />
            </PressableScale>
            <Text style={styles.buttonLabel}>Accept</Text>
          </View>
        </View>
      </Reveal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: height * 0.15,
    paddingBottom: height * 0.1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 30,
    gap: 20
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'white',
  },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
  },
  callerInfo: {
    justifyContent: 'center',
  },
  callerName: {
    fontFamily: 'Helixa-Bold',
    fontSize: 28,
    color: 'white',
    marginBottom: 4,
  },
  statusText: {
    fontFamily: 'Helixa-Regular',
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 20,
  },
  buttonWrapper: {
    alignItems: 'center',
  },
  actionButton: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  declineButton: {
    backgroundColor: '#FF3B30',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  buttonLabel: {
    fontFamily: 'Helixa-Regular',
    color: 'white',
    fontSize: 16,
  }
});
