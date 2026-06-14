import React from 'react';
import { Text, TextProps } from 'react-native';

export const CalText: React.FC<TextProps> = ({ className, style, ...props }) => {
  return (
    <Text
      className={`font-cal ${className || ''}`}
      style={style}
      {...props}
    />
  );
};
