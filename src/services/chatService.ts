import { v4 as uuidv4 } from 'uuid';
import type { Conversation, Message } from '../types/chat';
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
      // Create message object
      const message: Message = {
        id: uuidv4(),
        role: 'user',
        content: {
          type: 'text',
          text: content
        },
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
          content: {
            type: 'text',
            text: `[SafeSpace Mode] Your message "${content}" has been stored locally and will not be sent to any external servers. This is a privacy-focused response.`
          },
          timestamp: new Date().toISOString(),
          status: 'sent'
        };
        
        await LocalMessageStore.addMessage(localConversationId, assistantMessage);
        
        // Notify callbacks
        onMessageAdded?.(message);
        onMessageAdded?.(assistantMessage);
        
        return message;
      } else {
        // Normal Mode: Send to Supabase (placeholder for now)
        console.log('🌐 Normal Mode: Sending message to Supabase');
        
        // TODO: Implement actual Supabase integration
        // For now, just return the message
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
        // Normal Mode: Stream from AI service (placeholder)
        console.log('🌐 Normal Mode: Streaming from AI service');
        
        // TODO: Implement actual AI streaming
        const response = `[Normal Mode] This would be a real AI response to "${message}". Currently a placeholder.`;
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
      // Normal Mode: Get from Supabase (placeholder)
      console.log('🌐 Normal Mode: Loading messages from Supabase');
      // TODO: Implement actual Supabase loading
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
      // Normal Mode: Get from Supabase (placeholder)
      console.log('🌐 Normal Mode: Loading conversations from Supabase');
      // TODO: Implement actual Supabase loading
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
      // Normal Mode: Create in Supabase (placeholder)
      console.log('🌐 Normal Mode: Creating Supabase conversation');
      // TODO: Implement actual Supabase creation
      return uuidv4();
    }
  }
}

export default ChatService;
