import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../HelixaText';

export const SupportPartnersCard = () => {
  return (
    <TouchableOpacity style={styles.card}>
      <Image 
        source={require('../../assets/images/support.png')} 
        style={styles.bgImage}
        contentFit="cover"
      />
      <View style={styles.content}>
        <Feather name="users" size={20} color="#000" style={styles.icon} />
        <HelixaText weight="bold" style={styles.text}>Add Support Partners</HelixaText>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    height: 96,
    borderRadius: 16,
    marginBottom: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F9FAFB',
  },
  bgImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    zIndex: 2,
  },
  icon: {
    marginRight: 12,
  },
  text: {
    fontSize: 15,
    color: '#000',
  },
});
