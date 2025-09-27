import Dexie, { type Table } from "dexie";

// Database name constant for consistent deletion
export const DB_NAME = "AtlasDB";

export interface Message {
  id?: number;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  synced?: boolean; // false if offline, true once synced
}

export interface Conversation {
  id?: number;
  title: string;
  createdAt: number;
}

class AtlasDatabase extends Dexie {
  messages!: Table<Message>;
  conversations!: Table<Conversation>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      messages: "++id, conversationId, createdAt, synced",
      conversations: "++id, createdAt"
    });
  }
}

export const db = new AtlasDatabase();
