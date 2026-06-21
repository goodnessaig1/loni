import React from 'react';
import { View, Modal, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as RNImage } from 'react-native';
import { HelixaText } from './HelixaText';

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
  primaryButtonColor = '#000000',
  primaryButtonTextColor = '#FFFFFF',
  secondaryButtonText,
  onSecondaryPress,
  secondaryButtonColor = '#F3F4F6',
  secondaryButtonTextColor = '#4B5563',
  children
}: ActionModalProps) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable 
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} 
          onPress={onClose} 
        />
        <View style={{ width: '100%', backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 0, paddingBottom: 40, alignItems: 'center', overflow: 'hidden' }}>
          <RNImage 
            source={require('../assets/images/confirm.png')} 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: 480 }} 
            resizeMode="stretch" 
          />

          <View style={{ width: 56, height: 6, backgroundColor: '#D1D5DB', borderRadius: 3, marginTop: 10, marginBottom: 40 }} />

          <View style={{ marginBottom: 24 }}>
            {icon}
          </View>

          <HelixaText style={{ fontSize: 24, color: '#000', marginBottom: 12, paddingHorizontal: 24, textAlign: 'center' }} weight="bold">
            {title}
          </HelixaText>

          <HelixaText style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', paddingHorizontal: 40, marginBottom: 32, lineHeight: 22 }}>
            {description}
          </HelixaText>

          {children && (
            <View style={{ width: '100%', paddingHorizontal: 32, marginBottom: 32 }}>
              {children}
            </View>
          )}

          <View style={{ width: '100%', paddingHorizontal: 24, gap: 12 }}>
            <TouchableOpacity 
              style={{ width: '100%', backgroundColor: isPrimaryLoading ? '#9CA3AF' : primaryButtonColor, paddingVertical: 18, borderRadius: 30, alignItems: 'center' }}
              onPress={onPrimaryPress}
              disabled={isPrimaryLoading}
            >
              {isPrimaryLoading ? (
                <ActivityIndicator color={primaryButtonTextColor} size="small" />
              ) : (
                <HelixaText style={{ color: primaryButtonTextColor, fontSize: 16 }} weight="bold">
                  {primaryButtonText}
                </HelixaText>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ width: '100%', backgroundColor: secondaryButtonColor, paddingVertical: 18, borderRadius: 30, alignItems: 'center', opacity: isPrimaryLoading ? 0.5 : 1 }}
              onPress={onSecondaryPress}
              disabled={isPrimaryLoading}
            >
              <HelixaText style={{ color: secondaryButtonTextColor, fontSize: 16 }} weight="bold">{secondaryButtonText}</HelixaText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
