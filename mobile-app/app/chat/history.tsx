import React, { useState } from 'react';
import { View, TouchableOpacity, Platform, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../../components/HelixaText';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatHistoryScreen() {
  const router = useRouter();
  
  const [historyItems, setHistoryItems] = useState([
    { id: 1, title: 'Why do I feel overwhelmed?' },
    { id: 2, title: 'Why do I feel overwhelmed?' },
    { id: 3, title: 'Why do I feel overwhelmed?' },
    { id: 4, title: 'Why do I feel overwhelmed?' },
    { id: 5, title: 'Why do I feel overwhelmed?' },
  ]);

  const handleDelete = (id: number) => {
    setHistoryItems(prev => prev.filter(item => item.id !== id));
  };

  const handleClearHistory = () => {
    setHistoryItems([]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-4 pb-6">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="w-12 h-12 rounded-full bg-white items-center justify-center border border-gray-200"
        >
          <Feather name="arrow-left" size={24} color="black" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={handleClearHistory}
          className="flex-row items-center bg-[#FCE4EC] px-4 py-2.5 rounded-full"
        >
          <HelixaText className="text-[#D62D88] text-[14px] font-bold mr-2">Clear History</HelixaText>
          <Feather name="trash-2" size={16} color="#D62D88" />
        </TouchableOpacity>
      </View>

      <FlatList 
        data={historyItems}
        keyExtractor={item => item.id.toString()}
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListHeaderComponent={() => (
          <View>
            <HelixaText className="text-[22px] mb-6" weight="bold">Recents</HelixaText>
            <View className="h-[1px] bg-gray-100 w-full" />
          </View>
        )}
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between py-4 border-b border-gray-100">
            <HelixaText className="text-[15px] flex-1 mr-4 text-[#1F2937]" weight="bold">
              {item.title}
            </HelixaText>
            
            <View className="flex-row gap-2">
              <TouchableOpacity className="w-10 h-10 bg-[#F3F4F6] rounded-xl items-center justify-center">
                <Feather name="edit-2" size={18} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => handleDelete(item.id)}
                className="w-10 h-10 bg-[#F3F4F6] rounded-xl items-center justify-center"
              >
                <Feather name="trash-2" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
