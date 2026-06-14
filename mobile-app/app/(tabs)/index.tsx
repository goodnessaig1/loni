import { View } from 'react-native';
import { ScreenContent } from '../../components/ScreenContent';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';

export default function HomeTab() {
  return (
    <View className="flex-1 bg-white">
      <ScreenContent title="Home" path="app/(tabs)/index.tsx">
        <CalText className="text-primary text-2xl mt-4 text-center">Home Tab</CalText>
        <HelixaText className="text-gray-700 text-lg mt-2 text-center" weight="regular">
          You are successfully authenticated.
        </HelixaText>
      </ScreenContent>
    </View>
  );
}
