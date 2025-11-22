import Dexie, { type Table } from "dexie";
import { logger } from '../lib/logger';

export interface Conversation {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null  // Soft delete support
}

export interface Message {
  id: string
  conversationId: string
  userId: string
  role: "user" | "assistant" | "system"
  type: "text" | "image" | "audio"
  content: string
  timestamp: string
  synced?: boolean
  updatedAt?: string
  imageUrl?: string           // Add image URL support
  image_url?: string          // Support both snake_case and camelCase
  attachments?: Array<{ type: string; url: string }>  // Support attachments array
  deletedAt?: string          // Soft delete support
  deletedBy?: 'user' | 'everyone' // Who can't see the message
  editedAt?: string           // Message edit timestamp
}

export interface SyncMetadata {
  userId: string
  lastSyncedAt: string
  syncVersion: number
}

export interface Ritual {
  id: string
  userId: string
  title: string
  goal: "energy" | "calm" | "focus" | "creativity"
  steps: Array<{
    type: string
    duration: number
    order: number
    config: {
      title: string
      instructions: string
    }
  }>
  isPreset: boolean
  tierRequired: "free" | "core" | "studio"
  createdAt: string
  updatedAt: string
  synced?: boolean
}

export interface RitualLog {
  id: string
  ritualId: string
  userId: string
  completedAt: string
  durationSeconds: number
  moodBefore: string
  moodAfter: string
  notes?: string
  synced?: boolean
}

export interface AppState {
  key: string
  value: string
}

export class AtlasDB extends Dexie {
  conversations!: Table<Conversation, string>
  messages!: Table<Message, string>
  syncMetadata!: Table<SyncMetadata, string>
  rituals!: Table<Ritual, string>
  ritualLogs!: Table<RitualLog, string>
  appState!: Table<AppState, string>

