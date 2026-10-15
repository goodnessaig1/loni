import React from 'react';
import { Text, TextProps } from 'react-native';
import { darkTextOverride, hasExplicitColor } from '../lib/textColor';
import { useTheme } from '../context/ThemeContext';

interface HelixaTextProps extends TextProps {
  weight?: 'light' | 'regular' | 'bold' | 'black';
}

export const HelixaText: React.FC<HelixaTextProps> = ({
  className,
  weight = 'regular',
  style,
  ...props
}) => {
  const { colors, isDark } = useTheme();
  const fontClass =
    weight === 'light'
      ? 'font-helixa-light'
      : weight === 'bold'
        ? 'font-helixa-bold'
        : weight === 'black'
          ? 'font-helixa-black'
          : 'font-helixa';

  return (
    <Text
      className={`${fontClass} ${className || ''}`}
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
