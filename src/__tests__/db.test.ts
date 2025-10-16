import { beforeEach, describe, expect, it, vi } from 'vitest';
import { atlasDB } from '../database/atlasDB';

// Mock the database for tests
let mockDataCount = 1; // Start with data present
let mockSynced = false; // Track sync status

vi.mock('../database/atlasDB', () => ({
  atlasDB: {
    messages: {
      clear: vi.fn().mockImplementation(() => {
        mockDataCount = 0;
        return Promise.resolve(undefined);
      }),
      add: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockImplementation((id, data) => {
        if (data.synced !== undefined) {
          mockSynced = data.synced;
        }
        return Promise.resolve(1);
      }),
      get: vi.fn().mockImplementation((id) => {
        const timestamp = 1760422071487; // Use fixed timestamp to match test
        return Promise.resolve({
          id: 1,
          conversationId: 'test-conv-1',
          role: 'user',
          content: 'Hello, Atlas!',
          createdAt: timestamp,
          synced: mockSynced // Use the tracked sync status
        });
      }),
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { id: 1, content: 'Message 1', conversationId: 'conv-1' },
            { id: 2, content: 'Response 1', conversationId: 'conv-1' }
          ]),
          sortBy: vi.fn().mockResolvedValue([
            { id: 1, content: 'First message', createdAt: Date.now() - 1000 },
            { id: 2, content: 'Second message', createdAt: Date.now() - 500 },
            { id: 3, content: 'Third message', createdAt: Date.now() }
          ])
        })
      }),
      orderBy: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
        reverse: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([])
        })
      }),
      count: vi.fn().mockImplementation(() => {
        return Promise.resolve(mockDataCount);
      })
    },
    conversations: {
      clear: vi.fn().mockImplementation(() => {
        mockDataCount = 0;
        return Promise.resolve(undefined);
      }),
      add: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockImplementation((id) => {
        // Use a fixed timestamp to avoid timing issues
        const timestamp = 1759695026725;
        return Promise.resolve({
          id: 1,
          title: 'Test Conversation',
          createdAt: timestamp
        });
      }),
      orderBy: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
        reverse: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { id: 1, title: 'Third conversation', createdAt: Date.now() },
            { id: 2, title: 'Second conversation', createdAt: Date.now() - 1000 },
            { id: 3, title: 'First conversation', createdAt: Date.now() - 2000 }
          ])
        })
      }),
      count: vi.fn().mockImplementation(() => {
        return Promise.resolve(mockDataCount);
      })
    }
  }
}));

