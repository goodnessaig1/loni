import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../../components/HelixaText';
import { useRouter, Tabs } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const SUPPORT_OPTIONS = [
  {
    id: 1,
    title: 'Pregnancy Support ?',
    image: require('../../assets/images/pregnancy-support.png'),
  },
  {
    id: 2,
    title: 'Recovery Support ?',
    image: require('../../assets/images/recovery-support.png'),
  },
  {
    id: 3,
    title: 'Emotional Support ?',
    image: require('../../assets/images/emotional-support.png'),
  },
  {
    id: 4,
    title: 'Emergency Guidance ?',
    image: require('../../assets/images/emergency-support.png'),
  },
];

export default function ChatScreen() {
  const router = useRouter();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const handleStartConversation = () => {
    if (selectedOption !== null) {
      // Navigate to actual chat or next step
      // router.push('/chat/conversation');
    }
  };

  return (
    <>
      <Tabs.Screen options={{ tabBarStyle: { display: 'none' } }} />
      <LinearGradient
        colors={['#D62D88', '#F18C61', '#D62D88']}
        locations={[0, 0.5, 1]}
        style={{ flex: 1 }}
      >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 40, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View className="items-center px-6 mb-10">
            <HelixaText 
              className="text-white text-[36px] text-center leading-[42px] mb-3" 
              weight="bold"
            >
              What's on your{'\n'}mind today?
            </HelixaText>
            <HelixaText className="text-white/90 text-[16px] text-center">
              Tell Loni how you feel.
            </HelixaText>
          </View>

          {/* Grid Options */}
          <View className="flex-row flex-wrap justify-between px-6">
            {SUPPORT_OPTIONS.map((option) => {
              const isSelected = selectedOption === option.id;
              
              return (
                <TouchableOpacity
                  key={option.id}
                  activeOpacity={0.8}
                  onPress={() => setSelectedOption(option.id)}
                  style={{
                    width: (width - 48 - 16) / 2, // 48 is px-6 * 2, 16 is gap
                    height: 180,
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.15)',
                    borderRadius: 24,
                    marginBottom: 16,
                    borderWidth: isSelected ? 2 : 0,
                    borderColor: 'white',
                    overflow: 'hidden',
                  }}
                  className="items-center"
                >
                  <View className="flex-1 justify-center items-center w-full mt-4">
                    <Image 
                      source={option.image} 
                      style={{ width: 100, height: 100 }} 
                      resizeMode="contain" 
                    />
                  </View>
                  
                  {/* Title */}
                  <View className="pb-5 px-2">
                    <HelixaText weight='black' className="text-white text-[13px] text-center">
                      {option.title}
                    </HelixaText>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bottom Section */}
          <View className="mt-4 items-center">
            <Feather name="chevron-down" size={28} color="rgba(255,255,255,0.8)" />
          </View>

          <View className="px-6 mt-8">
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={selectedOption === null}
              onPress={handleStartConversation}
              className={`w-full h-[64px] rounded-full justify-center items-center ${
                selectedOption !== null ? 'bg-black' : 'bg-black/20'
              }`}
            >
              <HelixaText 
                className={`text-[17px] ${selectedOption !== null ? 'text-white' : 'text-white/50'}`} 
                weight="bold"
              >
                Start Conversation
              </HelixaText>
            </TouchableOpacity>
          </View>

          <View className="mt-8 items-center">
            <TouchableOpacity onPress={() => router.push('/')} activeOpacity={0.6}>
              <HelixaText className="text-white text-[16px]" weight="bold">
                Back to Home
              </HelixaText>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
    </>
  );
}
