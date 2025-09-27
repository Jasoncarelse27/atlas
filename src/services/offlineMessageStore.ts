import { db } from '../db';
import { createChatError } from '../features/chat/lib/errorHandler';
import type { Message } from '../types/chat';

export interface OfflineMessage extends Message {
  sync_status: 'synced' | 'pending' | 'failed';
  sync_error?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface MessageQueryOptions {
  conversationId?: string;
  userId?: string;
  status?: string;
  sync_status?: string;
  limit?: number;
  offset?: number;
}

/**
 * Offline message store for managing messages in local Dexie database
 * Provides CRUD operations with sync status tracking
 */
export const offlineMessageStore = {
  /**
   * Get messages by conversation ID
   */
  async getMessagesByConversation(conversationId: string): Promise<OfflineMessage[]> {
    try {
      return await db.messages
        .where('conversation_id')
        .equals(conversationId)
        .toArray()
        .then(messages => messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getMessagesByConversation',
        conversationId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Get messages with optional filtering
   */
  async getMessages(options: MessageQueryOptions = {}): Promise<OfflineMessage[]> {
    try {
      let query = db.messages.toCollection();

      if (options.conversationId) {
        query = query.filter(msg => msg.conversation_id === options.conversationId);
      }

      if (options.userId) {
        query = query.filter(msg => msg.user_id === options.userId);
      }

      if (options.status) {
        query = query.filter(msg => msg.status === options.status);
      }

      if (options.sync_status) {
        query = query.filter(msg => msg.sync_status === options.sync_status);
      }

      // Apply pagination
      if (options.offset) {
        query = query.offset(options.offset);
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      return await query.toArray().then(messages => messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getMessages',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Get a single message by ID
   */
  async getMessage(messageId: string): Promise<OfflineMessage | undefined> {
    try {
      return await db.messages.get(messageId);
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getMessage',
        messageId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Save a message to local storage
   */
  async saveMessage(message: Partial<OfflineMessage>): Promise<string> {
    try {
      const messageId = message.id || crypto.randomUUID();
      const now = new Date().toISOString();
      
      const messageToSave: OfflineMessage = {
        id: messageId,
        conversation_id: message.conversation_id || '',
        user_id: message.user_id || '',
        role: message.role || 'user',
        content: message.content || { type: 'text', text: '' },
        timestamp: message.timestamp || now,
        status: message.status || 'pending',
        sync_status: message.sync_status || 'pending',
        retry_count: message.retry_count || 0,
        created_at: message.created_at || now,
        updated_at: now,
        ...message,
      };

      await db.messages.put(messageToSave);
      return messageId;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'saveMessage',
        messageId: message.id,
        conversationId: message.conversation_id,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Update an existing message
   */
  async updateMessage(messageId: string, updates: Partial<OfflineMessage>): Promise<void> {
    try {
      const existing = await db.messages.get(messageId);
      if (!existing) {
        throw new Error(`Message ${messageId} not found`);
      }

      const updatedMessage: OfflineMessage = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      await db.messages.put(updatedMessage);
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'updateMessage',
        messageId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    try {
      await db.messages.delete(messageId);
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'deleteMessage',
        messageId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Mark message as synced
   */
  async markAsSynced(messageId: string): Promise<void> {
    try {
      await db.messages.update(messageId, {
        sync_status: 'synced',
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'markAsSynced',
        messageId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Mark message as failed to sync
   */
  async markAsSyncFailed(messageId: string, error: string): Promise<void> {
    try {
      const existing = await db.messages.get(messageId);
      if (!existing) return;

      await db.messages.update(messageId, {
        sync_status: 'failed',
        sync_error: error,
        retry_count: (existing.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'markAsSyncFailed',
        messageId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Mark message as retried
   */
  async markAsRetried(messageId: string): Promise<void> {
    try {
      await db.messages.update(messageId, {
        status: 'retried',
        sync_status: 'pending',
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'markAsRetried',
        messageId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Get pending messages that need to be synced
   */
  async getPendingMessages(): Promise<OfflineMessage[]> {
    try {
      return await db.messages
        .where('sync_status')
        .equals('pending')
        .toArray()
        .then(messages => messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    } catch (error) {
      // Handle Dexie schema errors with auto-reset
      if (error?.name === "SchemaError" || error?.message?.includes("not indexed")) {
        console.warn("🚨 Schema error in getPendingMessages, triggering auto-reset");
        const { handleDexieError } = await import('../utils/dexieErrorHandler');
        await handleDexieError(error);
        return []; // Return empty array while resetting
      }
      
      const chatError = createChatError(error, {
        operation: 'getPendingMessages',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Get failed messages that need retry
   */
  async getFailedMessages(): Promise<OfflineMessage[]> {
    try {
      return await db.messages
        .where('sync_status')
        .equals('failed')
        .toArray()
        .then(messages => messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getFailedMessages',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Get messages by status
   */
  async getMessagesByStatus(status: string): Promise<OfflineMessage[]> {
    try {
      return await db.messages
        .where('status')
        .equals(status)
        .toArray()
        .then(messages => messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getMessagesByStatus',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Count messages by conversation
   */
  async countMessagesByConversation(conversationId: string): Promise<number> {
    try {
      return await db.messages
        .where('conversation_id')
        .equals(conversationId)
        .count();
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'countMessagesByConversation',
        conversationId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Clear all messages for a conversation
   */
  async clearConversationMessages(conversationId: string): Promise<void> {
    try {
      await db.messages
        .where('conversation_id')
        .equals(conversationId)
        .delete();
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'clearConversationMessages',
        conversationId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    total: number;
    synced: number;
    pending: number;
    failed: number;
  }> {
    try {
      const total = await db.messages.count();
      const synced = await db.messages.where('sync_status').equals('synced').count();
      const pending = await db.messages.where('sync_status').equals('pending').count();
      const failed = await db.messages.where('sync_status').equals('failed').count();

      return { total, synced, pending, failed };
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getSyncStats',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  },
};
