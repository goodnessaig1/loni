import React, { useEffect } from 'react';
import { View, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { HelixaText } from '../../components/HelixaText';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAIChatHistory } from '../../hooks/useAIChatHistory';
import { Reveal, RevealList } from '../../components/motion';

export default function ChatHistoryScreen() {
  const { colors } = useTheme();
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
          onPress: (text?: string) => {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <Reveal index={0}>
      <View className="flex-row items-center justify-between px-6 pt-4 pb-6">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="w-12 h-12 rounded-full items-center justify-center border"
          style={{ backgroundColor: colors.bg, borderColor: colors.border }}
        >
          <Feather name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        
        {historyItems.length > 0 && (
          <TouchableOpacity 
            onPress={handleClearHistory}
            className="flex-row items-center px-4 py-2.5 rounded-full"
            style={{ backgroundColor: colors.primarySoft }}
          >
            <HelixaText className="text-[#D62D88] text-[14px] font-bold mr-2">Clear History</HelixaText>
            <Feather name="trash-2" size={16} color="#D62D88" />
          </TouchableOpacity>
        )}
      </View>
      </Reveal>

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
              <View className="h-[1px] w-full" style={{ backgroundColor: colors.divider }} />
            </View>
          )}
          ListEmptyComponent={() => (
            <View className="mt-10 items-center">
              <HelixaText className="text-gray-400 text-[16px]">No chat history found.</HelixaText>
            </View>
          )}
          renderItem={({ item, index }) => (
            <RevealList index={index} delay={70}>
            <View className="flex-row items-center justify-between py-4 border-b"
              style={{ borderBottomColor: colors.divider }}>
              <TouchableOpacity 
                className="flex-1 mr-4" 
                onPress={() => handleOpenChat(item.id, item.title)}
              >
                <HelixaText className="text-[15px]" weight="bold" numberOfLines={1}>
                  {item.title}
                </HelixaText>
              </TouchableOpacity>
              
              <View className="flex-row gap-2">
                <TouchableOpacity 
                  onPress={() => handleEdit(item.id, item.title)}
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Feather name="edit-2" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => handleDelete(item.id)}
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Feather name="trash-2" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            </RevealList>
          )}
        />
      )}
    </SafeAreaView>
  );
}
