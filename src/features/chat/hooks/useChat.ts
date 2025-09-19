import { useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useMessageLimit, useTierAccess } from '../../../hooks/useTierAccess';
import { useTierMiddleware } from '../../../hooks/useTierMiddleware';
import { supabase } from '../../../lib/supabase';
import type { Message } from '../../../types/chat';
import type { Tier } from '../../../types/tier';

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
  
  // Upgrade modal
  upgradeModalVisible: boolean;
  setUpgradeModalVisible: (visible: boolean) => void;
  upgradeReason: string;
  handleUpgrade: (tier: Tier) => void;
}

export function useChat(userId?: string): UseChatReturn {
  const navigate = useNavigate();
  
  // Tier enforcement hooks
  const { tier, model, claudeModelName } = useTierAccess();
  const { checkAndAttemptMessage } = useMessageLimit();
  
  // New middleware integration
  const {
    sendMessage: sendMessageMiddleware,
    isLoading: middlewareLoading,
    upgradeModalVisible,
    setUpgradeModalVisible,
    upgradeReason
  } = useTierMiddleware();
  
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
    if (isProcessing || middlewareLoading || !message.trim() || !userId) return;
    
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

      // Send message through middleware
      const response = await sendMessageMiddleware(userId, message);
      
      if (!response.success) {
        if (response.error?.type === 'daily_limit') {
          // Upgrade modal will be shown by the middleware hook
          toast.error(response.error.message || 'Daily limit reached. Please upgrade to continue.');
          return;
        }
        
        if (response.error?.type === 'budget_limit') {
          // Upgrade modal will be shown by the middleware hook
          toast.error(response.error.message || 'Budget limit reached. Please upgrade to continue.');
          return;
        }
        
        if (response.error?.type === 'network') {
          toast.error('Network error. Please check your connection and try again.');
          return;
        }
        
        toast.error(response.error?.message || 'Failed to send message. Please try again.');
        return;
      }

      // Add assistant response to conversation
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data?.response || 'I received your message, but there was an issue generating a response.',
        timestamp: new Date().toISOString()
      };
      
      setConversation(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        lastUpdated: new Date().toISOString()
      }));

      // Update message count
      setMessageCount(prev => prev + 1);
      
      // Show success indicators if available
      if (response.data?.metadata) {
        const metadata = response.data.metadata;
        
        // Show tier-specific success messages
        if (metadata.tier === 'studio') {
          toast.success(`🚀 Studio response with ${metadata.model}`, { duration: 2000 });
        } else if (metadata.tier === 'core') {
          toast.success(`🌱 Core response with ${metadata.model}`, { duration: 2000 });
        }
        
        // Show usage info for free tier
        if (metadata.tier === 'free' && metadata.dailyUsage) {
          const remaining = metadata.dailyUsage.limit - metadata.dailyUsage.count;
          if (remaining <= 3 && remaining > 0) {
            toast(`⚠️ ${remaining} free messages remaining today`, {
              duration: 4000,
              icon: '⚠️'
            });
          }
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [userId, sendMessageMiddleware, isProcessing, middlewareLoading, conversation.id]);

  // Handle upgrade flow
  const handleUpgrade = useCallback(async (selectedTier: Tier) => {
    try {
      // Here you would integrate with Paddle or your payment processor
      console.log('Upgrade to:', selectedTier);
      
      // For now, just close the modal
      setUpgradeModalVisible(false);
      
      // You could show a success message
      toast.success(`Upgrade to ${selectedTier} initiated!`);
      
    } catch (error) {
      console.error('Upgrade error:', error);
      toast.error('Failed to initiate upgrade. Please try again.');
    }
  }, [setUpgradeModalVisible]);

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
    isProcessing: isProcessing || middlewareLoading,
    messageCount,
    tier,
    model,
    
    // Actions
    handleSendMessage,
    handleLogout,
    deleteMessage,
    copyMessage,
    updateTitle,
    
    // Upgrade modal
    upgradeModalVisible,
    setUpgradeModalVisible,
    upgradeReason,
    handleUpgrade
  };
}
