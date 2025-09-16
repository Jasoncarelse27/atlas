import { beforeEach, describe, expect, it } from 'vitest';
import { Conversation, Message, db } from '../db';

describe('Atlas Database (Dexie)', () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.messages.clear();
    await db.conversations.clear();
  });

  describe('Messages', () => {
    it('should add and retrieve messages', async () => {
      const message: Omit<Message, 'id'> = {
        conversationId: 'test-conv-1',
        role: 'user',
        content: 'Hello, Atlas!',
        createdAt: Date.now(),
        synced: false
      };

      // Add message
      const id = await db.messages.add(message);
      expect(id).toBeDefined();

      // Retrieve message
      const retrievedMessage = await db.messages.get(id);
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
      await Promise.all(messages.map(msg => db.messages.add(msg)));

      // Query by conversationId
      const conv1Messages = await db.messages
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
      await Promise.all(messages.map(msg => db.messages.add(msg)));

      // Get sorted messages
      const sortedMessages = await db.messages
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

      const id = await db.messages.add(message);
      
      // Update sync status
      await db.messages.update(id, { synced: true });
      
      const updatedMessage = await db.messages.get(id);
      expect(updatedMessage?.synced).toBe(true);
    });
  });

  describe('Conversations', () => {
    it('should add and retrieve conversations', async () => {
      const conversation: Omit<Conversation, 'id'> = {
        title: 'Test Conversation',
        createdAt: Date.now()
      };

      // Add conversation
      const id = await db.conversations.add(conversation);
      expect(id).toBeDefined();

      // Retrieve conversation
      const retrievedConversation = await db.conversations.get(id);
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
      await Promise.all(conversations.map(conv => db.conversations.add(conv)));

      // Get sorted conversations (newest first)
      const sortedConversations = await db.conversations
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
      await db.messages.add({
        conversationId: 'conv-1',
        role: 'user',
        content: 'Test',
        createdAt: Date.now(),
        synced: false
      });
      
      await db.conversations.add({
        title: 'Test',
        createdAt: Date.now()
      });

      // Verify data exists
      expect(await db.messages.count()).toBe(1);
      expect(await db.conversations.count()).toBe(1);

      // Clear all data
      await db.messages.clear();
      await db.conversations.clear();

      // Verify data is cleared
      expect(await db.messages.count()).toBe(0);
      expect(await db.conversations.count()).toBe(0);
    });
  });
});
