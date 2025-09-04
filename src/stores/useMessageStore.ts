import Dexie, { type Table as DexieTable } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

export interface OfflineMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  synced_to_supabase?: boolean;
  supabase_id?: string;
}

export interface OfflineConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  synced_to_supabase?: boolean;
  supabase_id?: string;
}

class AtlasDB extends Dexie {
  messages!: DexieTable<OfflineMessage>;
  conversations!: DexieTable<OfflineConversation>;

  constructor() {
    super('AtlasDB');
    this.version(1).stores({
      messages: '&id, conversation_id, user_id, created_at, synced_to_supabase',
      conversations: '&id, user_id, created_at, synced_to_supabase'
    });
  }
}

export const db = new AtlasDB();

/**
 * Hook to get messages for a specific conversation with live updates
 */
export const useMessages = (conversation_id: string) =>
  useLiveQuery(() =>
    db.messages
      .where('conversation_id')
      .equals(conversation_id)
      .sortBy('created_at'),
    [conversation_id]
  );

/**
 * Hook to get all conversations for a user with live updates
 */
export const useConversations = (user_id: string) =>
  useLiveQuery(() =>
    db.conversations
      .where('user_id')
      .equals(user_id)
      .sortBy('created_at'),
    [user_id]
  );

/**
 * Add a message to offline store
 */
export async function addMessage(message: Omit<OfflineMessage, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  const messageWithId = { ...message, id };
  
  await db.messages.add(messageWithId);
  return id;
}

/**
 * Add a conversation to offline store
 */
export async function addConversation(conversation: Omit<OfflineConversation, 'id'>): Promise<string> {
  const id = crypto.randomUUID();
  const conversationWithId = { ...conversation, id };
  
  await db.conversations.add(conversationWithId);
  return id;
}

/**
 * Update message sync status
 */
export async function markMessageSynced(offlineId: string, supabaseId: string): Promise<void> {
  await db.messages.update(offlineId, {
    synced_to_supabase: true,
    supabase_id: supabaseId
  });
}

/**
 * Update conversation sync status
 */
export async function markConversationSynced(offlineId: string, supabaseId: string): Promise<void> {
  await db.conversations.update(offlineId, {
    synced_to_supabase: true,
    supabase_id: supabaseId
  });
}

/**
 * Get unsynced messages
 */
export async function getUnsyncedMessages(): Promise<OfflineMessage[]> {
  return await db.messages
    .where('synced_to_supabase')
    .equals(false)
    .toArray();
}

/**
 * Get unsynced conversations
 */
export async function getUnsyncedConversations(): Promise<OfflineConversation[]> {
  return await db.conversations
    .where('synced_to_supabase')
    .equals(false)
    .toArray();
}

/**
 * Clear all offline data (useful for logout)
 */
export async function clearOfflineData(): Promise<void> {
  await db.messages.clear();
  await db.conversations.clear();
}

/**
 * Get message by ID
 */
export async function getMessage(id: string): Promise<OfflineMessage | undefined> {
  return await db.messages.get(id);
}

/**
 * Get conversation by ID
 */
export async function getConversation(id: string): Promise<OfflineConversation | undefined> {
  return await db.conversations.get(id);
}

/**
 * Update message content
 */
export async function updateMessage(id: string, updates: Partial<OfflineMessage>): Promise<void> {
  await db.messages.update(id, updates);
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(id: string, title: string): Promise<void> {
  await db.conversations.update(id, { title });
}

/**
 * Delete message
 */
export async function deleteMessage(id: string): Promise<void> {
  await db.messages.delete(id);
}

/**
 * Delete conversation and all its messages
 */
export async function deleteConversationAndMessages(conversationId: string): Promise<void> {
  await db.messages.where('conversation_id').equals(conversationId).delete();
  await db.conversations.delete(conversationId);
}
