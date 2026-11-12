// NOTE: the actual `registerGlobals()` call LiveKit requires lives in
// index.js (the true JS entry point) - a bare `import '@livekit/react-native'`
// here loads the module but does NOT register the WebRTC globals it
// needs. See the comment in index.js for the full explanation.
import '@livekit/react-native';
import 'react-native-reanimated';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { EmergencyContactsProvider } from '../context/EmergencyContactsContext';
import { NotificationProvider } from '../context/NotificationContext';
import { CallModals } from '../components/CallModals';
import { RideTrackerHost } from '../components/RideTrackerModal';
import { useSubscriptionSync } from '../hooks/useSubscription';
import { useSyncTimezone } from '../hooks/useCheckins';

import '../global.css';

import Toast from 'react-native-toast-message';
import { OfflineBanner } from '../components/OfflineBanner';

// The native splash stays up until the first real screen is drawn (it used to drop while fonts loaded, leaving a
// blank frame), then fades instead of cutting.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 400, fade: true });

/** Inside the providers so it can read the theme: the stack's background must follow it, or page transitions flash white in dark mode. */
function ThemedShell() {
  const { colors } = useTheme();
  useSubscriptionSync();
  useSyncTimezone();
  useEffect(() => { SplashScreen.hide(); }, []);
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'ios_from_right', gestureEnabled: true }}>
        <Stack.Screen name="index" />
        {/* Faded in from the launch logo; a slide here showed the logo being pushed off to the left. */}
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        {/* Opened in place of the chat tab, so a fade reads as the same screen settling rather than a new page sliding over it. */}
        <Stack.Screen name="chat/conversation" options={{ animation: 'fade', animationDuration: 200 }} />
      </Stack>
      <RideTrackerHost />
      <CallModals />
      <OfflineBanner />
      <StatusBar style="auto" />
      <Toast />
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    'CalSans': require('../assets/fonts/CalSans-Regular.ttf'),
    'Helixa-Regular': require('../assets/fonts/Helixa-Regular.ttf'),
    'Helixa-Light': require('../assets/fonts/Helixa-Light.ttf'),
    'Helixa-Bold': require('../assets/fonts/Helixa-Bold.ttf'),
    'Helixa-Black': require('../assets/fonts/Helixa-Black.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationProvider>
            <EmergencyContactsProvider>
              <ThemedShell />
            </EmergencyContactsProvider>
          </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