  constructor() {
    super("AtlasDB_v11") // ✅ Version 11: Add appState table for last conversation tracking
    
    // ✅ MOBILE FIX: Add error handling for mobile Safari
    this.on('close', () => {
      logger.warn('[AtlasDB] Database closed unexpectedly (mobile-safe)');
    });

    // Version 4: Delta sync schema (keep for migration)
    this.version(4).stores({
      conversations: "id, userId, title, createdAt, updatedAt",
      messages: "id, conversationId, userId, role, type, timestamp, synced, updatedAt",
      syncMetadata: "userId, lastSyncedAt, syncVersion"
    })

    // Version 5: Add soft delete support (keep for migration)
    this.version(5).stores({
      conversations: "id, userId, title, createdAt, updatedAt, deletedAt",
      messages: "id, conversationId, userId, role, type, timestamp, synced, updatedAt, deletedAt",
      syncMetadata: "userId, lastSyncedAt, syncVersion"
    }).upgrade(tx => {
      // Migration to v5: Adding soft delete support (kept for compatibility)
      return Promise.all([
        tx.table('conversations').toCollection().modify(conversation => {
          if (!conversation.deletedAt) {
            conversation.deletedAt = undefined;
          }
        }),
        tx.table('messages').toCollection().modify(message => {
          if (!message.deletedAt) {
            message.deletedAt = undefined;
          }
        })
      ]);
    })

    // ✅ Version 6: Simplified hard delete only - remove soft delete fields
    this.version(6).stores({
      conversations: "id, userId, title, createdAt, updatedAt",
      messages: "id, conversationId, userId, role, type, timestamp, synced, updatedAt",
      syncMetadata: "userId, lastSyncedAt, syncVersion"
    }).upgrade(() => {
      // Migration to v6: Removing soft delete support - using hard delete only
      // No migration needed - soft delete fields will be ignored
    })

    // Version 7: Add image support (image_url, attachments)
    this.version(7).stores({
      conversations: "id, userId, title, createdAt, updatedAt",
      messages: "id, conversationId, userId, role, type, timestamp, synced, updatedAt, image_url",
      syncMetadata: "userId, lastSyncedAt, syncVersion"
    }).upgrade(() => {
      // No data migration needed - just schema extension
      logger.debug('[AtlasDB] ✅ Upgraded to v7: Image support added');
      return Promise.resolve();
    })

    // Version 8: Bundle fix - force fresh build
    this.version(8).stores({
      conversations: "id, userId, title, createdAt, updatedAt",
      messages: "id, conversationId, userId, role, type, timestamp, synced, updatedAt, image_url",
      syncMetadata: "userId, lastSyncedAt, syncVersion"
    }).upgrade(() => {
      logger.debug('[AtlasDB] ✅ Upgraded to v8: Bundle fix');
      return Promise.resolve();
    })

    // Version 9: Add edit/delete support
    this.version(9).stores({
      conversations: "id, userId, title, createdAt, updatedAt",
      messages: "id, conversationId, userId, role, type, timestamp, synced, updatedAt, image_url, deletedAt, editedAt",
      syncMetadata: "userId, lastSyncedAt, syncVersion"
    }).upgrade(() => {
      logger.debug('[AtlasDB] ✅ Upgraded to v9: Edit and delete support added');
      return Promise.resolve();
    })

    // Version 10: Add ritual builder support
    this.version(10).stores({
      conversations: "id, userId, title, createdAt, updatedAt",
      messages: "id, conversationId, userId, role, type, timestamp, synced, updatedAt, image_url, deletedAt, editedAt",
      syncMetadata: "userId, lastSyncedAt, syncVersion",
      rituals: "id, userId, title, goal, isPreset, tierRequired, createdAt, updatedAt, synced",
      ritualLogs: "id, ritualId, userId, completedAt, synced"
    }).upgrade(() => {
      logger.debug('[AtlasDB] ✅ Upgraded to v10: Ritual builder support added');
      return Promise.resolve();
    })

    // Version 11: Add appState table for last conversation tracking
    this.version(11).stores({
      conversations: "id, userId, title, createdAt, updatedAt",
      messages: "id, conversationId, userId, role, type, timestamp, synced, updatedAt, image_url, deletedAt, editedAt",
      syncMetadata: "userId, lastSyncedAt, syncVersion",
      rituals: "id, userId, title, goal, isPreset, tierRequired, createdAt, updatedAt, synced",
      ritualLogs: "id, ritualId, userId, completedAt, synced",
      appState: "key, value"
    }).upgrade(() => {
      logger.debug('[AtlasDB] ✅ Upgraded to v11: AppState table added for last conversation tracking');
      return Promise.resolve();
    })
  }
}

export const atlasDB = new AtlasDB() // 🔧 Force rebuild to fix bundle hash

// ✅ PERFORMANCE: Lazy initialization with caching
let initializationPromise: Promise<void> | null = null;
let isInitialized = false;

const initializeDatabase = async (): Promise<void> => {
  try {
    await atlasDB.open();
    
    // Mobile-safe global exposure
    if (typeof window !== 'undefined') {
      (window as any).atlasDB = atlasDB;
      logger.debug('[AtlasDB] ✅ Database initialized and exposed globally');
    }
    
    isInitialized = true;
  } catch (error) {
    logger.error('[AtlasDB] ❌ Initialization failed:', error);
    throw error;
  }
};

// ✅ PERFORMANCE: Ensure database is initialized with caching
export const ensureDatabaseReady = async (): Promise<void> => {
  // Skip if already initialized
  if (isInitialized) {
    return Promise.resolve();
  }
  
  if (!initializationPromise) {
    initializationPromise = initializeDatabase();
  }
  return initializationPromise;
};

// ✅ MOBILE FIX: Auto-initialize on module load (mobile-safe)
if (typeof window !== 'undefined') {
  // Don't block module loading, but ensure it happens
  setTimeout(() => {
    ensureDatabaseReady().catch(err => {
      logger.warn('[AtlasDB] Background initialization failed:', err);
    });
  }, 100);
}