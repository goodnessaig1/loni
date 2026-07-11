import React from 'react';
import { Text, TextProps } from 'react-native';

interface HelixaTextProps extends TextProps {
  weight?: 'light' | 'regular' | 'bold' | 'black';
}

export const HelixaText: React.FC<HelixaTextProps> = ({
  className,
  weight = 'regular',
  style,
  ...props
}) => {
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
      style={style}
      {...props}
    />
  );
};
