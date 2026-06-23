import React, { useEffect } from 'react';
import { View, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../../components/HelixaText';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAIChatHistory } from '../../hooks/useAIChatHistory';

export default function ChatHistoryScreen() {
  const router = useRouter();
  
  const { 
    historyItems, 
    isLoading, 
    fetchHistory, 
    deleteSession, 
    clearAllSessions, 
    updateSessionTitle 
  } = useAIChatHistory();

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Chat",
      "Are you sure you want to delete this chat?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteSession(id) }
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear All History",
      "This will permanently delete all your chats. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear All", style: "destructive", onPress: clearAllSessions }
      ]
    );
  };

  const handleEdit = (id: string, currentTitle: string) => {
    Alert.prompt(
      "Rename Chat",
      "Enter a new title for this conversation:",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Save", 
          onPress: (text: string) => {
            if (text && text.trim().length > 0) {
              updateSessionTitle(id, text.trim());
            }
          }
        }
      ],
      "plain-text",
      currentTitle
    );
  };

  const handleOpenChat = (id: string, title: string) => {
    router.push({
      pathname: '/chat/conversation',
      params: { existingSessionId: id, optionTitle: title }
    });
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
        
        {historyItems.length > 0 && (
          <TouchableOpacity 
            onPress={handleClearHistory}
            className="flex-row items-center bg-[#FCE4EC] px-4 py-2.5 rounded-full"
          >
            <HelixaText className="text-[#D62D88] text-[14px] font-bold mr-2">Clear History</HelixaText>
            <Feather name="trash-2" size={16} color="#D62D88" />
          </TouchableOpacity>
        )}
      </View>

      {isLoading && historyItems.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#D62D88" />
        </View>
      ) : (
        <FlatList 
          data={historyItems}
          keyExtractor={item => item.id}
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListHeaderComponent={() => (
            <View>
              <HelixaText className="text-[22px] mb-6" weight="bold">Recents</HelixaText>
              <View className="h-[1px] bg-gray-100 w-full" />
            </View>
          )}
          ListEmptyComponent={() => (
            <View className="mt-10 items-center">
              <HelixaText className="text-gray-400 text-[16px]">No chat history found.</HelixaText>
            </View>
          )}
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between py-4 border-b border-gray-100">
              <TouchableOpacity 
                className="flex-1 mr-4" 
                onPress={() => handleOpenChat(item.id, item.title)}
              >
                <HelixaText className="text-[15px] text-[#1F2937]" weight="bold" numberOfLines={1}>
                  {item.title}
                </HelixaText>
              </TouchableOpacity>
              
              <View className="flex-row gap-2">
                <TouchableOpacity 
                  onPress={() => handleEdit(item.id, item.title)}
                  className="w-10 h-10 bg-[#F3F4F6] rounded-xl items-center justify-center"
                >
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
      )}
    </SafeAreaView>
  );
}
