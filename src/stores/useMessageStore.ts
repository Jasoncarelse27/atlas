import { create } from "zustand";
import { supabase } from "../lib/supabaseClient";
import type { Message } from "../types/chat";
import { generateUUID } from "../utils/uuid";

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
  
  // Streaming state
  isStreaming: boolean;
  setIsStreaming: (isStreaming: boolean) => void;
  
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
  
  // Streaming state
  isStreaming: false,
  setIsStreaming: (isStreaming: boolean) => set({ isStreaming }),
  
  // Message actions
  addMessage: async (message: Message) => {
    console.log('🔍 [useMessageStore] Adding message to store:', message);
    set((state) => {
      const newMessages = [...state.messages, message];
      console.log('✅ [useMessageStore] Store updated, total messages:', newMessages.length);
      return {
        messages: newMessages,
      };
    });
    // Reduced logging for performance
    if (import.meta.env.DEV) {
      console.log("[useMessageStore] Added message:", message.id);
    }
  },
  
  updateMessage: async (id: string, patch: Partial<Message>) => {
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id === id) {
          // If message is being marked as sent or failed, cleanup object URLs
          if (patch.status === 'sent' || patch.status === 'failed') {
            if (msg.attachments) {
              msg.attachments.forEach(attachment => {
                if (attachment.url && attachment.url.startsWith('blob:')) {
                  URL.revokeObjectURL(attachment.url);
                }
              });
            }
          }
          return { ...msg, ...patch };
        }
        return msg;
      }),
    }));
    console.log("[useMessageStore] Updated message:", id, patch);
  },
  
  clearMessages: () => {
    // Cleanup object URLs before clearing
    const state = get();
    state.messages.forEach(msg => {
      if (msg.attachments) {
        msg.attachments.forEach(attachment => {
          if (attachment.url && attachment.url.startsWith('blob:')) {
            URL.revokeObjectURL(attachment.url);
          }
        });
      }
    });
    
    set({ messages: [], isHydrated: false });
    console.log("[useMessageStore] Cleared all messages");
  },
  
  setConversationId: (id: string) => {
    set({ conversationId: id });
    console.log("[useMessageStore] Set conversation ID:", id);
  },
  
  hydrateFromOffline: async (conversationId: string) => {
    try {
      console.log("[useMessageStore] Hydrating messages for conversation:", conversationId);
      
      // Fetch messages from Supabase
      const { data: messages, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[useMessageStore] Failed to fetch messages:", error);
        set({ isHydrated: true });
        return;
      }

      if (messages && messages.length > 0) {
        // Convert Supabase messages to local format
        const localMessages: Message[] = messages.map(msg => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'system',
          type: (msg.message_type || 'text') as 'text' | 'image' | 'audio' | 'file' | 'mixed' | 'system' | 'attachment',
          content: msg.content || '',
          attachments: msg.metadata?.attachments || [],
          metadata: msg.metadata || {},
          status: 'sent' as const,
          timestamp: msg.created_at,
          createdAt: msg.created_at
        }));

        set({ 
          messages: localMessages, 
          isHydrated: true 
        });
        
        console.log(`[useMessageStore] ✅ Hydrated ${localMessages.length} messages from Supabase`);
      } else {
        set({ 
          messages: [], 
          isHydrated: true 
        });
        console.log("[useMessageStore] No messages found in Supabase");
      }
    } catch (error) {
      console.error("[useMessageStore] Error hydrating messages:", error);
      set({ isHydrated: true });
    }
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
    console.log("[useMessageStore] Initializing conversation for user:", userId);
    
    try {
      // Try to fetch an existing conversation
      const { data: convs, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_id", userId)
        .limit(1);

      if (error) {
        console.error("[useMessageStore] Failed to fetch conversation", error);
        // Fallback: create a local conversation ID
        const fallbackId = generateUUID();
        set({ conversationId: fallbackId });
        console.log("[useMessageStore] Using fallback conversation:", fallbackId);
        return fallbackId;
      }

      let conversationId = convs?.[0]?.id;
      if (!conversationId) {
        // Create a new conversation if none exists
        const newId = generateUUID();
        const { error: insertError } = await supabase
          .from("conversations")
          .insert({ id: newId, title: "New conversation" });

        if (insertError) {
          console.error("[useMessageStore] Failed to create conversation", insertError);
          // Fallback: use local conversation ID
          set({ conversationId: newId });
          console.log("[useMessageStore] Using local conversation:", newId);
          return newId;
        }

        conversationId = newId;
      }

      set({ conversationId });
      console.log("[useMessageStore] Initialized conversation:", conversationId);
      return conversationId;
    } catch (err) {
      console.error("[useMessageStore] Conversation init failed:", err);
      // Ultimate fallback
      const fallbackId = generateUUID();
      set({ conversationId: fallbackId });
      console.log("[useMessageStore] Using emergency fallback conversation:", fallbackId);
      return fallbackId;
    }
  },
}));