import Dexie, { type Table } from 'dexie';
import { handleDexieError } from '../utils/dexieErrorHandler';
import { immediateReset } from '../utils/immediateReset';

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

      // Add explicit sync_status index for queries
      this.version(3).stores({
        conversations: 'id, user_id, title, updated_at, status, user_id+status',
        messages: 'id, conversation_id, user_id, created_at, status, sync_status, conversation_id+status, sync_status+created_at',
        subscriptions: 'user_id, tier, status, last_synced, sync_status',
        pending_operations: 'id, type, created_at, status, retry_count, type+status',
      });

      // Force schema update to ensure sync_status is properly indexed
      this.version(4).stores({
        conversations: 'id, user_id, title, updated_at, status, user_id+status',
        messages: 'id, conversation_id, user_id, created_at, status, sync_status, conversation_id+status, sync_status+created_at',
        subscriptions: 'user_id, tier, status, last_synced, sync_status',
        pending_operations: 'id, type, created_at, status, retry_count, type+status',
      });

      // 🚀 Bumped version to 6 to force a clean rebuild
      this.version(6).stores({
        conversations: 'id, user_id, title, updated_at, status, user_id+status',
        messages: 'id, conversation_id, user_id, created_at, status, sync_status, conversation_id+status, sync_status+created_at',
        subscriptions: 'user_id, tier, status, last_synced, sync_status',
        pending_operations: 'id, type, created_at, status, retry_count, type+status',
      });
    } catch (err) {
      console.error("🚨 Dexie schema error during initialization:", err);
      handleDexieError(err); // Auto-reset on schema error
    }

    // 🔥 Auto-reset on schema mismatch
    this.on("blocked", () => {
      console.warn("⚠️ Dexie blocked — forcing reset");
      immediateReset();
    });

    // ✅ Auto-handle schema mismatch
    this.open().catch(err => {
      console.error("🚨 Dexie error during open:", err);
      if (err.name === "SchemaError" || err.name === "VersionError" || err.name === "DexieError2") {
        console.error("🚨 Dexie schema mismatch — auto-resetting…", err);
        immediateReset();
      } else {
        throw err;
      }
    });

    // 🔥 Additional error handler for runtime schema errors
    this.on('error', (err) => {
      console.error("🚨 Dexie runtime error:", err);
      handleDexieError(err);
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
