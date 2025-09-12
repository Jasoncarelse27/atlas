import Dexie, { type Table } from 'dexie';
import type { Message } from '../types/chat';
import type { SubscriptionProfile } from '../features/chat/services/subscriptionService';

// Extend Dexie with our table types
export class AtlasDB extends Dexie {
  conversations!: Table<{
    id: string;
    user_id: string;
    title: string;
    last_updated: string;
    created_at: string;
    pinned: boolean;
    status: 'synced' | 'pending' | 'failed';
    sync_error?: string;
  }>;

  messages!: Table<{
    id: string;
    conversation_id: string;
    user_id: string;
    role: 'user' | 'assistant';
    _content: unknown;
    timestamp: string;
    status: 'sent' | 'sending' | 'failed' | 'pending' | 'retried';
    sync_status: 'synced' | 'pending' | 'failed';
    sync_error?: string;
    retry_count: number;
    created_at: string;
    updated_at: string;
  }>;

  subscriptions!: Table<{
    user_id: string;
    tier: 'free' | 'core' | 'studio';
    status: 'active' | 'inactive' | 'cancelled' | 'trialing';
    _usage_stats: unknown;
    last_synced: string;
    sync_status: 'synced' | 'pending' | 'failed';
    sync_error?: string;
  }>;

  pending_operations!: Table<{
    id: string;
    type: 'send_message' | 'delete_message' | 'create_conversation' | 'update_subscription';
    _data: unknown;
    created_at: string;
    retry_count: number;
    last_retry?: string;
    status: 'pending' | 'processing' | 'failed';
    error?: string;
  }>;

  constructor() {
    super('AtlasDB');
    
    this.version(1).stores({
      conversations: 'id, user_id, title, updated_at, status',
      messages: 'id, conversation_id, user_id, created_at, status, sync_status',
      subscriptions: 'user_id, tier, status, last_synced, sync_status',
      pending_operations: 'id, type, created_at, status, retry_count',
    });

    // Add indexes for better query performance
    this.version(2).stores({
      conversations: 'id, user_id, title, updated_at, status, user_id+status',
      messages: 'id, conversation_id, user_id, created_at, status, sync_status, conversation_id+status',
      subscriptions: 'user_id, tier, status, last_synced, sync_status',
      pending_operations: 'id, type, created_at, status, retry_count, type+status',
    });
  }
}

// Create and export database instance
export const db = new AtlasDB();

// Database utility functions
export const dbUtils = {
  // Clear all data (useful for testing or reset)
  async clearAll(): Promise<void> {
    await db.transaction('rw', [db.conversations, db.messages, db.subscriptions, db.pending_operations], async () => {
      await db.conversations.clear();
      await db.messages.clear();
      await db.subscriptions.clear();
      await db.pending_operations.clear();
    });
  },

  // Get database size (useful for monitoring)
  async getSize(): Promise<number> {
    const conversations = await db.conversations.count();
    const messages = await db.messages.count();
    const subscriptions = await db.subscriptions.count();
    const pendingOps = await db.pending_operations.count();
    
    return conversations + messages + subscriptions + pendingOps;
  },

  // Export all data (useful for backup)
  async exportData(): Promise<any> {
    const conversations = await db.conversations.toArray();
    const messages = await db.messages.toArray();
    const subscriptions = await db.subscriptions.toArray();
    const pendingOps = await db.pending_operations.toArray();
    
    return {
      conversations,
      messages,
      subscriptions,
      pending_operations: pendingOps,
      exported_at: new Date().toISOString(),
      version: db.verno,
    };
  },

  // Import data (useful for restore)
  async importData(_data: unknown): Promise<void> {
    await db.transaction('rw', [db.conversations, db.messages, db.subscriptions, db.pending_operations], async () => {
      if (data.conversations) {
        await db.conversations.bulkPut(data.conversations);
      }
      if (data.messages) {
        await db.messages.bulkPut(data.messages);
      }
      if (data.subscriptions) {
        await db.subscriptions.bulkPut(data.subscriptions);
      }
      if (data.pending_operations) {
        await db.pending_operations.bulkPut(data.pending_operations);
      }
    });
  },
};

// Export types for use in other files
export type { AtlasDB };
export default db;
