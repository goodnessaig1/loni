import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ScreenContent } from '../../components/ScreenContent';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';

export default function ProfileTab() {
  return (
    <View className="flex-1 bg-white">
      <ScreenContent title="Profile" path="app/(tabs)/profile.tsx">
        <CalText className="text-primary text-2xl mt-4 text-center">User Profile</CalText>
        <Pressable 
          className="mt-8 bg-red-100 py-3 px-8 rounded-full items-center active:opacity-80"
          onPress={() => router.replace('/(auth)')}
        >
          <HelixaText className="text-red-600 text-base" weight="bold">Log Out</HelixaText>
        </Pressable>
      </ScreenContent>
    </View>
  );
}
