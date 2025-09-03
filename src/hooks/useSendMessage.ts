import { useCallback, useState } from 'react';
import { useSafeMode } from '../context/SafeModeContext';
import { chatService } from '../services';
import type { Message } from '../types/chat';

export interface UseSendMessageReturn {
  sendMessage: (content: string, conversationId?: string) => Promise<void>;
  streamMessage: (content: string, conversationId?: string) => Promise<void>;
  isSending: boolean;
  isStreaming: boolean;
  error: string | null;
  clearError: () => void;
}

export const useSendMessage = (
  onMessageAdded?: (message: Message) => void,
  onStreamChunk?: (chunk: string) => void,
  onStreamComplete?: (fullResponse: string) => void
): UseSendMessageReturn => {
  const { isSafeMode } = useSafeMode();
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const sendMessage = useCallback(async (content: string, conversationId?: string) => {
    if (!content.trim()) return;

    setIsSending(true);
    setError(null);

    try {
      // Create message object
      const message: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: {
          type: 'text',
          text: content.trim()
        },
        timestamp: new Date().toISOString(),
        status: 'sent'
      };

      // Send message using chatService
      const savedMessage = await chatService.sendMessage(message, conversationId || 'default', isSafeMode);
      
      // Notify callback
      onMessageAdded?.(savedMessage);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      console.error('Error in useSendMessage:', err);
    } finally {
      setIsSending(false);
    }
  }, [isSafeMode, onMessageAdded]);

  const streamMessage = useCallback(async (content: string, conversationId?: string) => {
    if (!content.trim()) return;

    setIsStreaming(true);
    setError(null);

    try {
      // Create message object
      const message: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: {
          type: 'text',
          text: content.trim()
        },
        timestamp: new Date().toISOString(),
        status: 'sent'
      };

      // Stream message using chatService
      const streamedMessage = await chatService.streamMessage(
        message, 
        conversationId || 'default', 
        onStreamChunk || (() => {}), 
        isSafeMode
      );
      
      // Notify completion callback
      if (onStreamComplete && streamedMessage.content.type === 'text') {
        onStreamComplete(streamedMessage.content.text || '');
      }
      
      // Notify message added callback
      onMessageAdded?.(streamedMessage);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stream message';
      setError(errorMessage);
      console.error('Error in useSendMessage stream:', err);
    } finally {
      setIsStreaming(false);
    }
  }, [isSafeMode, onStreamChunk, onStreamComplete, onMessageAdded]);

  return {
    sendMessage,
    streamMessage,
    isSending,
    isStreaming,
    error,
    clearError
  };
};

export default useSendMessage;
