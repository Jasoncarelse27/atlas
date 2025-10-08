import { useCallback, useState } from 'react';
import { useSafeMode } from '../context/SafeModeContext';
import ChatService, { type SendMessageOptions, type StreamMessageOptions } from '../services/chatService';
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
      const options: SendMessageOptions = {
        content: content.trim(),
        conversationId,
        isSafeMode,
        onMessageAdded,
        onError: setError
      };

      await ChatService.sendMessage(options);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
    } finally {
      setIsSending(false);
    }
  }, [isSafeMode, onMessageAdded]);

  const streamMessage = useCallback(async (content: string, conversationId?: string) => {
    if (!content.trim()) return;

    setIsStreaming(true);
    setError(null);

    try {
      const options: StreamMessageOptions = {
        message: content.trim(),
        conversationId,
        isSafeMode,
        onChunk: onStreamChunk,
        onComplete: onStreamComplete,
        onError: setError
      };

      await ChatService.streamMessage(options);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stream message';
      setError(errorMessage);
    } finally {
      setIsStreaming(false);
    }
  }, [isSafeMode, onStreamChunk, onStreamComplete]);

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
