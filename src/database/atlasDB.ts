import Dexie, { type Table } from "dexie"

export interface Conversation {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
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
    super("AtlasDB_v4") // ✅ NEW DATABASE NAME for delta sync

    // ✅ DELTA SYNC SCHEMA - Version 4 with sync tracking
    this.version(4).stores({
      conversations: "id, userId, title, createdAt, updatedAt",
      messages: "id, conversationId, userId, role, type, timestamp, synced, updatedAt",
      syncMetadata: "userId, lastSyncedAt, syncVersion"
    })
  }
}

export const atlasDB = new AtlasDB()