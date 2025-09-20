import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  error?: string;
  timestamp: string;
}

interface MessageStore {
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void;
  setError: (id: string, error: string) => void;
  clearMessages: () => void;
  getLastMessage: () => ChatMessage | undefined;
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  messages: [],
  
  addMessage: (message: ChatMessage) => {
    set((state) => ({
      messages: [...state.messages, message]
    }));
  },
  
  updateMessage: (id: string, patch: Partial<ChatMessage>) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...patch } : msg
      )
    }));
  },
  
  setError: (id: string, error: string) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, error, streaming: false } : msg
      )
    }));
  },
  
  clearMessages: () => {
    set({ messages: [] });
  },
  
  getLastMessage: () => {
    const { messages } = get();
    return messages[messages.length - 1];
  }
}));