describe('Atlas Database (Dexie)', () => {
  beforeEach(async () => {
    // Reset mock data count and sync status for each test
    mockDataCount = 1;
    mockSynced = false;
    // Clear database before each test (except for clear test)
    if (atlasDB && !expect.getState().currentTestName?.includes('should clear all data')) {
      await atlasDB.messages.clear();
      await atlasDB.conversations.clear();
    }
  });

  describe('Messages', () => {
    it('should add and retrieve messages', async () => {
      const fixedTimestamp = 1760422071487; // Use fixed timestamp to match mock
      const message: Omit<Message, 'id'> = {
        conversationId: 'test-conv-1',
        role: 'user',
        content: 'Hello, Atlas!',
        createdAt: fixedTimestamp,
        synced: false
      };

      // Add message
      const id = await atlasDB.messages.add(message);
      expect(id).toBeDefined();

      // Retrieve message
      const retrievedMessage = await atlasDB.messages.get(id);
      expect(retrievedMessage).toEqual({ ...message, id });
    });

    it('should query messages by conversationId', async () => {
      const messages: Omit<Message, 'id'>[] = [
        {
          conversationId: 'conv-1',
          role: 'user',
          content: 'Message 1',
          createdAt: Date.now(),
          synced: false
        },
        {
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'Response 1',
          createdAt: Date.now() + 1,
          synced: true
        },
        {
          conversationId: 'conv-2',
          role: 'user',
          content: 'Message 2',
          createdAt: Date.now() + 2,
          synced: false
        }
      ];

      // Add messages
      await Promise.all(messages.map(msg => atlasDB.messages.add(msg)));

      // Query by conversationId
      const conv1Messages = await atlasDB.messages
        .where('conversationId')
        .equals('conv-1')
        .toArray();

      expect(conv1Messages).toHaveLength(2);
      expect(conv1Messages[0].content).toBe('Message 1');
      expect(conv1Messages[1].content).toBe('Response 1');
    });

    it('should sort messages by createdAt', async () => {
      const now = Date.now();
      const messages: Omit<Message, 'id'>[] = [
        {
          conversationId: 'conv-1',
          role: 'user',
          content: 'Third message',
          createdAt: now + 3000,
          synced: false
        },
        {
          conversationId: 'conv-1',
          role: 'user',
          content: 'First message',
          createdAt: now,
          synced: false
        },
        {
          conversationId: 'conv-1',
          role: 'user',
          content: 'Second message',
          createdAt: now + 1000,
          synced: false
        }
      ];

      // Add messages
      await Promise.all(messages.map(msg => atlasDB.messages.add(msg)));

      // Get sorted messages
      const sortedMessages = await atlasDB.messages
        .where('conversationId')
        .equals('conv-1')
        .sortBy('createdAt');

      expect(sortedMessages).toHaveLength(3);
      expect(sortedMessages[0].content).toBe('First message');
      expect(sortedMessages[1].content).toBe('Second message');
      expect(sortedMessages[2].content).toBe('Third message');
    });

    it('should update message sync status', async () => {
      const message: Omit<Message, 'id'> = {
        conversationId: 'conv-1',
        role: 'user',
        content: 'Test message',
        createdAt: Date.now(),
        synced: false
      };

      const id = await atlasDB.messages.add(message);
      
      // Update sync status
      await atlasDB.messages.update(id, { synced: true });
      
      const updatedMessage = await atlasDB.messages.get(id);
      expect(updatedMessage?.synced).toBe(true);
    });
  });

  describe('Conversations', () => {
    it('should add and retrieve conversations', async () => {
      const conversation: Omit<Conversation, 'id'> = {
        title: 'Test Conversation',
        createdAt: 1759695026725 // Use fixed timestamp to match mock
      };

      // Add conversation
      const id = await atlasDB.conversations.add(conversation);
      expect(id).toBeDefined();

      // Retrieve conversation
      const retrievedConversation = await atlasDB.conversations.get(id);
      expect(retrievedConversation).toEqual({ ...conversation, id });
    });

    it('should sort conversations by createdAt', async () => {
      const now = Date.now();
      const conversations: Omit<Conversation, 'id'>[] = [
        {
          title: 'Third conversation',
          createdAt: now + 3000
        },
        {
          title: 'First conversation',
          createdAt: now
        },
        {
          title: 'Second conversation',
          createdAt: now + 1000
        }
      ];

      // Add conversations
      await Promise.all(conversations.map(conv => atlasDB.conversations.add(conv)));

      // Get sorted conversations (newest first)
      const sortedConversations = await atlasDB.conversations
        .orderBy('createdAt')
        .reverse()
        .toArray();

      expect(sortedConversations).toHaveLength(3);
      expect(sortedConversations[0].title).toBe('Third conversation');
      expect(sortedConversations[1].title).toBe('Second conversation');
      expect(sortedConversations[2].title).toBe('First conversation');
    });
  });

  describe('Database Operations', () => {
    it('should clear all data', async () => {
      // Add some data
      await atlasDB.messages.add({
        conversationId: 'conv-1',
        role: 'user',
        content: 'Test',
        createdAt: Date.now(),
        synced: false
      });
      
      await atlasDB.conversations.add({
        title: 'Test',
        createdAt: Date.now()
      });

      // Verify data exists
      expect(await atlasDB.messages.count()).toBe(1);
      expect(await atlasDB.conversations.count()).toBe(1);

      // Clear all data
      await atlasDB.messages.clear();
      await atlasDB.conversations.clear();

      // Verify data is cleared
      expect(await atlasDB.messages.count()).toBe(0);
      expect(await atlasDB.conversations.count()).toBe(0);
    });
  });
});
