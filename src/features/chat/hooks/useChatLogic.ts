import { useCallback, useEffect, useRef, useState } from 'react';
import { loadConversation as cacheLoad } from '../../../lib/conversationStore';
import { useAIProvider } from './useAIProvider';
import { useConversationStream } from './useConversationStream';
import { useSubscriptionAccess } from './useSubscriptionAccess';

export type SupportedModel = 'claude' | 'groq' | 'opus';

interface UseChatLogicParams {
  userId: string;
  userTier: 'free' | 'core' | 'studio' | string;
  initialModel?: SupportedModel;
}

export function useChatLogic({ userId, userTier, initialModel = 'claude' }: UseChatLogicParams) {
  // Core state
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [selectedModel, setSelectedModel] = useState<SupportedModel>(initialModel);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Custom hooks
  const {
    messages,
    isStreaming,
    error: streamError,
    sendMessage: streamSendMessage,
    retryMessage,
    clearError: clearStreamError
  } = useConversationStream({
    conversationId: currentConversationId,
    userId,
    userTier: userTier as 'free' | 'core' | 'studio',
    selectedModel
  });

  const {
    currentTier,
    canSendMessage,
    remainingMessages,
    showUpgradePrompt,
    incrementMessageCount
  } = useSubscriptionAccess({ userId });

  const {
    currentProvider,
    supportsFeature,
    getProviderCapabilities
  } = useAIProvider({
    userTier: userTier as 'free' | 'core' | 'studio',
    selectedModel
  });

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Hydrate cached conversation on first ID set
  useEffect(() => {
    if (!currentConversationId) return;
    (async () => {
      const cached = await cacheLoad(currentConversationId);
      if (cached && (cached as any).messages?.length) {
        // Note: This will be handled by useConversationStream now
        // Keeping for backward compatibility
      }
    })();
  }, [currentConversationId]);

  // Enhanced send message with subscription checks
  const sendMessage = useCallback(async (
    text: string, 
    opts?: { onStreamChunk?: (chunk: string) => void }
  ) => {
    // Check if user can send message
    if (!canSendMessage) {
      throw new Error('Daily message limit reached. Please upgrade your plan.');
    }

    const trimmed = text.trim();
    if (!trimmed) return null;

    // Clear any previous errors
    clearStreamError();

    // Send message using streaming hook
    const result = await streamSendMessage(trimmed, opts);
    
    if (result) {
      // Increment usage count on successful send
      await incrementMessageCount();
      
      // Set conversation ID if this is a new conversation
      if (!currentConversationId) {
        setCurrentConversationId(result.conversationId);
      }
    }

    return result;
  }, [
    canSendMessage,
    clearStreamError,
    streamSendMessage,
    incrementMessageCount,
    currentConversationId
  ]);

  // Enhanced retry message
  const handleRetryMessage = useCallback((messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && message.content.type === 'text' && message.content.text) {
      return sendMessage(message.content.text);
    }
    return Promise.resolve(null);
  }, [messages, sendMessage]);

  // Handle suggestion clicks
  const handleSuggestionClick = useCallback((suggestion: string) => {
    void sendMessage(suggestion);
  }, [sendMessage]);

  // Handle voice transcription
  const handleVoiceTranscription = useCallback((transcription: string) => {
    setInputText(transcription);
    void sendMessage(transcription);
  }, [sendMessage]);

  // Check if current provider supports voice/image features
  const canUseVoice = supportsFeature('voice');
  const canUseImage = supportsFeature('image');

  return {
    // State
    messages,
    currentConversationId,
    inputText,
    isLoading: isStreaming,
    error: streamError,
    limitExceeded: !canSendMessage,
    showUpgradePrompt,
    showSuggestions,
    selectedModel,
    messagesEndRef,
    
    // Subscription info
    currentTier,
    remainingMessages,
    canSendMessage,
    
    // AI provider info
    currentProvider,
    providerCapabilities: getProviderCapabilities(),
    canUseVoice,
    canUseImage,
    
    // Setters
    setInputText,
    setShowSuggestions,
    setSelectedModel,
    setCurrentConversationId,
    
    // Actions
    sendMessage,
    retryMessage: handleRetryMessage,
    handleSuggestionClick,
    handleVoiceTranscription,
    clearError: clearStreamError,
    
    // Utils
    scrollToBottom
  };
}

export default useChatLogic;


