import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard, KeyboardAvoidingView, KeyboardAvoidingViewProps, Platform, ScrollView, ScrollViewProps, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardReveal } from '../hooks/useKeyboardReveal';

/**
 * Lifts its content above the keyboard, on both platforms. The app draws edge-to-edge, so on Android the
 * window no longer shrinks when the keyboard opens and leaving `behavior` unset does nothing.
 */
export function KeyboardAvoid(props: KeyboardAvoidingViewProps) {
  return <KeyboardAvoidingView behavior="padding" {...props} />;
}

/**
 * KeyboardAvoid for the full-screen content of a <Modal>. On Android a Modal is its own window, and the
 * keyboard position React Native reports is measured from the screen underneath it, so this goes by the
 * keyboard's height instead. That height leaves out the navigation bar, which the keyboard also covers.
 */
export function ModalKeyboardAvoid({ style, ...props }: KeyboardAvoidingViewProps) {
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'ios') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (Platform.OS === 'ios') return <KeyboardAvoid style={style} {...props} />;
  return <View style={[style, keyboard > 0 && { paddingBottom: keyboard + insets.bottom }]} {...props} />;
}

/** A form screen's scroll view: stays above the keyboard and keeps the focused input in view. */
export function KeyboardScrollView({ onScroll, ...props }: ScrollViewProps) {
  const ref = useRef<ScrollView>(null);
  const reveal = useKeyboardReveal((y) => ref.current?.scrollTo({ y, animated: true }));

  return (
    <KeyboardAvoid style={{ flex: 1 }}>
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        {...props}
        onScroll={(e) => {
          reveal.onScroll(e);
          onScroll?.(e);
        }}
      />
    </KeyboardAvoid>
  );
}
