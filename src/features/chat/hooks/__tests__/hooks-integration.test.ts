/**
 * Integration test for the new custom hooks
 * This verifies that useChatLogic properly integrates with the extracted hooks
 */

import { renderHook } from '@testing-library/react';
import { useAIProvider } from '../useAIProvider';
import { useChatLogic } from '../useChatLogic';
import { useConversationStream } from '../useConversationStream';
import { useSubscriptionAccess } from '../useSubscriptionAccess';

// Mock the dependencies
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        subscribe: jest.fn(() => 'mock-subscription')
      }))
    })),
    removeChannel: jest.fn()
  }
}));

jest.mock('../services/messageService', () => ({
  default: {
    sendMessageStream: jest.fn()
  }
}));

jest.mock('../../../lib/conversationStore', () => ({
  appendMessage: jest.fn(),
  loadConversation: jest.fn()
}));

describe('Custom Hooks Integration', () => {
  const mockUserId = 'test-user-123';
  const mockUserTier = 'free' as const;

  describe('useChatLogic Integration', () => {
    it('should integrate all three custom hooks', () => {
      const { result } = renderHook(() => 
        useChatLogic({
          userId: mockUserId,
          userTier: mockUserTier,
          initialModel: 'groq'
        })
      );

      // Verify that the hook returns the expected structure
      expect(result.current).toHaveProperty('messages');
      expect(result.current).toHaveProperty('currentConversationId');
      expect(result.current).toHaveProperty('sendMessage');
      expect(result.current).toHaveProperty('currentTier');
      expect(result.current).toHaveProperty('canSendMessage');
      expect(result.current).toHaveProperty('currentProvider');
      expect(result.current).toHaveProperty('canUseVoice');
      expect(result.current).toHaveProperty('canUseImage');
    });

    it('should provide subscription access information', () => {
      const { result } = renderHook(() => 
        useChatLogic({
          userId: mockUserId,
          userTier: mockUserTier,
          initialModel: 'groq'
        })
      );

      // Check subscription-related properties
      expect(typeof result.current.currentTier).toBe('string');
      expect(typeof result.current.canSendMessage).toBe('boolean');
      expect(typeof result.current.remainingMessages).toBe('number');
      expect(typeof result.current.showUpgradePrompt).toBe('boolean');
    });

    it('should provide AI provider information', () => {
      const { result } = renderHook(() => 
        useChatLogic({
          userId: mockUserId,
          userTier: mockUserTier,
          initialModel: 'groq'
        })
      );

      // Check AI provider-related properties
      expect(result.current.currentProvider).toBeDefined();
      expect(typeof result.current.canUseVoice).toBe('boolean');
      expect(typeof result.current.canUseImage).toBe('boolean');
      expect(result.current.providerCapabilities).toBeDefined();
    });
  });

  describe('Hook Dependencies', () => {
    it('should handle conversation streaming', () => {
      const { result } = renderHook(() => 
        useConversationStream({
          conversationId: 'test-conversation',
          userId: mockUserId,
          userTier: mockUserTier,
          selectedModel: 'groq'
        })
      );

      expect(result.current).toHaveProperty('messages');
      expect(result.current).toHaveProperty('isStreaming');
      expect(result.current).toHaveProperty('sendMessage');
      expect(result.current).toHaveProperty('retryMessage');
    });

    it('should handle subscription access', () => {
      const { result } = renderHook(() => 
        useSubscriptionAccess({
          userId: mockUserId
        })
      );

      expect(result.current).toHaveProperty('currentTier');
      expect(result.current).toHaveProperty('canSendMessage');
      expect(result.current).toHaveProperty('remainingMessages');
      expect(result.current).toHaveProperty('showUpgradePrompt');
    });

    it('should handle AI provider routing', () => {
      const { result } = renderHook(() => 
        useAIProvider({
          userTier: mockUserTier,
          selectedModel: 'groq'
        })
      );

      expect(result.current).toHaveProperty('currentProvider');
      expect(result.current).toHaveProperty('supportsFeature');
      expect(result.current).toHaveProperty('getProviderCapabilities');
      expect(result.current).toHaveProperty('getFallbackProvider');
    });
  });
});
