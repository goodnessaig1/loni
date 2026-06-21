import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Animated, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../../components/HelixaText';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LumaIcon } from '../../components/icons/LumaIcon';

// --- Helper Components ---

const TypewriterText = ({ text, onComplete }: { text: string, onComplete?: () => void }) => {
  const [displayedText, setDisplayedText] = useState('');

  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, index + 1));
      index++;
      if (index >= text.length) {
        clearInterval(interval);
        onCompleteRef.current?.();
      }
    }, 30); // 30ms per character

    return () => clearInterval(interval);
  }, [text]);

  return <HelixaText className="text-[15px] leading-6 text-black">{displayedText}</HelixaText>;
};

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

type Message = {
  id: string;
  text: string;
  sender: 'user' | 'luma';
  isTyping?: boolean;
  animated?: boolean;
  pending?: boolean;
};

export default function ConversationScreen() {
  const router = useRouter();
  const { optionId } = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: "Hi, I'm Luma. Here to support you through pregnancy, recovery, and more.",
      sender: 'luma',
    }
  ]);

  const handleSend = () => {
    if (!message.trim() || isSending) return;

    const userMessageText = message.trim();
    setMessage('');
    setIsSending(true);

    const newMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: newMsgId, text: userMessageText, sender: 'user', pending: true }]);

    // Scroll to bottom immediately
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    // Simulate network delay for sending
    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === newMsgId ? { ...m, pending: false } : m));
      setIsSending(false);
      
      // Add Luma typing indicator
      setMessages(prev => [...prev, { id: 'typing', text: '', sender: 'luma', isTyping: true }]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      
      // Simulate Luma "thinking" then responding
      setTimeout(() => {
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== 'typing');
          
          let responseText = "That's completely normal. Let me know if you need any specific guidance or if it gets worse.";
          
          // If this is the FIRST response from Luma (meaning total messages before this response is 2: welcome + user), give contextual.
          // Otherwise, give a generic continuous chat response.
          if (filtered.length <= 2) {
            if (optionId === '1') responseText = "Pregnancy brings many changes. How are you feeling today? I can help with information about cramps, diet, or general wellness.";
            else if (optionId === '2') responseText = "Recovery takes time and patience. Remember to rest and stay hydrated. How can I assist you with your recovery today?";
            else if (optionId === '3') responseText = "I'm here to listen. It's perfectly okay to feel overwhelmed. Would you like some grounding exercises?";
            else if (optionId === '4') responseText = "I see you selected Emergency Guidance. If you are experiencing a severe medical emergency, please stop chatting and call emergency services immediately. Otherwise, how can I advise you?";
          } else {
            const lumaResponses = [
              "I understand. Can you tell me a little more about that?",
              "That makes complete sense. I'm here to support you.",
              "Thank you for sharing that with me. How long have you been feeling this way?",
              "It's completely normal to feel that way. Many mothers experience something similar.",
              "I'm always here to listen. Remember to be gentle with yourself.",
            ];
            responseText = lumaResponses[Math.floor(Math.random() * lumaResponses.length)];
          }

          return [...filtered, { id: Date.now().toString() + 'r', text: responseText, sender: 'luma', animated: true }];
        });
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

      }, 2000);
    }, 800);
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
            
            <HelixaText className="text-[20px]" weight="bold">New Chat</HelixaText>
            
            <TouchableOpacity 
              onPress={() => setIsDropdownVisible(true)}
              className="w-12 h-12 rounded-full bg-white items-center justify-center shadow-sm"
            >
              <Feather name="more-horizontal" size={24} color="black" />
            </TouchableOpacity>
          </View>

          {/* Chat Area */}
          <ScrollView 
            ref={scrollViewRef}
            className="flex-1 px-6 pt-6" 
            contentContainerStyle={{ paddingBottom: 20 }}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg) => {
              if (msg.sender === 'user') {
                return (
                  <View key={msg.id} className="flex-row justify-end mb-6">
                    <View className="bg-[#C82A81] rounded-2xl rounded-tr-sm px-5 py-3 shadow-sm max-w-[80%] flex-row items-end">
                      <HelixaText className="text-[15px] leading-6 text-white mr-2">
                        {msg.text}
                      </HelixaText>
                      {msg.pending && (
                        <Feather name="clock" size={12} color="rgba(255,255,255,0.7)" style={{ marginBottom: 4 }} />
                      )}
                    </View>
                  </View>
                );
              } else {
                return (
                  <View key={msg.id} className="flex-row items-start mb-6">
                    <View className="w-12 h-12 rounded-full bg-white items-center justify-center mr-3 mt-1 shadow-sm">
                      <LumaIcon size={24} />
                    </View>
                    <View className="bg-white rounded-3xl rounded-tl-sm p-4 shadow-sm max-w-[75%]">
                      {msg.isTyping ? (
                        <TypingIndicator />
                      ) : msg.animated ? (
                        <TypewriterText text={msg.text} onComplete={() => {
                          // Could trigger scroll to bottom again after typing finishes
                          scrollViewRef.current?.scrollToEnd({ animated: true });
                        }} />
                      ) : (
                        <HelixaText className="text-[15px] leading-6 text-black">
                          {msg.text}
                        </HelixaText>
                      )}
                    </View>
                    {!msg.isTyping && (
                      <TouchableOpacity className="ml-2 mt-2">
                        <Feather name="copy" size={16} color="gray" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }
            })}
          </ScrollView>

          {/* Input Area */}
          <View className="px-6 py-4 pb-8">
            <View className="flex-row items-center bg-black rounded-full pl-6 pr-2 py-2 min-h-[64px]">
              <TextInput
                className="flex-1 text-white text-[15px] py-3"
                placeholder="Tell Luma How You Feel..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                className="w-12 h-12 rounded-full bg-white items-center justify-center ml-2"
                onPress={handleSend}
                disabled={isSending || !message.trim()}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#D62D88" />
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
                <View className="p-4 bg-[#FFF4F7] m-2 rounded-2xl">
                  <HelixaText className="text-[#1F2937] text-[15px] font-bold">Are these cramps normal?</HelixaText>
                </View>
                
                <View className="px-4 py-2">
                  <HelixaText className="text-[#1F2937] text-[15px] font-bold mt-2">Recents</HelixaText>
                  <View className="h-[1px] bg-gray-100 my-3" />
                  
                  <TouchableOpacity className="py-3">
                    <HelixaText className="text-[#374151] text-[15px]">Why do I feel overwhelmed?</HelixaText>
                  </TouchableOpacity>
                  <TouchableOpacity className="py-3">
                    <HelixaText className="text-[#374151] text-[15px]">What should I pack?</HelixaText>
                  </TouchableOpacity>
                  <TouchableOpacity className="py-3">
                    <HelixaText className="text-[#374151] text-[15px]">Is it okay I skipped recovery?</HelixaText>
                  </TouchableOpacity>
                  <TouchableOpacity className="py-3">
                    <HelixaText className="text-[#374151] text-[15px]">Should I worry about baby move...</HelixaText>
                  </TouchableOpacity>
                  
                  <View className="h-[1px] bg-gray-100 my-3" />
                  <TouchableOpacity 
                    className="py-3 mb-2 flex-row items-center justify-end"
                    onPress={() => {
                      setIsDropdownVisible(false);
                      router.push('/chat/history');
                    }}
                  >
                    <HelixaText className="text-[#1F2937] text-[16px] mr-1" weight="bold">See All</HelixaText>
                    <Feather name="chevron-right" size={20} color="#1F2937" />
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
