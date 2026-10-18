import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, ScrollView, Dimensions, Image, ImageBackground, Animated } from 'react-native';

import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../../components/HelixaText';
import { useRouter, Tabs } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { chatTopicsFor } from '../../lib/chatTopics';
import { PressableScale, Reveal, RevealList } from '../../components/motion';

const { width } = Dimensions.get('window');

const IMAGES = {
  pregnancy: require('../../assets/images/pregnancy-support.png'),
  recovery: require('../../assets/images/recovery-support.png'),
  emotional: require('../../assets/images/emotional-support.png'),
  emergency: require('../../assets/images/emergency-support.png'),
} as const;

import * as SecureStore from 'expo-secure-store';
import { useFocusEffect } from 'expo-router';

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const SUPPORT_OPTIONS = React.useMemo(() => chatTopicsFor(user?.status).map((t) => ({ ...t, image: IMAGES[t.image] })), [user?.status]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const bounceValue = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      const checkOnboarding = async () => {
        const hasSeen = await SecureStore.getItemAsync('hasSeenChatIntro');
        if (hasSeen === 'true') {
          if (isActive) router.replace('/chat/conversation');
        } else {
          if (isActive) setIsChecking(false);
        }
      };
      checkOnboarding();
      return () => { isActive = false; };
    }, [])
  );

  useEffect(() => {
    if (selectedOption !== null) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounceValue, {
            toValue: 8,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(bounceValue, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      bounceValue.stopAnimation();
      bounceValue.setValue(0);
    }
  }, [selectedOption, bounceValue]);

  const handleStartConversation = async () => {
    if (selectedOption !== null) {
      await SecureStore.setItemAsync('hasSeenChatIntro', 'true');
      const selected = SUPPORT_OPTIONS.find(o => o.id === selectedOption);
      router.replace({
        pathname: '/chat/conversation',
        params: { optionId: selectedOption, optionTitle: selected?.title }
      });
    }
  };

  if (isChecking) {
    return <View style={{ flex: 1, backgroundColor: '#D62D88' }} />;
  }

  return (
    <>
      <Tabs.Screen options={{ tabBarStyle: { display: 'none' } }} />
      <ImageBackground
        source={require('../../assets/images/chat.jpg')}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 40, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <Reveal index={0}>
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
          </Reveal>

          {/* Grid Options */}
          <View className="flex-row flex-wrap justify-between px-6">
            {SUPPORT_OPTIONS.map((option, index) => {
              const isSelected = selectedOption === option.id;
              
              return (
                <RevealList key={option.id} index={index} delay={70}>
                <PressableScale
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
                    alignItems: 'center',
                  }}
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
                </PressableScale>
                </RevealList>
              );
            })}
          </View>

          {/* Bottom Section */}
          <Reveal index={2}>
          <View className="mt-4 items-center h-8 justify-center">
            <Animated.View style={{ transform: [{ translateY: bounceValue }] }}>
              <Feather name="chevrons-down" size={28} color="rgba(255,255,255,0.8)" />
            </Animated.View>
          </View>
          </Reveal>

          <Reveal index={3}>
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
          </Reveal>

          <Reveal index={4}>
          <View className="mt-8 items-center">
            <TouchableOpacity onPress={() => router.push('/')} activeOpacity={0.6}>
              <HelixaText className="text-white text-[16px]" weight="bold">
                Back to Home
              </HelixaText>
            </TouchableOpacity>
          </View>
          </Reveal>

        </ScrollView>
      </SafeAreaView>
      </ImageBackground>
    </>
  );
}
