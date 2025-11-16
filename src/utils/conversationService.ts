import { supabase } from '../lib/supabaseClient';

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
      return null;
    }

    return data?.id || null;
  } catch (error) {
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
      .is('deleted_at', null)  // ✅ FIX: Only get non-deleted conversations
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return data || [];
  } catch (error) {
    return [];
  }
}

/**
 * Get messages for a specific conversation
 * ✅ SCALABILITY: Supports pagination with limit and offset
 */
export async function getConversationMessages(
  conversation_id: string, 
  options?: { limit?: number; offset?: number }
): Promise<Message[]> {
  try {
    const limit = options?.limit ?? 100; // Default to 100 messages
    const offset = options?.offset ?? 0;
    
    let query = supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      return [];
    }

    // Reverse to show oldest first (normal chat order)
    return (data || []).reverse();
  } catch (error) {
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
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Delete a conversation and all its messages
 */
export async function deleteConversation(conversation_id: string, user_id?: string): Promise<boolean> {
  try {
    // ✅ CRITICAL: Use soft delete RPC if user_id is provided
    // Otherwise fallback to hard delete for backward compatibility
    if (user_id) {
      const { error } = await supabase.rpc('delete_conversation_soft', {
        p_user: user_id,
        p_conversation: conversation_id
      });

      if (error) {
        return false;
      }

      return true;
    } else {
      // Fallback to hard delete if no user_id (backward compatibility)
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', conversation_id);

    if (error) {
      return false;
    }

    return true;
    }
  } catch (error) {
    return false;
  }
}
