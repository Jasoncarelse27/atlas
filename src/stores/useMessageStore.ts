import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

type MessageStore = {
  messages: Message[];
  addMessage: (msg: Message) => void;
  updateAssistantMessage: (partial: string) => void;
  clearMessages: () => void;
};

export const useMessageStore = create<MessageStore>((set, get) => ({
  messages: [],

  addMessage: (msg) => {
    set((state) => ({ messages: [...state.messages, msg ]}));
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
        messages.push({
          id: Date.now().toString(),
          role: 'assistant',
          content: partial,
          createdAt: new Date().toISOString(),
        });
      }

      return { messages };
    });
  },

  clearMessages: () => set({ messages: [] }),
}));
