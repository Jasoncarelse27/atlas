import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMessageLimit, useTierAccess } from '../../../hooks/useTierAccess';
import { supabase } from '../../../lib/supabase';
import { sendMessageToSupabase } from '../../../services/chatService';
import type { Message } from '../../../types/chat';

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: string;
  createdAt: string;
}

interface UseChatReturn {
  // State
  conversation: Conversation;
  isProcessing: boolean;
  messageCount: number;
  tier: string;
  model: string;
  
  // Actions
  handleSendMessage: (message: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  deleteMessage: (id: string) => void;
  copyMessage: (content: string) => void;
  updateTitle: (title: string) => void;
}

export function useChat(userId?: string): UseChatReturn {
  const navigate = useNavigate();
  
  // Tier enforcement hooks
  const { tier, model, claudeModelName } = useTierAccess();
  const { checkAndAttemptMessage } = useMessageLimit();
  
  // State
  const [messageCount, setMessageCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversation, setConversation] = useState<Conversation>({
    id: 'default',
    title: 'Atlas AI Chat',
    messages: [
      {
        id: '1',
        role: 'assistant',
        content: 'Hello! I\'m Atlas, your AI-powered emotional intelligence companion. How can I help you today?',
        timestamp: new Date().toISOString()
      }
    ],
    lastUpdated: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });

  // Actions
  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [navigate]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (isProcessing || !message.trim()) return;
    
    // Check message limit
    const canSend = await checkAndAttemptMessage(messageCount);
    if (!canSend) {
      return; // Toast already shown by hook
    }
    
    setIsProcessing(true);
    
    try {
      // Add user message to conversation
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        lastUpdated: new Date().toISOString()
      }));

      // Get session for authentication
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      if (!accessToken) {
        throw new Error("No access token available");
      }

      // Send message using the chat service
      await sendMessageToSupabase({
        message: message,
        conversationId: conversation.id,
        accessToken: accessToken,
        onMessage: (partial: string) => {
          // Handle streaming message updates
          console.log("Partial message:", partial);
        },
        onComplete: (full: string) => {
          // Add assistant response to conversation
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: full,
            timestamp: new Date().toISOString()
          };
          
          setConversation(prev => ({
            ...prev,
            messages: [...prev.messages, assistantMessage],
            lastUpdated: new Date().toISOString()
          }));
          
          // Increment message count
          setMessageCount(prev => prev + 1);
        },
        onError: (error: string) => {
          console.error("Message error:", error);
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Sorry, there was an error processing your message. Please try again.',
            timestamp: new Date().toISOString()
          };
          
          setConversation(prev => ({
            ...prev,
            messages: [...prev.messages, errorMessage],
            lastUpdated: new Date().toISOString()
          }));
        }
      });
      
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, there was an unexpected error. Please try again.',
        timestamp: new Date().toISOString()
      };
      
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        lastUpdated: new Date().toISOString()
      }));
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, messageCount, checkAndAttemptMessage, conversation.id]);

  const deleteMessage = useCallback((id: string) => {
    setConversation(prev => ({
      ...prev,
      messages: prev.messages.filter(msg => msg.id !== id)
    }));
  }, []);

  const copyMessage = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  const updateTitle = useCallback((title: string) => {
    setConversation(prev => ({ ...prev, title }));
  }, []);

  return {
    // State
    conversation,
    isProcessing,
    messageCount,
    tier,
    model,
    
    // Actions
    handleSendMessage,
    handleLogout,
    deleteMessage,
    copyMessage,
    updateTitle
  };
}
