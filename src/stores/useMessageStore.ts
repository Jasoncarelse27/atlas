import { create } from "zustand";
import type { Message } from "../types/chat";

interface MessageStore {
  messages: Message[];
  addMessage: (msg: Message) => void;
  updateMessage: (id: string, patch: Partial<Message>) => void;
  clearMessages: () => void;
}

export const useMessageStore = create<MessageStore>((set) => ({
  messages: [],
  addMessage: (msg: Message) => set(state => {
    console.log("[STORE] addMessage called with:", msg);
    if (!msg?.id) {
      console.warn("[STORE] Skipping invalid message:", msg);
      return state;
    }
    if (state.messages.some(m => m.id === msg.id)) {
      console.warn("[STORE] Duplicate message blocked:", msg);
      return state;
    }
    console.log("[STORE] ✅ Added message:", msg);
    console.log("[STORE] Total messages now:", state.messages.length + 1);
    return { messages: [...state.messages, msg] };
  }),
  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, ...patch } : m
      ),
    })),
  clearMessages: () => set({ messages: [] }),
}));