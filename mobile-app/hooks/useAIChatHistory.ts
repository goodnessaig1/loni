import { useState, useCallback } from 'react';
import { apiClient } from '../api/client';

export interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
}

export function useAIChatHistory() {
  const [historyItems, setHistoryItems] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiClient.get('/ai-chat/sessions');
      setHistoryItems(response.data.data.sessions || []);
    } catch (err: any) {
      console.error("Failed to fetch history:", err);
      setError(err.message || 'Failed to fetch history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    try {
      // Optimistic update
      setHistoryItems(prev => prev.filter(item => item.id !== id));
      await apiClient.delete(`/ai-chat/sessions/${id}`);
    } catch (err: any) {
      console.error("Failed to delete session:", err);
      // Revert optimism if needed by re-fetching
      fetchHistory();
    }
  }, [fetchHistory]);

  const clearAllSessions = useCallback(async () => {
    try {
      setHistoryItems([]);
      await apiClient.delete('/ai-chat/sessions');
    } catch (err: any) {
      console.error("Failed to clear sessions:", err);
      fetchHistory();
    }
  }, [fetchHistory]);

  const updateSessionTitle = useCallback(async (id: string, newTitle: string) => {
    try {
      setHistoryItems(prev => prev.map(item => item.id === id ? { ...item, title: newTitle } : item));
      await apiClient.put(`/ai-chat/sessions/${id}`, { title: newTitle });
    } catch (err: any) {
      console.error("Failed to update session title:", err);
      fetchHistory();
    }
  }, [fetchHistory]);

  return {
    historyItems,
    isLoading,
    error,
    fetchHistory,
    deleteSession,
    clearAllSessions,
    updateSessionTitle
  };
}
