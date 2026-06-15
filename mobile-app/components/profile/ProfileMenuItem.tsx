import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../HelixaText';

type ProfileMenuItemProps = {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  onPress: () => void;
  isLast?: boolean;
  color?: string;
  showArrow?: boolean;
};

export const ProfileMenuItem = ({ 
  icon, 
  title, 
  onPress, 
  isLast = false, 
  color = '#000',
  showArrow = true
}: ProfileMenuItemProps) => {
  return (
    <View style={[styles.container, !isLast && styles.borderBottom]}>
      <TouchableOpacity style={styles.content} onPress={onPress}>
        <View style={styles.left}>
          <Feather name={icon} size={20} color={color} style={styles.icon} />
          <HelixaText weight="bold" style={[styles.title, { color }]}>{title}</HelixaText>
        </View>
        {showArrow && (
          <View style={[styles.arrowContainer, color !== '#000' && { backgroundColor: color }]}>
            <Feather name="arrow-right" size={16} color={color !== '#000' ? '#FFF' : '#000'} />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 18,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 16,
  },
  title: {
    fontSize: 15,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});
