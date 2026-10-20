import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../HelixaText';
import { useTheme } from '../../context/ThemeContext';

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
  color,
  showArrow = true
}: ProfileMenuItemProps) => {
  const { colors } = useTheme();
  const accent = color !== undefined; // a custom colour (e.g. the red Sign Out) fills the arrow circle
  const tint = color ?? colors.text;
  return (
    <View style={[styles.container, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
      <TouchableOpacity style={styles.content} onPress={onPress}>
        <View style={styles.left}>
          <Feather name={icon} size={20} color={tint} style={styles.icon} />
          <HelixaText weight="bold" style={[styles.title, { color: tint }]}>{title}</HelixaText>
        </View>
        {showArrow && (
          <View style={[styles.arrowContainer, { backgroundColor: accent ? tint : colors.elevated }]}>
            <Feather name="arrow-right" size={16} color={accent ? '#FFF' : colors.text} />
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
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});
