import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  style?: StyleProp<ViewStyle | ImageStyle>;
  className?: string; // In case NativeWind is used
}

export function Avatar({ uri, name, style, className }: AvatarProps) {
  // Extract initials
  const getInitials = (fullName: string) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const flatStyle = StyleSheet.flatten(style) || {};
  const width = (typeof flatStyle.width === 'number' ? flatStyle.width : 40) as number;
  const height = (typeof flatStyle.height === 'number' ? flatStyle.height : width) as number;
  const borderRadius = (typeof flatStyle.borderRadius === 'number' ? flatStyle.borderRadius : width / 2) as number;
  const fontSize = width * 0.4; // Scale text based on width

  const hasValidUri = !!uri && typeof uri === 'string' && uri.trim() !== '';

  return (
    <View style={[styles.container, style]} className={className}>
      {hasValidUri ? (
        <Image
          source={{ uri: uri.trim() }}
          style={{ width, height, borderRadius }}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.initials, { fontSize }]}>
          {getInitials(name || 'Unknown')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#182337ff', // Fallback background
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: '#ffffffff',
    fontWeight: 'bold',
  },
});
