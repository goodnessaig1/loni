import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';

import '../global.css';

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
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
