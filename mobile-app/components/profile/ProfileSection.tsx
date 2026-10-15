import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

type ProfileSectionProps = {
  children: React.ReactNode;
  backgroundColor?: string;
};

export const ProfileSection = ({ children, backgroundColor }: ProfileSectionProps) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: backgroundColor ?? colors.surface }]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
});
