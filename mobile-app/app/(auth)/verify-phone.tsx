import React, { useState, useRef, useMemo } from 'react';
import { 
  View, 
  Pressable, 
  TextInput, 
  StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Button } from '../../components/Button';
import { KeyboardScrollView } from '../../components/KeyboardAvoid';
import { useVerifyPhone } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import type { Palette } from '../../lib/theme';
import { Reveal } from '../../components/motion';

export default function VerifyPhoneScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const [code, setCode] = useState(['', '', '', '']);
  const inputs = useRef<Array<TextInput | null>>([]);

  const handleCodeChange = (text: string, index: number) => {
    // Only allow numbers
    const newText = text.replace(/[^0-9]/g, '');
    
    const newCode = [...code];
    newCode[index] = newText;
    setCode(newCode);

    // Auto-advance to next input
    if (newText && index < 3) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace to go to previous input
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  };

  const isComplete = code.every(digit => digit.length === 1);

  const { mutateAsync: verifyPhone, isPending: isSubmitting } = useVerifyPhone();

  const handleVerify = async () => {
    try {
      await verifyPhone({
        otp: code.join(''),
      });
      router.push('/(auth)/permissions');
    } catch (error: any) {
      console.error('Phone verification failed:', error.response?.data || error.message);
      alert(error.response?.data?.error || 'Verification failed');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardScrollView contentContainerStyle={styles.scrollContent}>
          <Reveal index={0}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="chevron-left" size={28} color={colors.text} />
          </Pressable>

          <CalText style={styles.heading}>Enter Verification Code</CalText>
          <HelixaText style={styles.subtext}>
            We sent a 4-digit code to {phone || '(234) 804-3456-574'}
          </HelixaText>
          </Reveal>

          <Reveal index={1}>
          <View style={styles.inputSection}>
            <HelixaText style={styles.inputLabel} weight="bold">Enter Code</HelixaText>
            
            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputs.current[index] = ref; }}
                  style={[styles.boxInput, digit ? styles.boxInputFilled : null]}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={(text) => handleCodeChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  selectTextOnFocus
                />
              ))}
            </View>
          </View>
          </Reveal>

          <Reveal index={2}>
          <Pressable style={styles.resendContainer}>
            <HelixaText style={styles.resendText} weight="bold">Resend Code</HelixaText>
          </Pressable>

          <Button 
            title="Verify"
            onPress={handleVerify}
            isLoading={isSubmitting}
            disabled={!isComplete}
          />
          </Reveal>

        </KeyboardScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
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
    marginBottom: 24,
  },
  heading: {
    fontSize: 28,
    lineHeight: 34,
    color: c.text,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 16,
    color: c.textSecondary,
    lineHeight: 24,
    marginBottom: 32,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 15,
    color: c.text,
    marginBottom: 16,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  boxInput: {
    width: 65,
    height: 65,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    fontSize: 24,
    textAlign: 'center',
    color: c.text,
    fontFamily: 'Helvetica Neue',
    backgroundColor: c.bgSoft,
  },
  boxInputFilled: {
    borderColor: '#D62D88',
    backgroundColor: c.bgSoft,
  },
  resendContainer: {
    alignItems: 'flex-start',
    marginBottom: 40,
  },
  resendText: {
    color: '#D62D88',
    fontSize: 15,
  },
});
