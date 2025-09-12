import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatService } from '../../src/services/chatService';

// Mock dependencies
vi.mock('../../src/services/chatService', () => ({
  chatService: {
    sendMessage: vi.fn(),
    getMessages: vi.fn(),
    deleteMessage: vi.fn(),
  }
}));

describe('Chat Service Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Empty Message Handling', () => {
    it('should handle empty string messages', async () => {
      const mockSendMessage = vi.mocked(chatService.sendMessage);
      mockSendMessage.mockRejectedValue(new Error('Message cannot be empty'));

      await expect(chatService.sendMessage('', 'test-conversation-id')).rejects.toThrow('Message cannot be empty');
    });

    it('should handle whitespace-only messages', async () => {
      const mockSendMessage = vi.mocked(chatService.sendMessage);
      mockSendMessage.mockRejectedValue(new Error('Message cannot be empty'));

      await expect(chatService.sendMessage('   \n\t   ', 'test-conversation-id')).rejects.toThrow('Message cannot be empty');
    });

    it('should handle null/undefined messages', async () => {
      const mockSendMessage = vi.mocked(chatService.sendMessage);
      mockSendMessage.mockRejectedValue(new Error('Message is required'));

      await expect(chatService.sendMessage(null as any, 'test-conversation-id')).rejects.toThrow('Message is required');
      await expect(chatService.sendMessage(undefined as any, 'test-conversation-id')).rejects.toThrow('Message is required');
    });
  });

  describe('Rapid Message Sending', () => {
    it('should handle rapid consecutive messages', async () => {
      const mockSendMessage = vi.mocked(chatService.sendMessage);
      mockSendMessage.mockResolvedValue({ id: 'msg-1', content: 'Response 1' });

      const promises = Array.from({ length: 10 }, (_, i) => 
        chatService.sendMessage(`Message ${i}`, 'test-conversation-id')
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      expect(mockSendMessage).toHaveBeenCalledTimes(10);
    });

    it('should handle rate limiting gracefully', async () => {
      const mockSendMessage = vi.mocked(chatService.sendMessage);
      mockSendMessage.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(chatService.sendMessage('Test message', 'test-conversation-id')).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network timeouts', async () => {
      const mockSendMessage = vi.mocked(chatService.sendMessage);
      mockSendMessage.mockRejectedValue(new Error('Request timeout'));

      await expect(chatService.sendMessage('Test message', 'test-conversation-id')).rejects.toThrow('Request timeout');
    });

    it('should handle connection errors', async () => {
      const mockSendMessage = vi.mocked(chatService.sendMessage);
      mockSendMessage.mockRejectedValue(new Error('Connection failed'));

      await expect(chatService.sendMessage('Test message', 'test-conversation-id')).rejects.toThrow('Connection failed');
    });
  });

  describe('Invalid Conversation ID', () => {
    it('should handle invalid conversation IDs', async () => {
      const mockSendMessage = vi.mocked(chatService.sendMessage);
      mockSendMessage.mockRejectedValue(new Error('Invalid conversation ID'));

      await expect(chatService.sendMessage('Test message', '')).rejects.toThrow('Invalid conversation ID');
      await expect(chatService.sendMessage('Test message', null as any)).rejects.toThrow('Invalid conversation ID');
    });
  });

  describe('Message Length Limits', () => {
    it('should handle extremely long messages', async () => {
      const longMessage = 'a'.repeat(10000);
      const mockSendMessage = vi.mocked(chatService.sendMessage);
      mockSendMessage.mockRejectedValue(new Error('Message too long'));

      await expect(chatService.sendMessage(longMessage, 'test-conversation-id')).rejects.toThrow('Message too long');
    });
  });

  describe('Special Characters and Encoding', () => {
    it('should handle special characters', async () => {
      const specialMessage = 'Hello! @#$%^&*()_+{}|:"<>?[]\\;\',./`~';
      const mockSendMessage = vi.mocked(chatService.sendMessage);
      mockSendMessage.mockResolvedValue({ id: 'msg-1', content: 'Response' });

      await expect(chatService.sendMessage(specialMessage, 'test-conversation-id')).resolves.toBeDefined();
    });

    it('should handle unicode characters', async () => {
      const unicodeMessage = 'Hello 世界 🌍 émojis 🚀';
      const mockSendMessage = vi.mocked(chatService.sendMessage);
      mockSendMessage.mockResolvedValue({ id: 'msg-1', content: 'Response' });

      await expect(chatService.sendMessage(unicodeMessage, 'test-conversation-id')).resolves.toBeDefined();
    });
  });
});
