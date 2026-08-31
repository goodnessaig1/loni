import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { HelixaText } from '../../components/HelixaText';
import { apiClient } from '../../api/client';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const StarIcon = ({ filled, size = 40 }: { filled: boolean; size?: number }) => {
  const fullPath = "M9.87209 2.52983C10.6424 0.993146 12.0918 0 13.8721 0C15.6695 0 17.1254 1.01276 17.8875 2.67634L19.7749 6.63999L23.9061 7.22874C25.5829 7.40904 26.9818 8.69117 27.4708 10.2414C28.0943 11.8609 27.5858 13.6174 27.0625 14.6616L26.9706 14.8448L23.7207 18.0867L24.4213 22.4796C24.7378 24.2507 23.9298 25.9975 22.4975 26.9501C21.129 27.8601 19.3601 28.0653 17.8567 27.2328C17.8564 27.2326 17.8571 27.233 17.8567 27.2328L14.1018 25.1629L10.3227 27.2461L10.2995 27.2577C9.6639 27.5747 9.01146 27.7342 8.24288 27.7342C7.24411 27.7342 6.44305 27.3928 5.75687 26.9821L5.7311 26.9667L5.7061 26.9501C4.27377 25.9975 3.46574 24.2507 3.78229 22.4795L4.48291 18.0867L1.37806 14.9896C0.14975 13.7642 -0.356049 12.0099 0.267446 10.2599C0.778719 8.61275 2.23183 7.54576 3.74552 7.24386L3.76539 7.2399L7.96112 6.54233L9.86637 2.54124L9.87209 2.52983ZM12.1331 3.65025L9.67346 8.81566L4.22134 9.72211C3.45667 9.88075 2.85962 10.4018 2.67316 11.0218L2.66272 11.0565L2.65031 11.0906C2.37331 11.8504 2.55823 12.6026 3.16017 13.2031L7.17788 17.2108L6.26997 22.9034L6.26746 22.9171C6.13338 23.6528 6.46373 24.4102 7.08045 24.8334C7.52933 25.0984 7.87068 25.2108 8.24288 25.2108C8.61372 25.2108 8.87645 25.1444 9.15214 25.01L14.1018 22.2815L19.0763 25.0237L19.0788 25.0251C19.6431 25.3378 20.401 25.3138 21.1001 24.849C21.7316 24.429 22.0718 23.6618 21.9361 22.9171L21.9336 22.9034L21.0257 17.2108L24.8885 13.3576C25.2198 12.6132 25.3526 11.7379 25.1081 11.128L25.0871 11.0757L25.0709 11.0218C24.8578 10.3131 24.2152 9.79534 23.6266 9.73665L23.6001 9.73401L18.0787 8.94713L15.5958 3.73304C15.2078 2.88165 14.5981 2.52338 13.8721 2.52338C13.1283 2.52338 12.5121 2.90188 12.1331 3.65025Z";
  const solidPath = fullPath.split('ZM')[0] + 'Z';

  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* If filled, show solid yellow star. If not, show empty star with white outline */}
      <Path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d={filled ? solidPath : fullPath} 
        fill={filled ? "#FACC15" : "transparent"} 
        stroke={filled ? "none" : "#A1A1AA"}
        strokeWidth={filled ? 0 : 1.5}
      />
    </Svg>
  );
};

export default function NurseRatingScreen() {
  const router = useRouter();
  const { callId, name, avatar, duration } = useLocalSearchParams<{ callId: string; name?: string; avatar?: string; duration?: string }>();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawName = (name && name.trim()) || 'Gracia';
  const formattedNurseName = rawName.toLowerCase().startsWith('nurse') ? rawName : `Nurse ${rawName}`;

  const handleSubmit = async () => {
    if (!callId || rating === 0) {
      router.replace('/(tabs)/');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await apiClient.post(`/calls/${callId}/rate`, {
        rating,
        feedback: feedback.trim() || null
      });
    } catch (e) {
      console.error("Failed to submit rating", e);
    } finally {
      setIsSubmitting(false);
      router.replace('/(tabs)/');
    }
  };

  const handleBackToHome = () => {
    router.replace('/(tabs)/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Image
        source={require('../../assets/images/rating-bg.png')}
        style={styles.bgImage}
        contentFit="cover"
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          <View style={styles.headerContainer}>
            <HelixaText weight="bold" style={styles.headerTopText}>
              You connected with
            </HelixaText>
            <HelixaText weight="bold" style={styles.headerNameText}>
              {rawName.replace(/^Nurse\s+/i, '')}
            </HelixaText>
            {duration ? (
              <HelixaText style={styles.headerTimeText}>
                {duration}
              </HelixaText>
            ) : null}
          </View>

          <View style={styles.avatarWrapper}>
            <Image 
              source={avatar ? { uri: avatar } : require('../../assets/images/nurse-img.png')} 
              style={styles.avatarImage} 
              contentFit="cover"
            />
          </View>

          <HelixaText style={styles.title}>
            {`How was your experience with ${formattedNurseName}?`}
          </HelixaText>

          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} style={styles.starIcon}>
                <StarIcon filled={star <= rating} size={32} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Share your feedback (optional)"
              placeholderTextColor="#A1A1AA"
              multiline
              maxLength={220}
              value={feedback}
              onChangeText={setFeedback}
              textAlignVertical="top"
            />
            <HelixaText style={styles.charCount}>
              {feedback.length} / 220
            </HelixaText>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.submitBtn, (rating === 0 || isSubmitting) && { opacity: 0.7 }]} 
              onPress={handleSubmit}
              disabled={rating === 0 || isSubmitting}
            >
              <HelixaText style={styles.submitBtnText}>
                {isSubmitting ? 'Submitting...' : 'Submit Rating'}
              </HelixaText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backBtn} onPress={handleBackToHome}>
              <HelixaText style={styles.backBtnText}>Back to Home</HelixaText>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C0314', // Fallback for dark theme before image loads
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
    paddingTop: 60,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
    zIndex: -1,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  headerTopText: {
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerNameText: {
    fontSize: 28,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  headerTimeText: {
    fontSize: 14,
    color: '#E4E4E7',
  },
  avatarWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: '#D62D88',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  avatarImage: {
    width: 124,
    height: 124,
    borderRadius: 62,
  },
  title: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
    lineHeight: 28,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  starIcon: {
    marginHorizontal: 2,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 40,
  },
  input: {
    backgroundColor: '#5A3348',
    borderRadius: 12,
    padding: 16,
    height: 120,
    borderWidth: 1,
    borderColor: '#B15D8A',
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Helixa',
  },
  charCount: {
    color: '#A1A1AA',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
    marginRight: 4,
  },
  actions: {
    width: '100%',
    gap: 16,
    marginTop: 'auto',
  },
  submitBtn: {
    backgroundColor: '#D62D88',
    width: '100%',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backBtn: {
    backgroundColor: '#5A3348',
    
    width: '100%',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
