import React, { useState } from 'react';
import { 
  View, 
  Pressable, 
  StyleSheet, 
  Platform,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';

type Role = 'nurse' | 'driver' | null;

export default function RoleSelectionScreen() {
  const [selectedRole, setSelectedRole] = useState<Role>(null);

  const handleContinue = () => {
    if (selectedRole === 'nurse') {
      router.push('/(auth)/complete-profile-nurse');
    } else if (selectedRole === 'driver') {
      router.push('/(auth)/become-driver');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color="black" />
        </Pressable>

        <CalText style={styles.heading}>How will you use LONI Server?</CalText>
        <HelixaText style={styles.subtext}>Select your role to continue.</HelixaText>

        <View style={styles.cardsContainer}>
          {/* Nurse Card */}
          <Pressable 
            style={[styles.card, selectedRole === 'nurse' && styles.cardSelected]}
            onPress={() => setSelectedRole('nurse')}
          >
            <View style={styles.iconContainer}>
              <FontAwesome5 name="user-nurse" size={24} color="#D62D88" />
            </View>
            <View style={styles.cardTextContainer}>
              <HelixaText style={styles.cardTitle} weight="bold">Nurse</HelixaText>
              <HelixaText style={styles.cardDescription}>
                Receive support calls, speak with mothers, and provide compassionate care.
              </HelixaText>
            </View>
            <View style={[styles.radio, selectedRole === 'nurse' && styles.radioSelected]}>
              {selectedRole === 'nurse' && <Feather name="check" size={14} color="#FFFFFF" />}
            </View>
          </Pressable>

          {/* Driver Card */}
          <Pressable 
            style={[styles.card, selectedRole === 'driver' && styles.cardSelected]}
            onPress={() => setSelectedRole('driver')}
          >
            <View style={styles.iconContainer}>
              <FontAwesome5 name="car" size={24} color="#D62D88" />
            </View>
            <View style={styles.cardTextContainer}>
              <HelixaText style={styles.cardTitle} weight="bold">Driver</HelixaText>
              <HelixaText style={styles.cardDescription}>
                Transport mothers and supplies with reliable, safe delivery service.
              </HelixaText>
            </View>
            <View style={[styles.radio, selectedRole === 'driver' && styles.radioSelected]}>
              {selectedRole === 'driver' && <Feather name="check" size={14} color="#FFFFFF" />}
            </View>
          </Pressable>
        </View>

        <View style={styles.buttonWrapper}>
          <Button 
            title="Continue"
            onPress={handleContinue}
            disabled={!selectedRole}
          />
        </View>

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
    marginBottom: 24,
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    color: '#000000',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 32,
  },
  cardsContainer: {
    gap: 16,
    flex: 1, // Pushes the button to the bottom if content is short
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  cardSelected: {
    borderColor: '#F9A8D4', // light pink border
    backgroundColor: '#FFF0F5', // very light pink background
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FCE7F3', // pink tinted background for icon
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: '#D62D88',
    borderColor: '#D62D88',
  },
  buttonWrapper: {
    marginTop: 40,
  }
});
