import Dexie, { type Table } from 'dexie';
import { handleDexieError } from '../utils/dexieErrorHandler';

// Database name constant for consistent deletion
export const DB_NAME = 'AtlasDB';

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
    content: any;
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
    usage_stats: any;
    last_synced: string;
    sync_status: 'synced' | 'pending' | 'failed';
    sync_error?: string;
  }>;

  profiles!: Table<{
    id: string;
    email: string;
    subscription_tier: 'free' | 'core' | 'studio';
    subscription_status: 'active' | 'inactive' | 'cancelled' | 'trialing';
    created_at: string;
    updated_at: string;
  }>;

  pending_operations!: Table<{
    id: string;
    type: 'send_message' | 'delete_message' | 'create_conversation' | 'update_subscription';
    data: any;
    created_at: string;
    retry_count: number;
    last_retry?: string;
    status: 'pending' | 'processing' | 'failed';
    error?: string;
  }>;

  constructor() {
    super(DB_NAME);
    
    try {
      // 🚀 Clean, simple schema - version 8
      // ✅ Only simple indexes (no compound indexes)
      // ✅ Auto-reset handles all migrations cleanly
      this.version(8).stores({
        conversations: 'id, user_id, title, updated_at, status',
        messages: 'id, conversation_id, user_id, created_at, status, sync_status',
        subscriptions: 'user_id, tier, status, last_synced, sync_status',
        profiles: 'id, email, subscription_tier, subscription_status',
        pending_operations: 'id, type, created_at, status, retry_count',
      });
    } catch (err) {
      console.error("🚨 Dexie schema error during initialization:", err);
      handleDexieError(err); // Auto-reset on schema error
    }

    // Event handlers will be attached when the database is opened by the app
  }
}

// Create and export database instance
export const db = new AtlasDB();

// Database utility functions
export const dbUtils = {
  // Clear all data (useful for testing or reset)
  async clearAll(): Promise<void> {
    await db.transaction('rw', [db.conversations, db.messages, db.subscriptions, db.profiles, db.pending_operations], async () => {
      await db.conversations.clear();
      await db.messages.clear();
      await db.subscriptions.clear();
      await db.profiles.clear();
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
  async importData(data: any): Promise<void> {
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
