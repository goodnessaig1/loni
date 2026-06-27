import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Animated, ActivityIndicator, Modal, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../../components/HelixaText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumaIcon } from '../../components/icons/LumaIcon';
import { useAIChat } from '../../hooks/useAIChat';
import Markdown from 'react-native-markdown-display';

// --- Helper Components ---

const PulseView = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }} className={className}>
      {children}
    </Animated.View>
  );
};

const ChatSkeleton = () => (
  <View className="flex-1 px-6 pb-4 justify-end">
    {/* Extra bubbles to fill the screen */}
    <PulseView className="flex-row items-end mb-8 opacity-50">
      <View className="relative top-11 z-10 -mr-1 w-12 h-12 rounded-full bg-white/50 shadow-sm" />
      <View className="bg-white/40 rounded-[24px] rounded-bl-none h-16 w-[65%] shadow-sm" />
    </PulseView>
    
    <PulseView className="flex-row justify-end mb-8 opacity-50">
      <View className="bg-[#C82A81]/30 rounded-[24px] rounded-br-none h-20 w-[75%] shadow-sm" />
    </PulseView>

    <PulseView className="flex-row items-end mb-8 opacity-70">
      <View className="relative top-11 z-10 -mr-1 w-12 h-12 rounded-full bg-white/50 shadow-sm" />
      <View className="bg-white/40 rounded-[24px] rounded-bl-none h-24 w-[85%] shadow-sm" />
    </PulseView>
    
    <PulseView className="flex-row justify-end mb-8 opacity-80">
      <View className="bg-[#C82A81]/30 rounded-[24px] rounded-br-none h-12 w-[50%] shadow-sm" />
    </PulseView>

    {/* Original bottom bubbles */}
    <PulseView className="flex-row items-end mb-8">
      <View className="relative top-11 z-10 -mr-1 w-12 h-12 rounded-full bg-white/50 shadow-sm" />
      <View className="bg-white/40 rounded-[24px] rounded-bl-none h-28 w-[80%] shadow-sm" />
    </PulseView>
    
    <PulseView className="flex-row justify-end mb-8">
      <View className="bg-[#C82A81]/30 rounded-[24px] rounded-br-none h-16 w-[70%] shadow-sm" />
    </PulseView>

    <PulseView className="flex-row items-end mb-4">
      <View className="relative top-11 z-10 -mr-1 w-12 h-12 rounded-full bg-white/50 shadow-sm" />
      <View className="bg-white/40 rounded-[24px] rounded-bl-none h-20 w-[60%] shadow-sm" />
    </PulseView>
  </View>
);

const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: -5, duration: 300, delay, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(400)
        ])
      ).start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 200);
    animateDot(dot3, 400);
  }, [dot1, dot2, dot3]);

  const Dot = ({ anim }: { anim: Animated.Value }) => (
    <Animated.View 
      style={{ transform: [{ translateY: anim }] }} 
      className="w-1.5 h-1.5 rounded-full bg-gray-400 mx-0.5" 
    />
  );

  return (
    <View className="flex-row items-center h-6 px-1">
      <Dot anim={dot1} />
      <Dot anim={dot2} />
      <Dot anim={dot3} />
    </View>
  );
};

// --- Main Screen ---

