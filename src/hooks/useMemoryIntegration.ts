/**
 * Memory Integration Hook
 * Connects the memory system to the chat functionality
 * Simple, clean integration without over-engineering
 */

import { useCallback } from 'react';
import { useSubscription } from './useSubscription';
import { logger } from '../lib/logger';

interface UseMemoryIntegrationProps {
  userId?: string;
}

export function useMemoryIntegration({ userId }: UseMemoryIntegrationProps) {
  const { updateMemory, getUserMemory, getPersonalizedPrompt } = useSubscription(userId);

  // Process user message for memory extraction
  const processUserMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;
    
    try {
      // Memory extraction - only log in development
      if (process.env.NODE_ENV === 'development') {
        logger.debug('🧠 [useMemoryIntegration] Starting memory extraction for:', message);
      }
      // Extract memory from the message and wait for completion
      await updateMemory(message);
      if (process.env.NODE_ENV === 'development') {
        logger.debug('🧠 [useMemoryIntegration] Memory extraction completed successfully');
      }
    } catch (error) {
      // Don't throw - memory extraction is optional
    }
  }, [updateMemory]);

  // Get personalized system prompt
  const getSystemPrompt = useCallback((basePrompt: string = '') => {
    const defaultPrompt = basePrompt || 'You are Atlas, an emotionally intelligent AI assistant. Be helpful, empathetic, and provide thoughtful responses.';
    return getPersonalizedPrompt(defaultPrompt);
  }, [getPersonalizedPrompt]);

  // Get user's memory for display
  const getUserContext = useCallback(() => {
    const memory = getUserMemory();
    return {
      hasName: !!memory.name,
      hasContext: !!memory.context,
      name: memory.name,
      context: memory.context,
      lastUpdated: memory.last_updated
    };
  }, [getUserMemory]);

  return {
    processUserMessage,
    getSystemPrompt,
    getUserContext,
    hasMemory: () => {
      const memory = getUserMemory();
      return !!(memory.name || memory.context);
    }
  };
}
