import Dexie, { type Table } from "dexie"

export interface Conversation {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
  deletedAt?: string  // Soft delete timestamp
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
  deletedAt?: string  // Soft delete timestamp
}

export interface SyncMetadata {
  userId: string
  lastSyncedAt: string
  syncVersion: number
}

export class AtlasDB extends Dexie {
  conversations!: Table<Conversation, string>
  messages!: Table<Message, string>
  syncMetadata!: Table<SyncMetadata, string>

  constructor() {
    super("AtlasDB_v5") // ✅ Version 5: Soft delete support

    // Version 4: Delta sync schema (keep for migration)
    this.version(4).stores({
      conversations: "id, userId, title, createdAt, updatedAt",
      messages: "id, conversationId, userId, role, type, timestamp, synced, updatedAt",
      syncMetadata: "userId, lastSyncedAt, syncVersion"
    })

    // ✅ Version 5: Add soft delete support
    this.version(5).stores({
      conversations: "id, userId, title, createdAt, updatedAt, deletedAt",
      messages: "id, conversationId, userId, role, type, timestamp, synced, updatedAt, deletedAt",
      syncMetadata: "userId, lastSyncedAt, syncVersion"
    }).upgrade(tx => {
      // Migration: Set deletedAt to null for all existing records
      console.log('[AtlasDB] Migrating to v5: Adding soft delete support');
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
  }
}

export const atlasDB = new AtlasDB()