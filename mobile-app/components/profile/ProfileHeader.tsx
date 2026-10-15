import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../HelixaText';
import { useTheme } from '../../context/ThemeContext';
import type { Palette } from '../../lib/theme';

type ProfileHeaderProps = {
  firstName: string;
  trimester: string;
  profilePicture?: string | null;
  onPressAvatar?: () => void;
  isUploading?: boolean;
};

export const ProfileHeader = ({ firstName, trimester, profilePicture, onPressAvatar, isUploading }: ProfileHeaderProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <HelixaText weight="bold" style={styles.title}>Profile</HelixaText>
      <TouchableOpacity 
        style={styles.avatarContainer} 
        onPress={onPressAvatar}
        disabled={isUploading}
      >
        <View style={styles.imageWrapper}>
          <Image 
            source={{ uri: profilePicture || 'https://i.pravatar.cc/150' }} 
            style={styles.avatar} 
            contentFit="cover"
          />
        </View>
        {isUploading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="small" color="#FFF" />
          </View>
        )}
        {!isUploading && (
          <View style={styles.editBadge}>
            <Feather name="camera" size={18} color="#FFF" />
          </View>
        )}
      </TouchableOpacity>
      <HelixaText weight="bold" style={styles.name}>{firstName}</HelixaText>
      <HelixaText style={styles.status}>{trimester}</HelixaText>
    </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    color: c.text,
    marginBottom: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: c.bg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
    backgroundColor: c.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#D62D88',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: c.bg,
  },
  name: {
    fontSize: 24,
    color: '#D62D88',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    color: c.textMuted,
  },
});
