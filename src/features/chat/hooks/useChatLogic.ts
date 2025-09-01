import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { appendMessage as cacheAppend, loadConversation as cacheLoad } from '../../../lib/conversationStore';
import type { Message } from '../../../types/chat';
import messageService from '../services/messageService';

export type SupportedModel = 'claude' | 'groq' | 'opus';

interface UseChatLogicParams {
  userId: string;
  userTier: 'free' | 'core' | 'studio' | string;
  initialModel?: SupportedModel;
}

interface StreamResult {
  conversationId: string;
  response: Message;
}

export function useChatLogic({ userId, userTier, initialModel = 'claude' }: UseChatLogicParams) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitExceeded, setLimitExceeded] = useState<boolean>(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [selectedModel, setSelectedModel] = useState<SupportedModel>(initialModel);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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
        setMessages((cached as any).messages as Message[]);
      }
    })();
  }, [currentConversationId]);

  // Poll for incremental messages since latest cached
  useEffect(() => {
    if (!currentConversationId) return;
    let timer: any;
    const fetchIncrements = async () => {
      const cached = await cacheLoad(currentConversationId);
      const latestTs = cached && (cached as any).messages?.length
        ? Date.parse((cached as any).messages[(cached as any).messages.length - 1].timestamp)
        : 0;
      if (!latestTs) return;
      try {
        const newMsgs = await messageService.getConversationMessagesSince(currentConversationId, latestTs);
        if (newMsgs && newMsgs.length) {
          for (const m of newMsgs) {
            await cacheAppend({
              id: m.id,
              conversation_id: currentConversationId,
              role: m.role,
              content: m.content as any,
              timestamp: m.timestamp,
              status: 'sent'
            } as any);
          }
          const hydrated = await cacheLoad(currentConversationId);
          if (hydrated && (hydrated as any).messages) {
            setMessages((hydrated as any).messages as Message[]);
          }
        }
      } catch {
        // ignore
      }
    };
    timer = setInterval(fetchIncrements, 5000);
    return () => clearInterval(timer);
  }, [currentConversationId]);

  const sendMessage = useCallback(async (text: string, opts?: { onStreamChunk?: (chunk: string) => void }): Promise<StreamResult | null> => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    setIsLoading(true);
    setError(null);
    setShowSuggestions(false);

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: { type: 'text', text: trimmed },
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    try {
      let assistantId = uuidv4();
      let runningText = '';
      const tempAssistant: Message = {
        id: assistantId,
        role: 'assistant',
        content: { type: 'text', text: '' },
        timestamp: new Date().toISOString(),
        status: 'sending'
      } as Message;
      setMessages(prev => [...prev, tempAssistant]);

      const response = await messageService.sendMessageStream({
        message: trimmed,
        conversationId: currentConversationId || undefined,
        model: selectedModel,
        userTier: (userTier as any) || 'free',
        userId
      }, (chunk) => {
        runningText += chunk;
        if (opts?.onStreamChunk) opts.onStreamChunk(chunk);
        setMessages(prev => prev.map(m => m.id === assistantId ? ({ ...m, content: { type: 'text', text: runningText }, status: 'sending' }) : m));
      });

      if (!currentConversationId) {
        setCurrentConversationId(response.conversationId);
      }

      setMessages(prev => prev.map(m => m.id === assistantId ? ({ ...response.response, status: 'sent' }) : m));
      return { conversationId: response.conversationId, response: response.response };
    } catch (err) {
      setMessages(prev => prev.map(m => (m.id === userMessage.id ? { ...m, status: 'failed', error: (err instanceof Error ? err.message : 'Failed to send') } : m)));
      const messageError = err instanceof Error ? err.message : 'Failed to send message';
      setError(messageError);
      setLimitExceeded(messageError.toLowerCase().includes('daily limit'));
      setShowErrorToast(true);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId, selectedModel, userId, userTier]);

  const retryMessage = useCallback((messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && message.content.type === 'text' && message.content.text) {
      return sendMessage(message.content.text);
    }
    return Promise.resolve(null);
  }, [messages, sendMessage]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    void sendMessage(suggestion);
  }, [sendMessage]);

  const handleVoiceTranscription = useCallback((transcription: string) => {
    setInputText(transcription);
    void sendMessage(transcription);
  }, [sendMessage]);

  return {
    // state
    messages,
    currentConversationId,
    inputText,
    isLoading,
    error,
    limitExceeded,
    showErrorToast,
    showSuggestions,
    selectedModel,
    messagesEndRef,
    // setters
    setInputText,
    setShowErrorToast,
    setShowSuggestions,
    setSelectedModel,
    setCurrentConversationId,
    // actions
    sendMessage,
    retryMessage,
    handleSuggestionClick,
    handleVoiceTranscription,
    // utils
    scrollToBottom
  };
}

export default useChatLogic;


