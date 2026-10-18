// NOTE: the actual `registerGlobals()` call LiveKit requires lives in
// index.js (the true JS entry point) - a bare `import '@livekit/react-native'`
// here loads the module but does NOT register the WebRTC globals it
// needs. See the comment in index.js for the full explanation.
import '@livekit/react-native';
import 'react-native-reanimated';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
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

/** Inside the providers so it can read the theme: the stack's background must follow it, or page transitions flash white in dark mode. */
function ThemedShell() {
  const { colors } = useTheme();
  useSubscriptionSync();
  useSyncTimezone();
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <RideTrackerHost />
      <CallModals />
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
