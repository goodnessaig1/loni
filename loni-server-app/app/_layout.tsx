import 'react-native-reanimated';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { EmergencyContactsProvider } from '../context/EmergencyContactsContext';
import { NotificationProvider } from '../context/NotificationContext';

import '../global.css';

import Toast from 'react-native-toast-message';

const queryClient = new QueryClient();

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
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
            <StatusBar style="auto" />
            <Toast />
          </EmergencyContactsProvider>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
