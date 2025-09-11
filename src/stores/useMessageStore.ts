import { create } from "zustand";

export type Message = {
  id: string;
  type: "VOICE" | "IMAGE" | "FILE" | "TEXT";
  content: string;
  sender: "user" | "assistant";
  created_at?: string; // matches Supabase schema
};

type MessageStore = {
  messages: Message[];
  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  clearMessages: () => void;
};

export const useMessageStore = create<MessageStore>((set) => ({
  messages: [],
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),
  clearMessages: () => set({ messages: [] }),
}));
