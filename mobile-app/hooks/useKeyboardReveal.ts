import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, NativeScrollEvent, NativeSyntheticEvent, TextInput } from 'react-native';

const GAP = 24; // breathing room between the focused input and the top of the keyboard

/**
 * Keeps the focused input above the keyboard inside a scrolling list. When the keyboard opens, the input
 * may sit behind it, and nothing scrolls it back into view on its own. Pass how to scroll, and put the
 * returned onScroll on the list.
 */
export function useKeyboardReveal(scrollTo: (y: number) => void) {
  const offset = useRef(0);
  const scroll = useRef(scrollTo);
  scroll.current = scrollTo;

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', (e) => {
      // Wait a frame so the list has already shrunk to make room for the keyboard.
      requestAnimationFrame(() => {
        const input = TextInput.State.currentlyFocusedInput() as any;
        input?.measureInWindow?.((_x: number, y: number, _w: number, h: number) => {
          const hidden = y + h + GAP - e.endCoordinates.screenY;
          if (hidden > 0) scroll.current(offset.current + hidden);
        });
      });
    });
    return () => sub.remove();
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  return { onScroll };
}
