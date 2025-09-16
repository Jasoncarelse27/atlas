import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Conversation, Message, db } from '../db';

type MessageStore = {
  // Messages
  messages: Message[];
  
  // Actions
  addMessage: (msg: Omit<Message, 'id'>) => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  markAsSynced: (id: number) => Promise<void>;
  clearMessages: () => Promise<void>;
  
  // Conversation management
  conversations: Conversation[];
  currentConversationId: string | null;
  createConversation: (title?: string) => Promise<string>;
  setCurrentConversation: (id: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  clearAll: () => Promise<void>;
};

export const useMessageStore = create<MessageStore>()(
  persist(
    (set, get) => ({
      // Initial state
      messages: [],
      conversations: [],
      currentConversationId: null,

      // Message actions
      addMessage: async (msg) => {
        const id = await db.messages.add({ 
          ...msg, 
          createdAt: Date.now(), 
          synced: false 
        });
        
        set((state) => ({
          messages: [...state.messages, { ...msg, id }]
        }));
      },

      loadMessages: async (conversationId) => {
        const msgs = await db.messages
          .where("conversationId")
          .equals(conversationId)
          .sortBy("createdAt");
        
        set({ messages: msgs });
      },

      markAsSynced: async (id) => {
        await db.messages.update(id, { synced: true });
        set((state) => ({
          messages: state.messages.map(msg => 
            msg.id === id ? { ...msg, synced: true } : msg
          )
        }));
      },

      clearMessages: async () => {
        await db.messages.clear();
        set({ messages: [] });
      },

      // Conversation management
      createConversation: async (title = 'New Conversation') => {
        const id = Date.now().toString();
        const newConversation: Conversation = {
          title,
          createdAt: Date.now(),
        };
        
        const dbId = await db.conversations.add(newConversation);
        
        set((state) => ({
          conversations: [...state.conversations, { ...newConversation, id: dbId }],
          currentConversationId: id,
          messages: []
        }));
        
        return id;
      },

      setCurrentConversation: async (id) => {
        set({ currentConversationId: id });
        await get().loadMessages(id);
      },

      loadConversations: async () => {
        const convs = await db.conversations.orderBy('createdAt').reverse().toArray();
        set({ conversations: convs });
      },

      clearAll: async () => {
        await db.messages.clear();
        await db.conversations.clear();
        set({ messages: [], conversations: [], currentConversationId: null });
      },
    }),
    {
      name: 'atlas-message-store',
      partialize: (state) => ({
        currentConversationId: state.currentConversationId,
      }),
    }
  )
);