export default function ConversationScreen() {
  const router = useRouter();
  const { optionTitle, existingSessionId } = useLocalSearchParams<{ optionTitle: string, existingSessionId: string }>();
  const flatListRef = useRef<FlatList>(null);
  
  const [inputText, setInputText] = useState('');
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  
  // Real AI hook with pagination
  const { 
    sessionId,
    messages, 
    sendMessage, 
    initializeSession, 
    fetchMessages,
    isLoading, 
    isLoadingMore,
    hasMore,
    error, 
    stopStream 
  } = useAIChat();

  const hasInitialized = useRef(false);

  // Initialize session automatically
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const start = async () => {
      const title = optionTitle || 'Support Chat';
      const newSessionId = await initializeSession(title, existingSessionId);
      
      // If we created a BRAND NEW session with an optionTitle context, trigger the first message
      if (!existingSessionId && newSessionId && optionTitle) {
        await sendMessage(`I need some help or information regarding: ${optionTitle}`, newSessionId);
      }
    };
    start();
    
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionTitle, existingSessionId]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    const textToSend = inputText.trim();
    setInputText('');
    
    // In an inverted list, index 0 is the bottom. Scroll to bottom smoothly.
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    
    // Send it off to our streaming AI backend
    await sendMessage(textToSend);
  };

  const handleLoadMore = () => {
    if (sessionId && hasMore && !isLoadingMore) {
      fetchMessages(sessionId, messages.length);
    }
  };

  const renderMessage = ({ item: msg, index }: { item: any, index: number }) => {
    if (msg.role === 'user') {
      return (
        <View key={msg.id || index} className="flex-row justify-end mb-8">
          <View className="bg-[#C82A81] rounded-[24px] rounded-br-none px-5 py-4 shadow-sm max-w-[80%] flex-row items-end">
            <HelixaText className="text-[15px] leading-6 text-white">
              {msg.content}
            </HelixaText>
          </View>
        </View>
      );
    } else {
      // Assistant Message
      return (
        <View key={msg.id || index} className="flex-row items-end mb-8">
          <View className="relative top-11 z-10 -mr-1 w-12 h-12 rounded-full bg-white items-center justify-center shadow-sm">
            <LumaIcon size={24} />
          </View>
          <View className="bg-white rounded-[24px] rounded-bl-none px-5 py-4 shadow-sm max-w-[80%]">
            {msg.isStreaming && !msg.content ? (
              <TypingIndicator />
            ) : (
              <Markdown 
                style={{
                  body: {
                    color: 'black',
                    fontSize: 15,
                    lineHeight: 24,
                    fontFamily: 'Inter-Regular',
                  },
                  strong: {
                    fontFamily: 'Inter-Bold',
                  }
                }}
              >
                {msg.content}
              </Markdown>
            )}
          </View>
        </View>
      );
    }
  };

  return (
    <LinearGradient
      colors={['#FFC2E3', '#FFEFF8']}
      locations={[0.1082, 0.7028]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
            <TouchableOpacity 
              onPress={() => router.back()}
              className="w-12 h-12 rounded-full bg-white items-center justify-center shadow-sm"
            >
              <Feather name="arrow-left" size={24} color="black" />
            </TouchableOpacity>
            
            <HelixaText className="text-[20px]" weight="bold" numberOfLines={1} style={{ maxWidth: '60%' }}>
              {optionTitle || 'Loni Support'}
            </HelixaText>
            
            <TouchableOpacity 
              onPress={() => setIsDropdownVisible(true)}
              className="w-12 h-12 rounded-full bg-white items-center justify-center shadow-sm"
            >
              <Feather name="more-horizontal" size={24} color="black" />
            </TouchableOpacity>
          </View>

          {/* Chat Area */}
          {/* {!isLoading  ? ( */}
          {isLoading && messages.length === 0 ? (
            <ChatSkeleton />
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              inverted
              keyExtractor={(item, index) => item.id || index.toString()}
              renderItem={renderMessage}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 }}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                isLoadingMore ? (
                  <View className="items-center justify-center py-4">
                    <ActivityIndicator color="#C82A81" size="small" />
                  </View>
                ) : error ? (
                  <View className="items-center py-4">
                    <HelixaText className="text-red-500 text-sm mt-2">{error}</HelixaText>
                  </View>
                ) : null
              }
            />
          )}

          {/* Input Area */}
          <View className="px-6 py-4 pb-8">
            <View className="flex-row items-center bg-black rounded-full pl-6 pr-2 py-2 min-h-[64px]">
              <TextInput
                className="flex-1 text-white text-[15px] py-3"
                placeholder="Ask Loni..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                className="w-12 h-12 rounded-full bg-white items-center justify-center ml-2"
                onPress={isLoading ? stopStream : handleSend}
                disabled={!isLoading && !inputText.trim()}
              >
                {isLoading ? (
                  <MaterialCommunityIcons name="checkbox-blank" size={20} color="#D62D88" />
                  // <Feather name="pause" size={20} color="#D62D88" />
                ) : (
                  <Feather name="send" size={20} color="#D62D88" style={{ marginLeft: -2, marginTop: 2 }} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Dropdown Modal */}
          <Modal visible={isDropdownVisible} transparent animationType="fade">
            <TouchableOpacity 
              className="flex-1 bg-black/10" 
              activeOpacity={1} 
              onPress={() => setIsDropdownVisible(false)}
            >
              <TouchableOpacity 
                activeOpacity={1}
                className="absolute top-20 right-6 bg-white rounded-3xl w-72 shadow-lg"
              >
                <View className="px-4 py-2 mt-4">
                  <HelixaText className="text-[#1F2937] text-[15px] font-bold mt-2">Options</HelixaText>
                  <View className="h-[1px] bg-gray-100 my-3" />
                  
                  <TouchableOpacity 
                    className="py-3 mb-2 flex-row items-center justify-between"
                    onPress={() => {
                      setIsDropdownVisible(false);
                      router.push('/chat/history');
                    }}
                  >
                    <HelixaText className="text-[#1F2937] text-[16px] mr-1" weight="bold">View Chat History</HelixaText>
                    <Feather name="clock" size={20} color="#1F2937" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
