import type { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Conversation, Message } from '../types/chat';
import { createNewConversation, generateConversationTitle } from '../types/chat';

interface UseConversationsReturn {
  conversations: Conversation[]; 
  currentConversation: Conversation | null; 
  selectConversation: (conversation: Conversation) => void;
  addMessageToConversation: (conversationId: string, message: Message) => void; 
  createConversation: (title?: string) => Conversation; 
  deleteConversation: (conversationId: string) => void; 
  updateConversationTitle: (conversationId: string, title: string) => void; 
  pinConversation: (conversationId: string, pinned: boolean) => void; 
  clearConversations: () => void; 
  isLoading: boolean; 
  error: string | null; 
}

export const useConversations = (user: User | null): UseConversationsReturn => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch conversations from Supabase
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Temporarily disable complex conversation loading to prevent schema errors
      setConversations([]);
    } catch (err) {
      setError('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [user, currentConversation]);

  // Initialize with a new conversation if none exists
  useEffect(() => {
    if (user) {
      fetchConversations();
    } else {
      setConversations([]);
      setCurrentConversation(null);
    }
  }, [user, fetchConversations]);

  // Create a new conversation
  const createConversation = useCallback((title?: string): Conversation => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    setIsLoading(true);
    
    try {
      const newConversation = createNewConversation(title);
      
      // Insert into Supabase
      supabase
        .from('conversations')
        .insert([{
          id: newConversation.id,
          title: newConversation.title,
          created_at: newConversation.createdAt,
          updated_at: newConversation.lastUpdated,
          pinned: newConversation.pinned || false
        }])
        .select()
        .then(({ error }) => {
          if (error) {
          } else {
          }
        });
      
      
      // Update local state
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversation(newConversation);
      
      return newConversation;
    } catch (err) {
      setError('Failed to create new conversation');
      
      // Fallback to local-only conversation if Supabase fails
      const fallbackConversation = createNewConversation(title);
      
      setConversations(prev => [fallbackConversation, ...prev]);
      setCurrentConversation(fallbackConversation);
      
      return fallbackConversation;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Add a message to a conversation
  const addMessageToConversation = useCallback(async (conversationId: string, message: Message) => {
    if (!user) return;
    
    try {
      // Find the conversation
      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) {
        return;
      }
      
      // Update local state first for immediate UI feedback
      const updatedConversations = conversations.map(conv => {
        if (conv.id === conversationId) {
          // Add message to this conversation
          const updatedMessages = [...conv.messages, message];
          
          // Generate a title if this is the first user message
          let updatedTitle = conv.title;
          if (updatedTitle === 'New Conversation' && message.role === 'user' && updatedMessages.filter(m => m.role === 'user').length === 1) {
            updatedTitle = generateConversationTitle(updatedMessages);
          }
          
          return {
            ...conv,
            messages: updatedMessages,
            title: updatedTitle,
            lastUpdated: new Date().toISOString()
          };
        }
        return conv;
      });
      
      setConversations(updatedConversations);
      
      // Update current conversation if it's the one being modified
      if (currentConversation?.id === conversationId) {
        const updatedConv = updatedConversations.find(c => c.id === conversationId);
        if (updatedConv) {
          setCurrentConversation(updatedConv);
        }
      }
      
      // Save message to messages table
      const { error: messageError } = await supabase
        .from('messages')
        .insert([{
          id: message.id,
          conversation_id: conversationId,
          role: message.role,
          content: message.content,
          created_at: message.timestamp || new Date().toISOString()
        }]);
      
      if (messageError) {
      }
      
      // Update conversation title and lastUpdated in Supabase
      const updatedConv = updatedConversations.find(c => c.id === conversationId);
      if (updatedConv) {
        const { error: updateError } = await supabase
          .from('conversations')
          .update({
            title: updatedConv.title,
            updated_at: updatedConv.lastUpdated
          })
          .eq('id', conversationId);
        
        if (updateError) {
        }
      }
    } catch (err) {
      setError('Failed to save message');
    }
  }, [conversations, currentConversation, user]);

  // Delete a conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!user) return;
    
    try {
      // Delete from Supabase
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', user.id);
      
      if (error) {
        throw error;
      }
      
      // Update local state
      const filteredConversations = conversations.filter(conv => conv.id !== conversationId);
      setConversations(filteredConversations);
      
      // If we're deleting the current conversation, set a new current
      if (currentConversation?.id === conversationId) {
        if (filteredConversations.length > 0) {
          setCurrentConversation(filteredConversations[0]);
        } else {
          // If no conversations left, create a new one
          createConversation();
        }
      }
    } catch (err) {
      setError('Failed to delete conversation');
    }
  }, [conversations, currentConversation, user, createConversation]);

  // Update a conversation's title
  const updateConversationTitle = useCallback(async (conversationId: string, title: string) => {
    if (!user) return;
    
    try {
      const now = new Date().toISOString();
      
      // Update in Supabase
      const { error } = await supabase
        .from('conversations')
        .update({
          title,
          updated_at: now
        })
        .eq('id', conversationId)
        .eq('user_id', user.id);
      
      if (error) {
        throw error;
      }
      
      // Update local state
      setConversations(prev => {
        return prev.map(conv => {
          if (conv.id === conversationId) {
            return { ...conv, title, lastUpdated: now };
          }
          return conv;
        });
      });
      
      // Update current conversation if it's the one being modified
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(prev => {
          if (!prev) return null;
          return { ...prev, title, lastUpdated: now };
        });
      }
    } catch (err) {
      setError('Failed to update conversation title');
    }
  }, [user, currentConversation]);

  // Pin/unpin a conversation
  const pinConversation = useCallback(async (conversationId: string, pinned: boolean) => {
    if (!user) return;
    
    try {
      const now = new Date().toISOString();
      
      // Update in Supabase
      const { error } = await supabase
        .from('conversations')
        .update({
          pinned,
          updated_at: now
        })
        .eq('id', conversationId)
        .eq('user_id', user.id);
      
      if (error) {
        throw error;
      }
      
      // Update local state
      setConversations(prev => {
        return prev.map(conv => {
          if (conv.id === conversationId) {
            return { ...conv, pinned, lastUpdated: now };
          }
          return conv;
        });
      });
      
      // Update current conversation if it's the one being modified
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(prev => {
          if (!prev) return null;
          return { ...prev, pinned, lastUpdated: now };
        });
      }
    } catch (err) {
      setError('Failed to pin/unpin conversation');
    }
  }, [user, currentConversation]);

  // Clear all conversations
  const clearConversations = useCallback(async () => {
    if (!user) return;
    
    try {
      // Delete all conversations for this user from Supabase
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', user.id);
      
      if (error) {
        throw error;
      }
      
      // Create a new conversation
      const newConversation = createConversation();
      
      // Update local state
      setConversations([newConversation]);
      setCurrentConversation(newConversation);
    } catch (err) {
      setError('Failed to clear conversations');
      
      // Fallback: create a new conversation locally
      const newConversation = createNewConversation();
      
      setConversations([newConversation]);
      setCurrentConversation(newConversation);
    }
  }, [user, createConversation]);

  return {
    conversations,
    currentConversation,
    selectConversation: setCurrentConversation,
    addMessageToConversation,
    createConversation,
    deleteConversation,
    updateConversationTitle,
    pinConversation,
    clearConversations,
    isLoading,
    error
  };
};

