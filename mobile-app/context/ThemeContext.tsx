import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Palette, PALETTES, Scheme, ThemePreference } from '../lib/theme';

const STORAGE_KEY = 'themePreference';

type ThemeContextType = {
  /** What the user picked: light, dark, or follow the device. */
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** What is actually showing right now. */
  scheme: Scheme;
  isDark: boolean;
  colors: Palette;
};

const ThemeContext = createContext<ThemeContextType>({
  preference: 'system',
  setPreference: () => {},
  scheme: 'light',
  isDark: false,
  colors: PALETTES.light,
});

function isPreference(v: unknown): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system';
}

/**
 * Applying a preference sets the OS-level override (`Appearance.setColorScheme`), so native chrome that
 * ignores our JS colours - the keyboard, alerts, the status bar, date pickers - follows the choice too.
 * `null` hands control back to the device ("System").
 */
function applyToSystem(p: ThemePreference) {
  try {
    Appearance.setColorScheme(p === 'system' ? null : p);
  } catch {
    /* older runtimes without the override: our own `scheme` below still switches every screen */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);
  const systemScheme = useColorScheme();

  // Load the saved choice before anything renders, so there is no flash of the wrong theme.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved: ThemePreference = 'system';
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (isPreference(raw)) saved = raw;
      } catch {
        /* unreadable: default to following the device */
      }
      if (cancelled) return;
      applyToSystem(saved);
      setPreferenceState(saved);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    applyToSystem(p);
    SecureStore.setItemAsync(STORAGE_KEY, p).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextType>(() => {
    // An explicit choice always wins; "system" follows the device (and re-renders when it changes).
    const scheme: Scheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
    return { preference, setPreference, scheme, isDark: scheme === 'dark', colors: PALETTES[scheme] };
  }, [preference, setPreference, systemScheme]);

  if (!ready) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
