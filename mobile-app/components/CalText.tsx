import React from 'react';
import { Text, TextProps } from 'react-native';
import { darkTextOverride, hasExplicitColor } from '../lib/textColor';
import { useTheme } from '../context/ThemeContext';

export const CalText: React.FC<TextProps> = ({ className, style, ...props }) => {
  const { colors, isDark } = useTheme();
  return (
    <Text
      className={`font-cal ${className || ''}`}
      style={
        hasExplicitColor(style, className)
          ? isDark && darkTextOverride(className, colors)
            ? [{ color: darkTextOverride(className, colors) }, style]
            : style
          : [{ color: colors.text }, style]
      }
      {...props}
    />
  );
};
