// Atlas Usage Management Hook
// Central integration point for all revenue protection features

import { useCallback, useEffect, useState } from 'react';
import { enhancedAIService, type AIRequest, type AIResponse } from '../services/enhancedAIService';
import { usageTrackingService } from '../services/usageTrackingService';
import type { Tier } from '../types/tier';
import { useSupabaseAuth } from './useSupabaseAuth';
import { useTierAccess } from './useTierAccess';

export interface UsageManagementState {
  // Current status
  tier: Tier;
  conversationsToday: number;
  remainingConversations: number | 'unlimited';
  isMaintenanceMode: boolean;
  budgetStatus: 'ok' | 'warning' | 'critical';
  
  // Actions
  canStartConversation: () => Promise<boolean>;
  sendMessage: (message: string, conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<AIResponse>;
  showUpgradeModal: (reason: string) => void;
  
  // State
  isLoading: boolean;
  error: string | null;
}

export function useAtlasUsageManagement(): UsageManagementState {
  const { user } = useSupabaseAuth();
  const tierAccess = useTierAccess();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // Reset error when user changes
  useEffect(() => {
    setError(null);
  }, [user?.id]);

  /**
   * Check if user can start a new conversation
   */
  const canStartConversation = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      setError('Please log in to continue');
      return false;
    }

    try {
      setError(null);
      const canStart = await tierAccess.canStartConversation();
      
      if (!canStart) {
        // Error messages are handled by the tierAccess hook via toasts
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Failed to check conversation eligibility:', err);
      setError('Unable to verify usage limits. Please try again.');
      return false;
    }
  }, [user?.id, tierAccess]);

  /**
   * Send message with full revenue protection
   */
  const sendMessage = useCallback(async (
    message: string, 
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<AIResponse> => {
    if (!user?.id) {
      return {
        success: false,
        error: 'Please log in to send messages'
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if user can start conversation
      const canStart = await canStartConversation();
      if (!canStart) {
        return {
          success: false,
          error: 'Conversation limit reached'
        };
      }

      // Prepare AI request
      const request: AIRequest = {
        userId: user.id,
        tier: tierAccess.tier,
        message,
        conversationHistory: history || conversationHistory,
        conversationId: `conv_${Date.now()}` // Simple conversation ID
      };

      // Send to enhanced AI service
      const response = await enhancedAIService.processRequest(request);

      // Update conversation history if successful
      if (response.success && response.response) {
        setConversationHistory(prev => [
          ...prev,
          { role: 'user', content: message },
          { role: 'assistant', content: response.response! }
        ]);
      }

      // Handle specific error cases
      if (!response.success) {
        if (response.upgradeRequired) {
          tierAccess.showUpgradeModal(response.reason || 'general');
        }
        
        setError(response.error || 'Failed to send message');
      }

      return response;

    } catch (err) {
      console.error('Message sending failed:', err);
      const errorMessage = 'Failed to send message. Please try again.';
      setError(errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, tierAccess, conversationHistory, canStartConversation]);

  /**
   * Show upgrade modal with context
   */
  const showUpgradeModal = useCallback((reason: string) => {
    tierAccess.showUpgradeModal(reason);
    
    // Log upgrade intent for analytics
    tierAccess.logFeatureAttempt(`upgrade_modal_shown_${reason}`, true);
  }, [tierAccess]);

  /**
   * Clear conversation history (for fresh sessions)
   */
  const clearConversationHistory = useCallback(() => {
    setConversationHistory([]);
  }, []);

  /**
   * Get usage statistics
   */
  const getUsageStats = useCallback(async () => {
    if (!user?.id) return null;
    
    try {
      return await usageTrackingService.getUsageStats(user.id);
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return null;
    }
  }, [user?.id]);

  return {
    // Current status
    tier: tierAccess.tier,
    conversationsToday: tierAccess.conversationsToday,
    remainingConversations: tierAccess.remainingConversations,
    isMaintenanceMode: tierAccess.isMaintenanceMode,
    budgetStatus: tierAccess.budgetStatus,
    
    // Actions
    canStartConversation,
    sendMessage,
    showUpgradeModal,
    
    // Additional utilities
    clearConversationHistory,
    getUsageStats,
    
    // State
    isLoading,
    error
  };
}

/**
 * Hook for monitoring service health
 */
export function useAtlasServiceHealth() {
  const [health, setHealth] = useState<{
    status: 'healthy' | 'degraded' | 'maintenance';
    cacheHitRate: number;
    dailyBudgetUsed: number;
    activeUsers: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const healthStatus = await enhancedAIService.getServiceHealth();
        setHealth(healthStatus);
      } catch (error) {
        console.error('Health check failed:', error);
        setHealth({
          status: 'degraded',
          cacheHitRate: 0,
          dailyBudgetUsed: 0,
          activeUsers: 0
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkHealth();
    
    // Check health every 5 minutes
    const interval = setInterval(checkHealth, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return { health, isLoading };
}
