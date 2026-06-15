import React from 'react';
import { View, StyleSheet } from 'react-native';

type ProfileSectionProps = {
  children: React.ReactNode;
  backgroundColor?: string;
};

export const ProfileSection = ({ children, backgroundColor = '#F3F3F3' }: ProfileSectionProps) => {
  return (
    <View style={[styles.section, { backgroundColor }]}>
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
