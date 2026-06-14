import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { CalText } from '../components/CalText';
import { HelixaText } from '../components/HelixaText';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center p-5 bg-white">
        <CalText className="text-2xl font-bold mb-4 text-primary">This screen doesn't exist.</CalText>
        <Link href="/" className="mt-4 pt-4">
          <HelixaText className="text-blue-500">Go to home screen!</HelixaText>
        </Link>
      </View>
    </>
  );
}
