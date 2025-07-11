import { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Conversation, Message } from '../types/chat';
import { createNewConversation, generateConversationTitle } from '../types/chat';
import { v4 as uuidv4 } from 'uuid';

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
      console.log('Fetching conversations for user:', user.id);
      
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      // Transform data to match Conversation type
      const fetchedConversations: Conversation[] = await Promise.all(
        data.map(async (conv) => {
          // Fetch messages for this conversation
          const { data: messagesData, error: messagesError } = await supabase
            .from('webhook_logs')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('timestamp', { ascending: true });
          
          if (messagesError) {
            console.error('Error fetching messages for conversation:', conv.id, messagesError);
            return {
              id: conv.id,
              title: conv.title || 'New Conversation',
              messages: [],
              createdAt: conv.created_at,
              lastUpdated: conv.updated_at,
              pinned: conv.pinned || false,
              user_id: conv.user_id
            };
          }
          
          // Transform webhook_logs to Message type
          const messages: Message[] = messagesData.map((log) => ({
            id: log.id,
            role: log.payload?.role || (log.payload?.source === 'user' ? 'user' : 'assistant'),
            content: log.payload?.message || log.payload?.content || '',
            timestamp: log.timestamp,
            audioUrl: log.payload?.audioUrl,
            imageUrl: log.payload?.imageUrl
          }));
          
          return {
            id: conv.id,
            title: conv.title || 'New Conversation',
            messages,
            createdAt: conv.created_at,
            lastUpdated: conv.updated_at,
            pinned: conv.pinned || false,
            user_id: conv.user_id
          };
        })
      );
      
      console.log('Fetched conversations:', fetchedConversations.length);
      setConversations(fetchedConversations);
      
      // Set current conversation to the most recent one if none is selected
      if (fetchedConversations.length > 0 && !currentConversation) {
        setCurrentConversation(fetchedConversations[0]);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
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
      newConversation.user_id = user.id;
      
      // Insert into Supabase
      supabase
        .from('conversations')
        .insert([{
          id: newConversation.id,
          user_id: user.id,
          title: newConversation.title,
          created_at: newConversation.createdAt,
          updated_at: newConversation.lastUpdated,
          pinned: newConversation.pinned || false
        }])
        .select()
        .then(({ error }) => {
          if (error) {
            console.error('Error saving conversation to database:', error);
          } else {
            console.log('Created new conversation in database:', newConversation.id);
          }
        });
      
      console.log('Created new conversation:', newConversation.id);
      
      // Update local state
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversation(newConversation);
      
      return newConversation;
    } catch (err) {
      console.error('Error creating conversation:', err);
      setError('Failed to create new conversation');
      
      // Fallback to local-only conversation if Supabase fails
      const fallbackConversation = createNewConversation(title);
      fallbackConversation.user_id = user.id;
      
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
        console.error('Conversation not found:', conversationId);
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
      
      // Save message to webhook_logs table
      const { error: messageError } = await supabase
        .from('webhook_logs')
        .insert([{
          id: message.id,
          payload: {
            role: message.role,
            content: message.content,
            audioUrl: message.audioUrl,
            imageUrl: message.imageUrl
          },
          source: message.role === 'user' ? 'user' : 'assistant',
          timestamp: message.timestamp,
          conversation_id: conversationId,
          user_id: user.id
        }]);
      
      if (messageError) {
        console.error('Error saving message:', messageError);
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
          console.error('Error updating conversation:', updateError);
        }
      }
    } catch (err) {
      console.error('Error adding message to conversation:', err);
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
      console.error('Error deleting conversation:', err);
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
      console.error('Error updating conversation title:', err);
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
      console.error('Error pinning conversation:', err);
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
      console.error('Error clearing conversations:', err);
      setError('Failed to clear conversations');
      
      // Fallback: create a new conversation locally
      const newConversation = createNewConversation();
      newConversation.user_id = user.id;
      
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

