import { Stack } from 'expo-router';

/** Full-screen driver flow screens (request offer, live trip/navigation,
 *  trip summary) - presented over the driver tabs, no tab bar. */
export default function DriverStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_bottom' }}>
      <Stack.Screen name="request/[id]" options={{ presentation: 'transparentModal' }} />
      <Stack.Screen name="overview/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="trip/[id]" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="trip/[id]/complete" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
