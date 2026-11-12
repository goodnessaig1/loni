import { useState, useCallback, useRef } from 'react';
import { apiClient, API_URL } from '../api/client';
import * as SecureStore from 'expo-secure-store';
import EventSource from 'react-native-sse';

// Longest silence allowed while a reply streams. The server gives up on the AI well before this and says sorry,
// so this only catches a dropped connection that would otherwise leave the loading dots up forever.
const STREAM_IDLE_MS = 90000;
const NO_REPLY_TEXT = "Sorry, I couldn't get a reply just now. Please try again.";

export type MessageRole = 'user' | 'assistant';

/** What the server decided about this reply (from its safety triage). Shown as warning strips and buttons. */
export interface ChatMeta {
  urgency: 'emergency' | 'urgent' | 'routine' | 'educational';
  domain?: string;
  answer_type?: string;
  /** Tap-to-reply buttons on a check-in message (the server writes them). `action: 'talk_to_nurse'` opens a call instead of sending text. */
  suggestions?: { key: string; label: string; message: string | null; action?: string | null }[];
  actions: { type: 'request_ride' | 'talk_to_nurse' | 'call_emergency' | 'invite_partner'; label: string; route?: string; phone?: string }[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  isStreaming?: boolean;
  meta?: ChatMeta;
}

export function useAIChat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Keep track of the EventSource to close it if needed
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchMessages = useCallback(async (sid: string, skip: number = 0) => {
    if (isLoadingMore || !hasMore) return;
    try {
      setIsLoadingMore(true);
      const limit = 20;
      const response = await apiClient.get(`/ai-chat/sessions/${sid}/messages?limit=${limit}&skip=${skip}`);
      const newMessages = response.data.data.messages || [];
      
      if (newMessages.length < limit) {
        setHasMore(false);
      }
      
      setMessages(prev => {
        // Because of the inverted FlatList, messages are stored with newest at index 0.
        // We append older messages (newMessages) to the END of the array.
        if (skip === 0) return newMessages.reverse(); // The backend sends chronological. For inverted list, we need reverse chronological (newest first).
        
        return [...prev, ...newMessages.reverse()];
      });
    } catch (err: any) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore]);

  // Initialize a new chat session or load existing
  const initializeSession = useCallback(async (title: string = "New Chat", existingSessionId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (existingSessionId) {
        setSessionId(existingSessionId);
        setHasMore(true);
        await fetchMessages(existingSessionId, 0);
        return existingSessionId;
      }
      
      const response = await apiClient.post('/ai-chat/sessions', { title });
      const newSessionId = response.data.data.session.id;
      setSessionId(newSessionId);
      
      // Clear previous messages
      setMessages([]);
      setHasMore(true);
      return newSessionId;
    } catch (err: any) {
      console.error("Failed to initialize session:", err);
      setError(err.message || 'Failed to start conversation.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchMessages]);

  // Send a message and stream the response. Without a session yet, one is created after the bubbles are on
  // screen, so a first message shows at once instead of behind a loading skeleton.
  const sendMessage = useCallback(async (content: string, overrideSessionId?: string, newSessionTitle?: string) => {
    if (!content.trim()) return;

    // 1. Add user message to UI immediately (at the START of the array for inverted FlatList)
    const userMsgId = Date.now().toString();
    setMessages(prev => [{ id: userMsgId, role: 'user', content }, ...prev]);

    // 2. Add an empty assistant message placeholder
    const assistantMsgId = (Date.now() + 1).toString();
    setMessages(prev => [{ id: assistantMsgId, role: 'assistant', content: '', isStreaming: true }, ...prev]);

    try {
      setIsLoading(true);
      setError(null);

      let activeSessionId = overrideSessionId || sessionId;
      if (!activeSessionId) {
        const title = newSessionTitle || (content.length > 35 ? content.substring(0, 35) + '...' : content);
        const response = await apiClient.post('/ai-chat/sessions', { title });
        activeSessionId = response.data.data.session.id as string;
        setSessionId(activeSessionId);
        setHasMore(false); // a brand-new session has no older messages to page in
      }

      const token = await SecureStore.getItemAsync('userToken');
      
      const url = `${API_URL}/ai-chat/sessions/${activeSessionId}/messages`;
      
      // Initialize SSE
      const es = new EventSource(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ content }),
        // The library reconnects 5 s after a stream ends by default, which re-sends this message.
        pollingInterval: 0,
      });

      eventSourceRef.current = es;

      // Ends the reply once: stops the dots, and says sorry instead of leaving an empty bubble.
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        clearTimeout(idleTimer);
        es.removeAllEventListeners();
        es.close();
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMsgId ? { ...msg, isStreaming: false, content: msg.content || NO_REPLY_TEXT } : msg
        ));
        setIsLoading(false);
      };
      const resetIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(finish, STREAM_IDLE_MS);
      };
      resetIdle();

      es.addEventListener('message', (event) => {
        resetIdle();
        if (event.data) {
          try {
            if (event.data === '[DONE]') {
              finish();
              return;
            }
            
            const parsedData = JSON.parse(event.data);

            // The first event of a reply is the server's safety decision (urgency + which buttons to show).
            if (parsedData.meta) {
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMsgId ? { ...msg, meta: parsedData.meta as ChatMeta } : msg
              ));
              return;
            }

            const chunk = parsedData.content;
            if (typeof chunk !== 'string') return;

            // Append chunk to the assistant's message
            setMessages(prev => prev.map(msg => {
              if (msg.id === assistantMsgId) {
                return { ...msg, content: msg.content + chunk };
              }
              return msg;
            }));
          } catch (e) {
            console.error("Error parsing SSE chunk", e);
          }
        }
      });

      es.addEventListener('error', (event) => {
        console.log("SSE Error event:", event);
        if (event.type === 'error' && (event as any).message) {
            // Some network error
            console.error("Network error on stream", (event as any).message);
        }
        // Stream completed or errored out
        finish();
      });

      es.addEventListener('close', finish);

    } catch (err: any) {
      console.error("Failed to send message:", err);
      setError(err.message || 'Failed to send message.');
      setIsLoading(false);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMsgId ? { ...msg, isStreaming: false, content: "Sorry, I encountered an error." } : msg
      ));
    }
  }, [sessionId]);

  // Clean up on unmount
  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsLoading(false);
  }, []);

  return {
    sessionId,
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    initializeSession,
    fetchMessages,
    sendMessage,
    stopStream
  };
}
