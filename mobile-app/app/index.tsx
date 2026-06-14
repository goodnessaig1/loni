import { Redirect } from 'expo-router';

export default function Index() {
  // Simulate an unauthenticated state for now to show onboarding
  const isAuthenticated = false;

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/(auth)" />;
  }
}
