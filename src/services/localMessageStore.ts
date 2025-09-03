import Dexie, { Table } from 'dexie';
import type { Conversation, Message } from '../types/chat';

// Define the database schema
interface LocalMessage extends Message {
  conversationId: string;
  timestamp: string;
}

interface LocalConversation extends Conversation {
  isSafeMode: boolean;
}

// Extend Dexie to include our tables
class LocalMessageDatabase extends Dexie {
  messages!: Table<LocalMessage>;
  conversations!: Table<LocalConversation>;

  constructor() {
    super('AtlasLocalMessages');
    
    this.version(1).stores({
      messages: '++id, conversationId, timestamp, role',
      conversations: '++id, title, lastUpdated, createdAt, isSafeMode'
    });
  }
}

// Create database instance
const db = new LocalMessageDatabase();

// Local Message Store Service
export class LocalMessageStore {
  // Conversation methods
  static async createConversation(title: string, isSafeMode: boolean = true): Promise<string> {
    const conversation: LocalConversation = {
      id: crypto.randomUUID(),
      title,
      messages: [],
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isSafeMode
    };
    
    await db.conversations.add(conversation);
    return conversation.id;
  }

  static async getConversation(id: string): Promise<LocalConversation | undefined> {
    return await db.conversations.get(id);
  }

  static async getAllConversations(): Promise<LocalConversation[]> {
    return await db.conversations.orderBy('lastUpdated').reverse().toArray();
  }

  static async updateConversationTitle(id: string, title: string): Promise<void> {
    await db.conversations.update(id, { title, lastUpdated: new Date().toISOString() });
  }

  static async deleteConversation(id: string): Promise<void> {
    // Delete all messages in the conversation first
    await db.messages.where('conversationId').equals(id).delete();
    // Then delete the conversation
    await db.conversations.delete(id);
  }

  // Message methods
  static async addMessage(conversationId: string, message: Message): Promise<void> {
    const localMessage: LocalMessage = {
      ...message,
      conversationId,
      timestamp: message.timestamp || new Date().toISOString()
    };
    
    await db.messages.add(localMessage);
    
    // Update conversation's lastUpdated
    await db.conversations.update(conversationId, { 
      lastUpdated: new Date().toISOString() 
    });
  }

  static async getMessages(conversationId: string): Promise<Message[]> {
    const localMessages = await db.messages
      .where('conversationId')
      .equals(conversationId)
      .orderBy('timestamp')
      .toArray();
    
    // Convert back to Message format
    return localMessages.map(({ conversationId, ...message }) => message);
  }

  static async deleteMessage(messageId: string): Promise<void> {
    await db.messages.delete(messageId);
  }

  static async clearAllData(): Promise<void> {
    await db.messages.clear();
    await db.conversations.clear();
  }

  // Utility methods
  static async getConversationMessageCount(conversationId: string): Promise<number> {
    return await db.messages.where('conversationId').equals(conversationId).count();
  }

  static async searchMessages(query: string): Promise<Message[]> {
    const messages = await db.messages.toArray();
    return messages
      .filter(msg => {
        if (msg.content.type === 'text') {
          return msg.content.text?.toLowerCase().includes(query.toLowerCase());
        }
        return false;
      })
      .map(({ conversationId, ...message }) => message);
  }
}

export default LocalMessageStore;
