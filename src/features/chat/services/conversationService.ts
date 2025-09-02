import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import type { Conversation } from '../../../types/chat';
import { createChatError } from '../lib/errorHandler';
import { mutationKeys, queryKeys } from '../lib/queryClient';

// Service class for conversation operations
class ConversationService {
  /**
   * Get all conversations for a user
   */
  async getConversations(userId: string): Promise<Conversation[]> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('last_updated', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getConversations',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Get a single conversation by ID
   */
  async getConversation(conversationId: string, userId: string): Promise<Conversation | null> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getConversation',
        userId,
        conversationId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(userId: string, title: string): Promise<Conversation> {
    try {
      const newConversation = {
        user_id: userId,
        title,
        last_updated: new Date().toISOString(),
        created_at: new Date().toISOString(),
        pinned: false,
      };

      const { data, error } = await supabase
        .from('conversations')
        .insert(newConversation)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'createConversation',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(
    conversationId: string, 
    userId: string, 
    title: string
  ): Promise<Conversation> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .update({ title, last_updated: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'updateConversationTitle',
        userId,
        conversationId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Toggle conversation pin status
   */
  async toggleConversationPin(
    conversationId: string, 
    userId: string, 
    pinned: boolean
  ): Promise<Conversation> {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .update({ pinned, last_updated: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'toggleConversationPin',
        userId,
        conversationId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    try {
      // First delete all messages in the conversation
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (messagesError) throw messagesError;

      // Then delete the conversation
      const { error: conversationError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (conversationError) throw conversationError;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'deleteConversation',
        userId,
        conversationId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Clear all conversations for a user
   */
  async clearAllConversations(userId: string): Promise<void> {
    try {
      // Delete all messages first
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('user_id', userId);

      if (messagesError) throw messagesError;

      // Delete all conversations
      const { error: conversationsError } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', userId);

      if (conversationsError) throw conversationsError;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'clearAllConversations',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }
}

// Create service instance
export const conversationService = new ConversationService();

// React Query hooks for conversations
export function useConversations(userId: string) {
  return useQuery({
    queryKey: queryKeys.conversations.list(),
    queryFn: () => conversationService.getConversations(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useConversation(conversationId: string, userId: string) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(conversationId),
    queryFn: () => conversationService.getConversation(conversationId, userId),
    enabled: !!conversationId && !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.conversations.create,
    mutationFn: ({ userId, title }: { userId: string; title: string }) =>
      conversationService.createConversation(userId, title),
    onSuccess: (newConversation) => {
      // Optimistically update conversations list
      queryClient.setQueryData(
        queryKeys.conversations.list(),
        (old: Conversation[] | undefined) => {
          if (!old) return [newConversation];
          return [newConversation, ...old];
        }
      );
      
      // Invalidate conversations list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.lists() });
    },
  });
}

export function useUpdateConversationTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.conversations.update,
    mutationFn: ({ conversationId, userId, title }: { conversationId: string; userId: string; title: string }) =>
      conversationService.updateConversationTitle(conversationId, userId, title),
    onSuccess: (updatedConversation) => {
      // Update conversation in cache
      queryClient.setQueryData(
        queryKeys.conversations.detail(updatedConversation.id),
        updatedConversation
      );
      
      // Update in conversations list
      queryClient.setQueryData(
        queryKeys.conversations.list(),
        (old: Conversation[] | undefined) => {
          if (!old) return [updatedConversation];
          return old.map(conv => 
            conv.id === updatedConversation.id ? updatedConversation : conv
          );
        }
      );
    },
  });
}

export function useToggleConversationPin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.conversations.pin,
    mutationFn: ({ conversationId, userId, pinned }: { conversationId: string; userId: string; pinned: boolean }) =>
      conversationService.toggleConversationPin(conversationId, userId, pinned),
    onSuccess: (updatedConversation) => {
      // Update conversation in cache
      queryClient.setQueryData(
        queryKeys.conversations.detail(updatedConversation.id),
        updatedConversation
      );
      
      // Update in conversations list
      queryClient.setQueryData(
        queryKeys.conversations.list(),
        (old: Conversation[] | undefined) => {
          if (!old) return [updatedConversation];
          return old.map(conv => 
            conv.id === updatedConversation.id ? updatedConversation : conv
          );
        }
      );
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: mutationKeys.conversations.delete,
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      conversationService.deleteConversation(conversationId, userId),
    onSuccess: (_, { conversationId }) => {
      // Remove from conversations list
      queryClient.setQueryData(
        queryKeys.conversations.list(),
        (old: Conversation[] | undefined) => {
          if (!old) return [];
          return old.filter(conv => conv.id !== conversationId);
        }
      );
      
      // Remove conversation detail
      queryClient.removeQueries({ queryKey: queryKeys.conversations.detail(conversationId) });
      
      // Invalidate conversations list
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.lists() });
    },
  });
}

export function useClearAllConversations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['conversations', 'clearAll'],
    mutationFn: ({ userId }: { userId: string }) =>
      conversationService.clearAllConversations(userId),
    onSuccess: () => {
      // Clear all conversation-related queries
      queryClient.removeQueries({ queryKey: queryKeys.conversations.all });
      queryClient.removeQueries({ queryKey: queryKeys.messages.all });
    },
  });
}
