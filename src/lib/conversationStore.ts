import Dexie, { type Table } from 'dexie';
import type { Message as UIMessage } from '../types/chat';

export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface CachedMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: { type: 'text' | 'image'; text?: string; imageUrl?: string };
  timestamp: string;
  status: MessageStatus;
}

export interface CachedConversation {
  id: string;
  title: string;
  lastUpdated: string;
  createdAt: string;
  pinned?: boolean;
  user_id?: string;
}

class ConversationDB extends Dexie {
  messages!: Table<CachedMessage, string>;
  conversations!: Table<CachedConversation, string>;

  constructor() {
    super('AtlasConversationDB');
    this.version(1).stores({
      conversations: 'id, lastUpdated, createdAt, user_id',
      messages: 'id, conversation_id, role, timestamp, status'
    });
  }
}

export const db = new ConversationDB();

export const saveConversation = async (conversation: CachedConversation) => {
  await db.conversations.put(conversation);
};

export const loadConversation = async (conversationId: string) => {
  const convo = await db.conversations.get(conversationId);
  const msgs = await db.messages
    .where('conversation_id')
    .equals(conversationId)
    .sortBy('timestamp');
  return convo ? { ...convo, messages: msgs } : null;
};

export const appendMessage = async (message: CachedMessage) => {
  await db.messages.put(message);
  const now = new Date().toISOString();
  const existing = await db.conversations.get(message.conversation_id);
  if (existing) {
    await db.conversations.update(existing.id, { lastUpdated: now });
  } else {
    const convo: CachedConversation = {
      id: message.conversation_id,
      title: 'Conversation',
      lastUpdated: now,
      createdAt: now
    };
    await db.conversations.put(convo);
  }
};

export const setMessageStatus = async (messageId: string, status: MessageStatus) => {
  await db.messages.update(messageId, { status });
};

export const toCachedMessage = (conversationId: string, m: UIMessage, status: MessageStatus): CachedMessage => ({
  id: m.id,
  conversation_id: conversationId,
  role: m.role,
  content: m.content,
  timestamp: m.timestamp,
  status
});

export const loadMessagesSince = async (conversationId: string, sinceTs: number) => {
  const sinceIso = new Date(sinceTs).toISOString();
  return db.messages
    .where('conversation_id')
    .equals(conversationId)
    .and(m => m.timestamp > sinceIso)
    .sortBy('timestamp');
};

export const mergeMessages = async (conversationId: string, incoming: CachedMessage[]) => {
  // Deduplicate by id; upsert
  for (const m of incoming) {
    const existing = await db.messages.get(m.id);
    if (!existing) {
      await db.messages.put(m);
    }
  }
  const now = new Date().toISOString();
  await db.conversations.update(conversationId, { lastUpdated: now });
};


