import { create } from "zustand";
import type { Message } from "../types/chat";
import { offlineMessageStore } from "../services/offlineMessageStore";

interface MessageStore {
  messages: Message[];
  conversationId: string | null;
  isHydrated: boolean;
  addMessage: (msg: Message) => void;
  updateMessage: (id: string, patch: Partial<Message>) => void;
  markUploadDone: (id: string, publicUrl: string) => void;
  markUploadFailed: (id: string) => void;
  clearMessages: () => void;
  setConversationId: (id: string | null) => void;
  hydrateFromOffline: (conversationId: string) => Promise<void>;
  syncToOffline: (message: Message) => Promise<void>;
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  messages: [],
  conversationId: null,
  isHydrated: false,
  
  addMessage: async (msg: Message) => {
    console.log("[STORE] addMessage called with:", msg);
    if (!msg?.id) {
      console.warn("[STORE] Skipping invalid message:", msg);
      return;
    }
    
    const state = get();
    if (state.messages.some(m => m.id === msg.id)) {
      console.warn("[STORE] Duplicate message blocked:", msg);
      return;
    }
    
    // Add to Zustand store immediately for UI responsiveness
    set({ messages: [...state.messages, msg] });
    
    // Sync to offline store in background
    try {
      await get().syncToOffline(msg);
    } catch (error) {
      console.error("[STORE] Failed to sync message to offline store:", error);
    }
    
    console.log("[STORE] ✅ Added message:", msg);
    console.log("[STORE] Total messages now:", state.messages.length + 1);
  },
  updateMessage: async (id, patch) => {
    const state = get();
    const updatedMessages = state.messages.map((m) =>
      m.id === id ? { ...m, ...patch } : m
    );
    
    // Update Zustand store immediately
    set({ messages: updatedMessages });
    
    // Sync update to offline store
    const updatedMessage = updatedMessages.find(m => m.id === id);
    if (updatedMessage) {
      try {
        await get().syncToOffline(updatedMessage);
      } catch (error) {
        console.error("[STORE] Failed to sync message update to offline store:", error);
      }
    }
  },
  markUploadDone: (id, publicUrl) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id 
          ? { 
              ...m, 
              uploading: false, 
              error: false, 
              content: [publicUrl], // Replace localUrl with public URL
              status: 'sent' as const
            } 
          : m
      ),
    })),
  markUploadFailed: (id) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id 
          ? { 
              ...m, 
              uploading: false, 
              error: true, 
              status: 'error' as const
            } 
          : m
      ),
    })),
  clearMessages: () => set({ messages: [], isHydrated: false }),
  
  setConversationId: (id: string | null) => {
    set({ conversationId: id, isHydrated: false });
    if (id) {
      get().hydrateFromOffline(id);
    }
  },
  
  hydrateFromOffline: async (conversationId: string) => {
    try {
      console.log("[STORE] Hydrating from offline store for conversation:", conversationId);
      const offlineMessages = await offlineMessageStore.getMessagesByConversation(conversationId);
      
      // Convert offline messages to regular Message format
      const messages: Message[] = offlineMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        type: msg.type,
        content: msg.content,
        attachments: msg.attachments,
        timestamp: msg.timestamp,
        status: msg.status,
        error: msg.error,
        audioUrl: msg.audioUrl,
        imageUrl: msg.imageUrl,
        url: msg.url,
        localUrl: msg.localUrl,
        uploading: msg.uploading,
        progress: msg.progress,
        localFile: msg.localFile,
        metadata: msg.metadata,
      }));
      
      set({ messages, isHydrated: true });
      console.log("[STORE] ✅ Hydrated", messages.length, "messages from offline store");
    } catch (error) {
      console.error("[STORE] Failed to hydrate from offline store:", error);
      set({ isHydrated: true }); // Mark as hydrated even if failed to prevent infinite retries
    }
  },
  
  syncToOffline: async (message: Message) => {
    const state = get();
    if (!state.conversationId) {
      console.warn("[STORE] No conversation ID set, skipping offline sync");
      return;
    }
    
    try {
      await offlineMessageStore.saveMessage({
        id: message.id,
        conversation_id: state.conversationId,
        user_id: '', // Will be set by the calling code
        role: message.role,
        type: message.type,
        content: message.content,
        attachments: message.attachments,
        timestamp: message.timestamp,
        status: message.status || 'sent',
        sync_status: 'pending',
        retry_count: 0,
        error: message.error,
        audioUrl: message.audioUrl,
        imageUrl: message.imageUrl,
        url: message.url,
        localUrl: message.localUrl,
        uploading: message.uploading,
        progress: message.progress,
        localFile: message.localFile,
        metadata: message.metadata,
      });
      console.log("[STORE] ✅ Synced message to offline store:", message.id);
    } catch (error) {
      console.error("[STORE] Failed to sync message to offline store:", error);
      throw error;
    }
  },
}));