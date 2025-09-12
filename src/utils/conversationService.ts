import { supabase } from '../lib/supabase';

import { logger } from '../utils/logger';
export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

/**
 * Create a new conversation for a user
 */
export async function createConversation(user_id: string, title: string = 'New Conversation'): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .insert([{ user_id, title }])
      .select()
      .single();

    if (error) {
      logger.error('Error creating conversation:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    logger.error('Error creating conversation:', error);
    return null;
  }
}

/**
 * Get all conversations for a user
 */
export async function getUserConversations(user_id: string): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching conversations:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    return [];
  }
}

/**
 * Get messages for a specific conversation
 */
export async function getConversationMessages(conversation_id: string): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching messages:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Error fetching messages:', error);
    return [];
  }
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(conversation_id: string, title: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('conversations')
      .update({ title })
      .eq('id', conversation_id);

    if (error) {
      logger.error('Error updating conversation title:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error updating conversation title:', error);
    return false;
  }
}

/**
 * Delete a conversation and all its messages
 */
export async function deleteConversation(conversation_id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversation_id);

    if (error) {
      logger.error('Error deleting conversation:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error deleting conversation:', error);
    return false;
  }
}
