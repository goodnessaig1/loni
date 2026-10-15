import React from 'react';
import { View, Modal, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as RNImage } from 'react-native';
import { HelixaText } from './HelixaText';
import { useTheme } from '../context/ThemeContext';

export interface ActionModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  icon: React.ReactNode;
  primaryButtonText: string;
  onPrimaryPress: () => void;
  isPrimaryLoading?: boolean;
  primaryButtonColor?: string;
  primaryButtonTextColor?: string;
  secondaryButtonText: string;
  onSecondaryPress: () => void;
  secondaryButtonColor?: string;
  secondaryButtonTextColor?: string;
  children?: React.ReactNode;
}

export const ActionModal = ({
  visible,
  onClose,
  title,
  description,
  icon,
  primaryButtonText,
  onPrimaryPress,
  isPrimaryLoading = false,
  primaryButtonColor,
  primaryButtonTextColor,
  secondaryButtonText,
  onSecondaryPress,
  secondaryButtonColor,
  secondaryButtonTextColor,
  children
}: ActionModalProps) => {
  const { colors, isDark } = useTheme();
  // Light: black primary / grey secondary. Dark: white primary / raised secondary (a black button would vanish).
  const primaryBg = primaryButtonColor ?? (isDark ? '#FFFFFF' : '#000000');
  const primaryFg = primaryButtonTextColor ?? (isDark ? '#000000' : '#FFFFFF');
  const secondaryBg = secondaryButtonColor ?? (isDark ? '#23262D' : '#F3F4F6');
  const secondaryFg = secondaryButtonTextColor ?? (isDark ? '#D1D5DB' : '#4B5563');
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable 
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} 
          onPress={onClose} 
        />
        <View style={{ width: '100%', backgroundColor: colors.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 0, paddingBottom: 40, alignItems: 'center', overflow: 'hidden' }}>
          {isDark ? (
            // The light artwork fades to white, so in dark mode the same shape is drawn in code:
            // a pink cap with the card's own colour curving up into it.
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 210, backgroundColor: '#F36CB6', overflow: 'hidden' }}>
              <View style={{ position: 'absolute', top: 120, left: '-25%', width: '150%', height: 400, borderRadius: 400, backgroundColor: colors.bg }} />
            </View>
          ) : (
            <RNImage
              source={require('../assets/images/confirm.png')}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: 480 }}
              resizeMode="stretch"
            />
          )}

          <View style={{ width: 56, height: 6, backgroundColor: isDark ? '#3A3D44' : '#D1D5DB', borderRadius: 3, marginTop: 10, marginBottom: 40 }} />

          <View style={{ marginBottom: 24 }}>
            {icon}
          </View>

          <HelixaText style={{ fontSize: 24, color: colors.text, marginBottom: 12, paddingHorizontal: 24, textAlign: 'center' }} weight="bold">
            {title}
          </HelixaText>

          <HelixaText style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 40, marginBottom: 32, lineHeight: 22 }}>
            {description}
          </HelixaText>

          {children && (
            <View style={{ width: '100%', paddingHorizontal: 32, marginBottom: 32 }}>
              {children}
            </View>
          )}

          <View style={{ width: '100%', paddingHorizontal: 24, gap: 12 }}>
            <TouchableOpacity 
              style={{ width: '100%', backgroundColor: isPrimaryLoading ? '#9CA3AF' : primaryBg, paddingVertical: 18, borderRadius: 30, alignItems: 'center' }}
              onPress={onPrimaryPress}
              disabled={isPrimaryLoading}
            >
              {isPrimaryLoading ? (
                <ActivityIndicator color={primaryFg} size="small" />
              ) : (
                <HelixaText style={{ color: primaryFg, fontSize: 16 }} weight="bold">
                  {primaryButtonText}
                </HelixaText>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ width: '100%', backgroundColor: secondaryBg, paddingVertical: 18, borderRadius: 30, alignItems: 'center', opacity: isPrimaryLoading ? 0.5 : 1 }}
              onPress={onSecondaryPress}
              disabled={isPrimaryLoading}
            >
              <HelixaText style={{ color: secondaryFg, fontSize: 16 }} weight="bold">{secondaryButtonText}</HelixaText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
