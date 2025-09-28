import { create } from "zustand";
import type { Message } from "../types/chat";

export interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string;
  caption?: string;
}

interface MessageStoreState {
  // Messages state
  messages: Message[];
  isHydrated: boolean;
  conversationId: string | null;
  
  // Message actions
  addMessage: (message: Message) => Promise<void>;
  updateMessage: (id: string, patch: Partial<Message>) => Promise<void>;
  clearMessages: () => void;
  setConversationId: (id: string) => void;
  hydrateFromOffline: (conversationId: string) => Promise<void>;
  
  // Pending attachments state
  pendingAttachments: PendingAttachment[];
  addPendingAttachments: (attachments: PendingAttachment[]) => void;
  updatePendingAttachment: (id: string, updates: Partial<PendingAttachment>) => void;
  removePendingAttachment: (id: string) => void;
  clearPendingAttachments: () => void;
  
  // Conversation management
  initConversation: (userId: string) => Promise<string>;
}

export const useMessageStore = create<MessageStoreState>((set, get) => ({
  // Messages state
  messages: [],
  isHydrated: false,
  conversationId: null,
  
  // Message actions
  addMessage: async (message: Message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
    console.log("[useMessageStore] Added message:", message.id);
  },
  
  updateMessage: async (id: string, patch: Partial<Message>) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...patch } : msg
      ),
    }));
    console.log("[useMessageStore] Updated message:", id, patch);
  },
  
  clearMessages: () => {
    set({ messages: [], isHydrated: false });
    console.log("[useMessageStore] Cleared all messages");
  },
  
  setConversationId: (id: string) => {
    set({ conversationId: id });
    console.log("[useMessageStore] Set conversation ID:", id);
  },
  
  hydrateFromOffline: async (conversationId: string) => {
    // For now, just mark as hydrated
    // In the future, this would load messages from offline storage
    set({ isHydrated: true });
    console.log("[useMessageStore] Hydrated from offline for conversation:", conversationId);
  },
  
  // Pending attachments state
  pendingAttachments: [],
  
  addPendingAttachments: (attachments) =>
    set((state) => ({
      pendingAttachments: [...state.pendingAttachments, ...attachments],
    })),
    
  updatePendingAttachment: (id, updates) =>
    set((state) => ({
      pendingAttachments: state.pendingAttachments.map((attachment) =>
        attachment.id === id ? { ...attachment, ...updates } : attachment
      ),
    })),
    
  removePendingAttachment: (id) =>
    set((state) => ({
      pendingAttachments: state.pendingAttachments.filter((attachment) => attachment.id !== id),
    })),
    
  clearPendingAttachments: () => set({ pendingAttachments: [] }),
  
  initConversation: async (userId: string) => {
    // Generate a new conversation ID
    const conversationId = crypto.randomUUID();
    console.log("[useMessageStore] Initialized conversation:", conversationId, "for user:", userId);
    return conversationId;
  },
}));