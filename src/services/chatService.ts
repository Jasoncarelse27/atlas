import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { addPendingMessage } from '../stores/pendingQueue';
import { addConversation, addMessage, markMessageSynced } from '../stores/useMessageStore';
import type { Conversation, Message } from '../types/chat';
import { createConversation, getConversationMessages, getUserConversations } from '../utils/conversationService';
import LocalMessageStore from './localMessageStore';

export interface SendMessageOptions {
  content: string;
  conversationId?: string;
  isSafeMode: boolean;
  onMessageAdded?: (message: Message) => void;
  onError?: (error: string) => void;
}

export interface StreamMessageOptions {
  message: string;
  conversationId?: string;
  isSafeMode: boolean;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: string) => void;
}

export class ChatService {
  // Send a message (either to local storage or Supabase)
  static async sendMessage(options: SendMessageOptions): Promise<Message> {
    const { content, conversationId, isSafeMode, onMessageAdded, onError } = options;
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create message object
      const message: Message = {
        id: uuidv4(),
        role: 'user',
        content: content,
        timestamp: new Date().toISOString(),
        status: 'sent'
      };

      if (isSafeMode) {
        // SafeSpace Mode: Store locally only
        console.log('🔒 SafeSpace Mode: Storing message locally');
        
        let localConversationId = conversationId;
        if (!localConversationId) {
          // Create new local conversation
          localConversationId = await LocalMessageStore.createConversation(
            content.substring(0, 30) + (content.length > 30 ? '...' : ''),
            true
          );
        }
        
        // Store message locally
        await LocalMessageStore.addMessage(localConversationId, message);
        
        // Create assistant response (mock for now)
        const assistantMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: `[SafeSpace Mode] Your message "${content}" has been stored locally and will not be sent to any external servers. This is a privacy-focused response.`,
          timestamp: new Date().toISOString(),
          status: 'sent'
        };
        
        await LocalMessageStore.addMessage(localConversationId, assistantMessage);
        
        // Notify callbacks
        onMessageAdded?.(message);
        onMessageAdded?.(assistantMessage);
        
        return message;
      } else {
        // Normal Mode: Send to Supabase + Dexie
        console.log('🌐 Normal Mode: Sending message to Supabase + Dexie');
        
        let currentConversationId = conversationId;
        
        // Create conversation if it doesn't exist
        if (!currentConversationId) {
          const title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
          currentConversationId = await createConversation(user.id, title);
          if (!currentConversationId) {
            throw new Error('Failed to create conversation');
          }
        }

        // Store message in Dexie first (for immediate UI update)
        const offlineMessageId = await addMessage({
          conversation_id: currentConversationId,
          user_id: user.id,
          role: 'user',
          content: content,
          created_at: new Date().toISOString(),
          synced_to_supabase: false
        });

        // Store message via Edge Function (with fallback to direct Supabase)
        try {
          const response = await fetch('https://rbwabemtucdkytvvpzvk.functions.supabase.co/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''}`,
            },
            body: JSON.stringify({
              conversationId: currentConversationId,
              content: content,
              role: 'user',
              user_id: user.id
            })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              // Mark as synced in Dexie
              await markMessageSynced(offlineMessageId, 'synced');
            }
          } else {
            throw new Error(`Edge Function failed: ${response.status}`);
          }
        } catch (edgeFunctionError) {
          console.error('Edge Function error, falling back to direct Supabase:', edgeFunctionError);
          
          try {
            // Fallback to direct Supabase
            const { data: supabaseMessage, error: supabaseError } = await supabase
              .from('messages')
              .insert({
                conversation_id: currentConversationId,
                user_id: user.id,
                role: 'user',
                content: content
              })
              .select()
              .single();

            if (supabaseError) {
              console.error('Supabase fallback error:', supabaseError);
              // Save to pending queue for later retry
              console.warn('Offline or error sending — saving to pending queue', supabaseError);
              await addPendingMessage({
                content: content,
                conversationId: currentConversationId,
                role: 'user',
                user_id: user.id,
                createdAt: new Date().toISOString(),
              });
            } else {
              // Mark as synced in Dexie
              await markMessageSynced(offlineMessageId, supabaseMessage.id);
            }
          } catch (fallbackError) {
            console.error('All fallbacks failed, saving to pending queue:', fallbackError);
            // Save to pending queue for later retry
            await addPendingMessage({
              content: content,
              conversationId: currentConversationId,
              role: 'user',
              user_id: user.id,
              createdAt: new Date().toISOString(),
            });
          }
        }

        // Notify callback
        onMessageAdded?.(message);
        
        return message;
      }
    } catch (error) {
      const errorMessage = `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMessage);
      onError?.(errorMessage);
      throw new Error(errorMessage);
    }
  }

  // Stream a message response
  static async streamMessage(options: StreamMessageOptions): Promise<void> {
    const { message, conversationId, isSafeMode, onChunk, onComplete, onError } = options;
    
    try {
      if (isSafeMode) {
        // SafeSpace Mode: Simulate streaming locally
        console.log('🔒 SafeSpace Mode: Simulating local streaming');
        
        const response = `[SafeSpace Mode] This is a simulated response to "${message}". Your message is stored locally only and will not be processed by external AI services.`;
        
        // Simulate streaming by sending chunks
        const words = response.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = words.slice(0, i + 1).join(' ');
          onChunk?.(chunk);
          
          // Add small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        onComplete?.(response);
      } else {
        // Normal Mode: Stream from AI service + store in Supabase + Dexie
        console.log('🌐 Normal Mode: Streaming from AI service + storing');
        
        // TODO: Implement actual AI streaming
        const response = `[Normal Mode] This would be a real AI response to "${message}". Currently a placeholder.`;
        
        // Store assistant message in both Supabase and Dexie
        if (conversationId) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              // Store in Dexie first
              const offlineMessageId = await addMessage({
                conversation_id: conversationId,
                user_id: user.id,
                role: 'assistant',
                content: response,
                created_at: new Date().toISOString(),
                synced_to_supabase: false
              });

              // Store in Supabase
              const { data: supabaseMessage, error: supabaseError } = await supabase
                .from('messages')
                .insert({
                  conversation_id: conversationId,
                  user_id: user.id,
                  role: 'assistant',
                  content: response
                })
                .select()
                .single();

              if (!supabaseError && supabaseMessage) {
                await markMessageSynced(offlineMessageId, supabaseMessage.id);
              }
            }
          } catch (error) {
            console.error('Error storing assistant message:', error);
          }
        }
        
        onChunk?.(response);
        onComplete?.(response);
      }
    } catch (error) {
      const errorMessage = `Failed to stream message: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMessage);
      onError?.(errorMessage);
    }
  }

  // Get messages from appropriate source
  static async getMessages(conversationId: string, isSafeMode: boolean): Promise<Message[]> {
    if (isSafeMode) {
      // SafeSpace Mode: Get from local storage
      console.log('🔒 SafeSpace Mode: Loading messages from local storage');
      return await LocalMessageStore.getMessages(conversationId);
    } else {
      // Normal Mode: Get from Supabase + Dexie
      console.log('🌐 Normal Mode: Loading messages from Supabase + Dexie');
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Try to get from Supabase first
          const supabaseMessages = await getConversationMessages(conversationId);
          if (supabaseMessages.length > 0) {
            return supabaseMessages.map(msg => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.created_at,
              status: 'sent'
            }));
          }
        }
      } catch (error) {
        console.error('Error loading from Supabase:', error);
      }
      
      // Fallback to empty array if Supabase fails
      return [];
    }
  }

  // Get conversations from appropriate source
  static async getConversations(isSafeMode: boolean): Promise<Conversation[]> {
    if (isSafeMode) {
      // SafeSpace Mode: Get from local storage
      console.log('🔒 SafeSpace Mode: Loading conversations from local storage');
      return await LocalMessageStore.getAllConversations();
    } else {
      // Normal Mode: Get from Supabase
      console.log('🌐 Normal Mode: Loading conversations from Supabase');
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const supabaseConversations = await getUserConversations(user.id);
          return supabaseConversations.map(conv => ({
            id: conv.id,
            title: conv.title,
            messages: [],
            lastUpdated: conv.created_at,
            createdAt: conv.created_at
          }));
        }
      } catch (error) {
        console.error('Error loading conversations from Supabase:', error);
      }
      
      return [];
    }
  }

  // Create new conversation
  static async createConversation(title: string, isSafeMode: boolean): Promise<string> {
    if (isSafeMode) {
      // SafeSpace Mode: Create locally
      console.log('🔒 SafeSpace Mode: Creating local conversation');
      return await LocalMessageStore.createConversation(title, true);
    } else {
      // Normal Mode: Create in Supabase + Dexie
      console.log('🌐 Normal Mode: Creating Supabase + Dexie conversation');
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Create in Supabase
          const conversationId = await createConversation(user.id, title);
          if (conversationId) {
            // Also create in Dexie for offline access
            await addConversation({
              user_id: user.id,
              title: title,
              created_at: new Date().toISOString(),
              synced_to_supabase: true,
              supabase_id: conversationId
            });
            return conversationId;
          }
        }
      } catch (error) {
        console.error('Error creating conversation in Supabase:', error);
      }
      
      // Fallback to local storage if Supabase fails
      console.log('Falling back to local storage');
      return await LocalMessageStore.createConversation(title, true);
    }
  }
}

export default ChatService;
