import React, { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';

export const CustomSwitch = ({ value, onValueChange, disabled, activeColor = '#D62D88' }: { value: boolean, onValueChange: (v: boolean) => void, disabled?: boolean, activeColor?: string }) => {
  const translateX = useRef(new Animated.Value(value ? 14 : 0)).current;
  const animatedTrackColor = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: value ? 14 : 0, // width 38, padding 2, thumb 20 -> 38 - 4 - 20 = 14
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(animatedTrackColor, {
        toValue: value ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      })
    ]).start();
  }, [value]);

  const interpolatedTrackColor = animatedTrackColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E7EB', activeColor]
  });

  const trackColor = disabled ? '#9CA3AF' : interpolatedTrackColor;
  const thumbColor = disabled ? '#D1D5DB' : '#FFFFFF';

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
    >
      <Animated.View
        style={{
          width: 38,
          height: 24,
          borderRadius: 15,
          backgroundColor: trackColor,
          justifyContent: 'center',
          paddingHorizontal: 2,
        }}
      >
        <Animated.View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: thumbColor,
            transform: [{ translateX }],
            shadowColor: disabled ? 'transparent' : '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: disabled ? 0 : 0.2,
            shadowRadius: 2,
            elevation: disabled ? 0 : 2,
          }}
        />
      </Animated.View>
    </Pressable>
  );
};
