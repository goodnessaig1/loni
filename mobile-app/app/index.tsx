import { Redirect } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useAuth } from '../hooks/useAuth';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    // The native splash, drawn again in the same place and size (app.json `imageWidth`), so when it fades out
    // nothing moves while the user is loaded.
    return (
      <View style={styles.splash}>
        <Image source={require('../assets/logo.svg')} style={styles.logo} contentFit="contain" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(tabs)" />;
  } else {
    return <Redirect href="/(auth)" />;
  }
}

const styles = StyleSheet.create({
  splash: { ...StyleSheet.absoluteFillObject, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 120, height: 100 },
});
