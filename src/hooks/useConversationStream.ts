import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeMode } from '../context/SafeModeContext';
import { atlasAIService } from '../services/atlasAIService';
import { chatService } from '../services/chatService';
import { conversationService } from '../services/conversationService';
import type { Conversation, Message } from '../types/chat';

export interface UseConversationStreamReturn {
  // State
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // Actions
  createConversation: (title: string) => Promise<string>;
  selectConversation: (id: string) => void;
  sendMessage: (content: string, model?: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  searchConversations: (query: string) => Promise<void>;
  
  // Utilities
  clearError: () => void;
  refreshConversations: () => Promise<void>;
}

export interface UseConversationStreamOptions {
  userId?: string;
  autoLoad?: boolean;
  onMessageAdded?: (message: Message) => void;
  onConversationCreated?: (conversation: Conversation) => void;
  onError?: (error: string) => void;
}

export const useConversationStream = (
  options: UseConversationStreamOptions = {}
): UseConversationStreamReturn => {
  const {
    userId,
    autoLoad = true,
    onMessageAdded,
    onConversationCreated,
    onError
  } = options;

  const { isSafeMode } = useSafeMode();
  
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const loadedConversations = await chatService.getConversations(isSafeMode);
      setConversations(loadedConversations);
      
      // Select first conversation if none selected
      if (loadedConversations.length > 0 && !currentConversation) {
        selectConversation(loadedConversations[0].id);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isSafeMode, currentConversation, onError]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      setError(null);
      
      const loadedMessages = await chatService.getMessages(conversationId, isSafeMode);
      setMessages(loadedMessages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [isSafeMode, onError]);

  // Create new conversation
  const createConversation = useCallback(async (title: string): Promise<string> => {
    try {
      setError(null);
      
      const conversationId = await chatService.createConversation(title, isSafeMode);
      
      // Create conversation object
      const newConversation: Conversation = {
        id: conversationId,
        title,
        messages: [],
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        user_id: userId
      };
      
      // Add to conversations list
      setConversations(prev => [newConversation, ...prev]);
      
      // Select the new conversation
      selectConversation(conversationId);
      
      onConversationCreated?.(newConversation);
      
      return conversationId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create conversation';
      setError(errorMessage);
      onError?.(errorMessage);
      throw new Error(errorMessage);
    }
  }, [isSafeMode, userId, onConversationCreated, onError]);

  // Select a conversation
  const selectConversation = useCallback((id: string) => {
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      setCurrentConversation(conversation);
      loadMessages(id);
    }
  }, [conversations, loadMessages]);

  // Send a message
  const sendMessage = useCallback(async (content: string, model: string = 'claude-sonnet') => {
    if (!currentConversation) {
      throw new Error('No conversation selected');
    }

    try {
      setError(null);
      setIsStreaming(true);
      
      // Add user message immediately
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: {
          type: 'text',
          text: content
        },
        timestamp: new Date().toISOString(),
        status: 'sent'
      };

      // Add to messages
      setMessages(prev => [...prev, userMessage]);
      onMessageAdded?.(userMessage);

      if (isSafeMode) {
        // SafeSpace Mode: Use chatService for local storage
        await chatService.sendMessage({
          content,
          conversationId: currentConversation.id,
          isSafeMode: true,
          onMessageAdded: (message) => {
            setMessages(prev => [...prev, message]);
            onMessageAdded?.(message);
          },
          onError: setError
        });
      } else {
        // Normal Mode: Use AI service for real response
        const aiResponse = await atlasAIService.getAIResponse({
          prompt: content,
          model: model as 'claude-sonnet' | 'claude-opus' | 'groq',
          conversationId: currentConversation.id,
          userId
        });

        // Create assistant message
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: {
            type: 'text',
            text: aiResponse.content
          },
          timestamp: new Date().toISOString(),
          status: 'sent',
          metadata: {
            model: aiResponse.model,
            usage: aiResponse.usage
          }
        };

        // Add to messages
        setMessages(prev => [...prev, assistantMessage]);
        onMessageAdded?.(assistantMessage);

        // Save to conversation service
        await conversationService.addMessage({
          conversationId: currentConversation.id,
          role: 'user',
          content: userMessage.content,
          userId
        });

        await conversationService.addMessage({
          conversationId: currentConversation.id,
          role: 'assistant',
          content: assistantMessage.content,
          userId,
          metadata: assistantMessage.metadata
        });
      }

      // Update conversation's lastUpdated
      setCurrentConversation(prev => prev ? {
        ...prev,
        lastUpdated: new Date().toISOString()
      } : null);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsStreaming(false);
    }
  }, [currentConversation, isSafeMode, userId, onMessageAdded, onError]);

  // Delete conversation
  const deleteConversation = useCallback(async (id: string) => {
    try {
      setError(null);
      
      if (isSafeMode) {
        // SafeSpace Mode: Delete from local storage
        // TODO: Implement local deletion
      } else {
        // Normal Mode: Delete from Supabase
        await conversationService.deleteConversation(id);
      }
      
      // Remove from conversations list
      setConversations(prev => prev.filter(c => c.id !== id));
      
      // Clear current conversation if it was deleted
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete conversation';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [isSafeMode, currentConversation, onError]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      setError(null);
      
      if (isSafeMode) {
        // SafeSpace Mode: Delete from local storage
        // TODO: Implement local deletion
      } else {
        // Normal Mode: Delete from Supabase
        await conversationService.deleteMessage(messageId);
      }
      
      // Remove from messages
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete message';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [isSafeMode, onError]);

  // Search conversations
  const searchConversations = useCallback(async (query: string) => {
    if (!userId) return;
    
    try {
      setError(null);
      
      if (isSafeMode) {
        // SafeSpace Mode: Search local storage
        // TODO: Implement local search
        setConversations([]);
      } else {
        // Normal Mode: Search Supabase
        const results = await conversationService.searchConversations(userId, query);
        setConversations(results);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search conversations';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [userId, isSafeMode, onError]);

  // Refresh conversations
  const refreshConversations = useCallback(async () => {
    await loadConversations();
  }, [loadConversations]);

  // Auto-load conversations on mount
  useEffect(() => {
    if (autoLoad && userId) {
      loadConversations();
    }
  }, [autoLoad, userId, loadConversations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    conversations,
    currentConversation,
    messages,
    isLoading,
    isStreaming,
    error,
    
    // Actions
    createConversation,
    selectConversation,
    sendMessage,
    deleteConversation,
    deleteMessage,
    searchConversations,
    
    // Utilities
    clearError,
    refreshConversations
  };
};

export default useConversationStream;
