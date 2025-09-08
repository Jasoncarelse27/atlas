import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../lib/supabase';
import type { Message } from '../../../types/chat';
import messageService from '../services/messageService';

interface UseConversationStreamParams {
  conversationId: string | null;
  userId: string;
  userTier: 'free' | 'core' | 'studio' | string;
  selectedModel: 'claude'  | 'opus' | 'haiku';
}

interface StreamResult {
  conversationId: string;
  response: Message;
}

export function useConversationStream({
  conversationId,
  userId,
  userTier,
  selectedModel
}: UseConversationStreamParams) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Supabase real-time subscription for new messages
  useEffect(() => {
    if (!conversationId) return;

    const subscription = supabase
      .channel(`conversation_${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => [...prev, newMsg]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [conversationId]);

  const sendMessage = useCallback(async (
    text: string, 
    opts?: { onStreamChunk?: (chunk: string) => void }
  ): Promise<StreamResult | null> => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    setIsStreaming(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    // Create user message
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: { type: 'text', text: trimmed },
      timestamp: new Date().toISOString()
    };

    // Add user message to UI immediately
    setMessages(prev => [...prev, userMessage]);

    // Create temporary assistant message for streaming
    const assistantId = uuidv4();
    let runningText = '';
    const tempAssistant: Message = {
      id: assistantId,
      role: 'assistant',
      content: { type: 'text', text: '' },
      timestamp: new Date().toISOString(),
      status: 'sending'
    } as Message;

    try {
      // Add temporary assistant message
      setMessages(prev => [...prev, tempAssistant]);

      // Send message with streaming
      const response = await messageService.sendMessageStream({
        message: trimmed,
        conversationId: conversationId || undefined,
        model: selectedModel,
        userTier: userTier as 'free' | 'core' | 'studio',
        userId
      }, (chunk) => {
        // Handle streaming chunks
        runningText += chunk;
        if (opts?.onStreamChunk) opts.onStreamChunk(chunk);
        
        // Update UI immediately for each chunk
        setMessages(prev => prev.map(m => 
          m.id === assistantId 
            ? { 
                ...m, 
                content: { type: 'text', text: runningText }, 
                status: 'sending' 
              } 
            : m
        ));
      });

      // Update final message status
      setMessages(prev => prev.map(m => 
        m.id === assistantId 
          ? { ...response.response, status: 'sent' } 
          : m
      ));

      return { conversationId: response.conversationId, response: response.response };
    } catch (err) {
      // Handle errors
      const messageError = err instanceof Error ? err.message : 'Failed to send message';
      setError(messageError);
      
      // Mark user message as failed
      setMessages(prev => prev.map(m => 
        m.id === userMessage.id 
          ? { ...m, status: 'failed', error: messageError } 
          : m
      ));

      // Remove temporary assistant message on error
      setMessages(prev => prev.filter(m => m.id !== assistantId));
      
      return null;
    } finally {
      setIsStreaming(false);
    }
  }, [conversationId, selectedModel, userId, userTier]);

  const retryMessage = useCallback((messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && message.content.type === 'text' && message.content.text) {
      return sendMessage(message.content.text);
    }
    return Promise.resolve(null);
  }, [messages, sendMessage]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    messages,
    isStreaming,
    error,
    
    // Actions
    sendMessage,
    retryMessage,
    clearError,
    
    // Utils
    abortControllerRef
  };
}
