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
import { AuthProvider } from '../context/AuthContext';
import { EmergencyContactsProvider } from '../context/EmergencyContactsContext';
import { NotificationProvider } from '../context/NotificationContext';
import { CallModals } from '../components/CallModals';
import { queryClient } from '../lib/queryClient';

import '../global.css';

import Toast from 'react-native-toast-message';
import { OfflineBanner } from '../components/OfflineBanner';

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <EmergencyContactsProvider>
            <Stack screenOptions={{ headerShown: false, animation: 'ios_from_right', gestureEnabled: true }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(driver)" />
              <Stack.Screen name="driver" />
              <Stack.Screen name="(partner)" />
              <Stack.Screen name="partner" />
            </Stack>
            <CallModals />
      <OfflineBanner />
            <StatusBar style="auto" />
            <Toast />
          </EmergencyContactsProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
