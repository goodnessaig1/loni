import React from 'react';
import { 
  StyleSheet, 
  ActivityIndicator, 
  StyleProp, 
  ViewStyle,
  PressableProps
} from 'react-native';
import { HelixaText } from './HelixaText';
import { PressableScale } from './motion';

interface ButtonProps extends PressableProps {
  title: string;
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ 
  title, 
  isLoading = false, 
  style,
  disabled,
  ...props 
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <PressableScale 
      style={[
        styles.button,
        isDisabled ? styles.buttonDisabled : styles.buttonActive,
        style
      ]}
      disabled={isDisabled}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <HelixaText style={styles.buttonText} weight="bold">
          {title}
        </HelixaText>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 9999,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonActive: {
    backgroundColor: '#D62D88',
  },
  buttonDisabled: {
    backgroundColor: '#F9C2D9',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
