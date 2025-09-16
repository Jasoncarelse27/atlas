import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  conversationId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: string;
  createdAt: string;
}

type MessageStore = {
  // Conversations
  conversations: Conversation[];
  currentConversationId: string | null;
  
  // Messages
  messages: Message[];
  
  // Actions
  addMessage: (msg: Message) => void;
  updateAssistantMessage: (partial: string) => void;
  deleteMessage: (messageId: string) => void;
  clearMessages: () => void;
  
  // Conversation management
  createConversation: (title?: string) => string;
  setCurrentConversation: (id: string) => void;
  updateConversationTitle: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  getCurrentConversation: () => Conversation | null;
  
  // Offline-first persistence
  syncToStorage: () => void;
  loadFromStorage: () => void;
};

export const useMessageStore = create<MessageStore>()(
  persist(
    (set, get) => ({
      // Initial state
      conversations: [],
      currentConversationId: null,
      messages: [],

      // Message actions
      addMessage: (msg) => {
        set((state) => {
          const newMessages = [...state.messages, msg];
          
          // Update conversation if it exists
          const conversations = state.conversations.map(conv => 
            conv.id === msg.conversationId || conv.id === state.currentConversationId
              ? { ...conv, messages: [...conv.messages, msg], lastUpdated: new Date().toISOString() }
              : conv
          );
          
          return { 
            messages: newMessages,
            conversations
          };
        });
      },

      updateAssistantMessage: (partial) => {
        set((state) => {
          const messages = [...state.messages];
          const lastIndex = messages.length - 1;

          if (messages[lastIndex]?.role === 'assistant') {
            messages[lastIndex] = {
              ...messages[lastIndex],
              content: partial,
            };
          } else {
            const newMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: partial,
              timestamp: new Date().toISOString(),
              conversationId: state.currentConversationId || undefined,
            };
            messages.push(newMessage);
          }

          // Update conversation
          const conversations = state.conversations.map(conv => 
            conv.id === state.currentConversationId
              ? { ...conv, messages: messages.filter(m => m.conversationId === conv.id), lastUpdated: new Date().toISOString() }
              : conv
          );

          return { messages, conversations };
        });
      },

      deleteMessage: (messageId) => {
        set((state) => ({
          messages: state.messages.filter(msg => msg.id !== messageId),
          conversations: state.conversations.map(conv => ({
            ...conv,
            messages: conv.messages.filter(msg => msg.id !== messageId)
          }))
        }));
      },

      clearMessages: () => set({ messages: [] }),

      // Conversation management
      createConversation: (title = 'New Conversation') => {
        const id = Date.now().toString();
        const newConversation: Conversation = {
          id,
          title,
          messages: [],
          lastUpdated: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        
        set((state) => ({
          conversations: [...state.conversations, newConversation],
          currentConversationId: id,
          messages: []
        }));
        
        return id;
      },

      setCurrentConversation: (id) => {
        set((state) => {
          const conversation = state.conversations.find(conv => conv.id === id);
          return {
            currentConversationId: id,
            messages: conversation?.messages || []
          };
        });
      },

      updateConversationTitle: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map(conv =>
            conv.id === id ? { ...conv, title, lastUpdated: new Date().toISOString() } : conv
          )
        }));
      },

      deleteConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.filter(conv => conv.id !== id),
          currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
          messages: state.currentConversationId === id ? [] : state.messages
        }));
      },

      getCurrentConversation: () => {
        const state = get();
        return state.conversations.find(conv => conv.id === state.currentConversationId) || null;
      },

      // Offline-first persistence
      syncToStorage: () => {
        // Zustand persist middleware handles this automatically
      },

      loadFromStorage: () => {
        // Zustand persist middleware handles this automatically
      },
    }),
    {
      name: 'atlas-message-store',
      partialize: (state) => ({
        conversations: state.conversations,
        currentConversationId: state.currentConversationId,
      }),
    }
  )
);
