import { v4 as uuidv4 } from 'uuid';
import type { Message } from '../types/chat';
import { supabase } from './supabase';

import { logger } from '../utils/logger';
export interface ConversationService {
  sendMessage: (message: string, conversationId?: string) => Promise<{
    success: boolean;
    response?: string;
    audioUrl?: string;
    error?: string;
    conversationId: string;
  }>;
  createConversation: (title?: string) => Promise<{
    success: boolean;
    conversationId?: string;
    error?: string;
  }>;
  addMessageToConversation: (conversationId: string, message: Message) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

class ConversationServiceImpl implements ConversationService {
  async sendMessage(message: string, conversationId?: string): Promise<{
    success: boolean;
    response?: string;
    audioUrl?: string;
    error?: string;
    conversationId: string;
  }> {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return {
          success: false,
          error: 'No active session',
          conversationId: conversationId || ''
        };
      }

      // Create conversation if none provided
      let finalConversationId = conversationId;
      if (!finalConversationId) {
        const createResult = await this.createConversation();
        if (!createResult.success || !createResult.conversationId) {
          return {
            success: false,
            error: 'Failed to create conversation',
            conversationId: ''
          };
        }
        finalConversationId = createResult.conversationId;
      }

      // Send message to Supabase Edge Function
      const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: message,
          conversationId: finalConversationId
        })
      });

      if (!response.ok) {
        throw new Error(`Chat function failed with status ${response.status}`);
      }

      const responseData = await response.json();
      
      if (!responseData.response) {
        throw new Error('No response received from chat function');
      }

      return {
        success: true,
        response: responseData.response,
        audioUrl: responseData.audioUrl,
        conversationId: finalConversationId
      };

    } catch (error) {
      logger.error('Error in conversationService.sendMessage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        conversationId: conversationId || ''
      };
    }
  }

  async createConversation(title?: string): Promise<{
    success: boolean;
    conversationId?: string;
    error?: string;
  }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return {
          success: false,
          error: 'No active session'
        };
      }

      const conversationId = uuidv4();
      const conversationTitle = title || 'New Conversation';

      // Save conversation to database
      const { error } = await supabase
        .from('conversations')
        .insert({
          id: conversationId,
          user_id: session.user.id,
          title: conversationTitle,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        logger.error('Error creating conversation:', error);
        return {
          success: false,
          error: 'Failed to create conversation in database'
        };
      }

      return {
        success: true,
        conversationId: conversationId
      };

    } catch (error) {
      logger.error('Error in conversationService.createConversation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async addMessageToConversation(conversationId: string, message: Message): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return {
          success: false,
          error: 'No active session'
        };
      }

      // Save message to database
      const { error } = await supabase
        .from('messages')
        .insert({
          id: message.id,
          conversation_id: conversationId,
          user_id: session.user.id,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp,
          audio_url: message.audioUrl,
          image_url: message.imageUrl
        });

      if (error) {
        logger.error('Error adding message to conversation:', error);
        return {
          success: false,
          error: 'Failed to save message to database'
        };
      }

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      return {
        success: true
      };

    } catch (error) {
      logger.error('Error in conversationService.addMessageToConversation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

// Create and export singleton instance
export const conversationService: ConversationService = new ConversationServiceImpl();

// Export the class for testing purposes
export { ConversationServiceImpl };
