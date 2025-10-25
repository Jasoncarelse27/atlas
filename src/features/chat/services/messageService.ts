import { supabase } from '../../../lib/supabaseClient';
import type { Message } from '../../../types/chat';
import { createChatError } from '../lib/errorHandler';

// Extended message types for media support
export interface MediaMessage extends Message {
  messageType: 'voice' | 'image' | 'text';
  metadata?: {
    // Voice metadata
    audioUrl?: string;
    duration?: number;
    transcript?: string;
    // Image metadata
    imageUrl?: string;
    dimensions?: { width: number; height: number };
    filename?: string;
    size?: number;
  };
}

export interface SendMessageRequest {
  content: string;
  conversationId: string;
  userId: string;
  messageType: 'voice' | 'image' | 'text';
  metadata?: any;
}

export interface SendMessageResponse {
  id: string;
  content: string;
  messageType: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

const getEnvVar = (key: string): string => {
  // Handle different module systems
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || '';
  }
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || '';
  }
  return '';
};

class MessageService {
  private async getAuthToken(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      return null;
    }
  }

  private async makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAuthToken();
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string): Promise<MediaMessage[]> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map(msg => ({
        ...msg,
        messageType: msg.message_type || 'text',
        metadata: msg.metadata || {},
      })) as MediaMessage[];
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getMessages',
        conversationId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Get messages since a specific timestamp
   */
  async getMessagesSince(conversationId: string, since: number): Promise<MediaMessage[]> {
    try {
      const sinceDate = new Date(since).toISOString();
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .gt('created_at', sinceDate)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map(msg => ({
        ...msg,
        messageType: msg.message_type || 'text',
        metadata: msg.metadata || {},
      })) as MediaMessage[];
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getMessagesSince',
        conversationId,
        since,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Send a message (text, voice, or image)
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      // Prepare message data
      const messageData = {
        conversation_id: request.conversationId,
        user_id: request.userId,
        role: 'user',
        content: request.content,
        message_type: request.messageType,
        metadata: request.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Insert message into database
      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        content: data.content,
        messageType: data.message_type,
        metadata: data.metadata,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'sendMessage',
        request,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Send a streaming message
   */
  async sendMessageStream(request: SendMessageRequest, onChunk: (chunk: string) => void): Promise<SendMessageResponse> {
    try {
      // First, create the message in the database
      const messageResponse = await this.sendMessage(request);

      // Then, make the streaming request to the AI backend
      const backendUrl = getEnvVar('VITE_API_URL') || '';  // Use relative URLs
      const response = await this.makeAuthenticatedRequest(`${backendUrl}/api/chat/stream`, {
        method: 'POST',
        body: JSON.stringify({
          messageId: messageResponse.id,
          content: request.content,
          messageType: request.messageType,
          metadata: request.metadata,
          conversationId: request.conversationId,
          userId: request.userId,
        }),
      });

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          onChunk(chunk);
        }
      }

      return messageResponse;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'sendMessageStream',
        request,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Delete a message (soft delete)
   * @param deleteForEveryone - If true, marks as deleted for everyone; if false, only for current user
   */
  async deleteMessage(messageId: string, conversationId: string, deleteForEveryone: boolean = false): Promise<void> {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: deleteForEveryone ? 'everyone' : 'user'
        })
        .eq('id', messageId)
        .eq('conversation_id', conversationId);

      if (error) throw error;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'deleteMessage',
        messageId,
        conversationId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Edit a message
   */
  async editMessage(messageId: string, newContent: string, conversationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          content: newContent,
          edited_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('conversation_id', conversationId);

      if (error) throw error;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'editMessage',
        messageId,
        conversationId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Retry a failed message
   */
  async retryMessage(messageId: string, conversationId: string): Promise<MediaMessage> {
    try {
      // Get the original message
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .eq('conversation_id', conversationId)
        .single();

      if (error) throw error;

      // Create a new message with the same content
      const retryData = {
        conversation_id: conversationId,
        user_id: data.user_id,
        role: 'user',
        content: data.content,
        message_type: data.message_type,
        metadata: data.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert([retryData])
        .select()
        .single();

      if (insertError) throw insertError;

      return {
        ...newMessage,
        messageType: newMessage.message_type || 'text',
        metadata: newMessage.metadata || {},
      } as MediaMessage;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'retryMessage',
        messageId,
        conversationId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Store message locally (for offline support)
   */
  async storeMessageLocally(message: Partial<MediaMessage>): Promise<void> {
    try {
      // This would integrate with the offline store
      // For now, we'll just log it
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'storeMessageLocally',
        message,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Get stored message from local storage
   */
  async getStoredMessage(messageId: string): Promise<MediaMessage | null> {
    // This would integrate with the offline store
    // For now, we'll return null
    return null;
  }

  /**
   * Clear all stored messages
   */
  async clearStoredMessages(): Promise<void> {
    try {
      // This would integrate with the offline store
      // For now, we'll just log it
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'clearStoredMessages',
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Update message metadata
   */
  async updateMessageMetadata(messageId: string, metadata: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ 
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'updateMessageMetadata',
        messageId,
        metadata,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Get message statistics
   */
  async getMessageStats(conversationId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    lastMessageAt?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('message_type, created_at')
        .eq('conversation_id', conversationId);

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        byType: {} as Record<string, number>,
        lastMessageAt: undefined as string | undefined,
      };

      if (data && data.length > 0) {
        // Count by type
        data.forEach(msg => {
          const type = msg.message_type || 'text';
          stats.byType[type] = (stats.byType[type] || 0) + 1;
        });

        // Get last message timestamp
        const sorted = data.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        stats.lastMessageAt = sorted[0]?.created_at;
      }

      return stats;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getMessageStats',
        conversationId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }
}

export const messageService = new MessageService();
export default messageService;
