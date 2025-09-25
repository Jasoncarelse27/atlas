import { useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useSupabaseAuth } from './useSupabaseAuth';
import { useTierAccess } from './useTierAccess';

interface MiddlewareResponse {
  success: boolean;
  data?: any;
  error?: {
    type: 'daily_limit' | 'budget_limit' | 'network' | 'unknown';
    message: string;
    metadata?: any;
  };
}

interface UseTierMiddlewareReturn {
  sendMessage: (userId: string, message: string, conversationId?: string, promptType?: string) => Promise<MiddlewareResponse>;
  isLoading: boolean;
  showUpgradeModal: () => void;
  upgradeModalVisible: boolean;
  setUpgradeModalVisible: (visible: boolean) => void;
  upgradeReason: string;
}

export function useTierMiddleware(): UseTierMiddlewareReturn {
  const { user } = useSupabaseAuth();
  const { tier } = useTierAccess(user?.id);
  const [isLoading, setIsLoading] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');

  const showUpgradeModal = useCallback((reason = 'upgrade') => {
    setUpgradeReason(reason);
    setUpgradeModalVisible(true);
  }, []);

  const sendMessage = useCallback(async (
    userId: string, 
    message: string, 
    conversationId?: string,
    promptType?: string
  ): Promise<MiddlewareResponse> => {
    setIsLoading(true);
    
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      
      // Get Supabase session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${baseUrl}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          userId,
          message,
          tier,
          ...(conversationId && { conversationId }),
          promptType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          const errorCode = data.error || data.code || 'UNKNOWN_LIMIT';
          
          if (errorCode === 'DAILY_LIMIT_EXCEEDED') {
            showUpgradeModal('daily_limit');
            toast.error(data.message || 'Daily limit reached. Upgrade to continue!', {
              duration: 5000,
              icon: '⚠️'
            });
            return {
              success: false,
              error: {
                type: 'daily_limit',
                message: data.message,
                metadata: {
                  limit: data.limit,
                  used: data.used,
                  upgradeUrl: data.upgradeUrl
                }
              }
            };
          }
          
          if (errorCode === 'BUDGET_LIMIT_EXCEEDED') {
            showUpgradeModal('budget_limit');
            toast.error(data.message || 'Budget limit reached. Upgrade for more capacity!', {
              duration: 5000,
              icon: '💰'
            });
            return {
              success: false,
              error: {
                type: 'budget_limit',
                message: data.message,
                metadata: {
                  budgetUsed: data.budgetUsed,
                  budgetLimit: data.budgetLimit,
                  upgradeUrl: data.upgradeUrl
                }
              }
            };
          }
          
          // Generic 429 handling
          showUpgradeModal('unknown');
          return {
            success: false,
            error: {
              type: 'unknown',
              message: data.message || 'Rate limit exceeded'
            }
          };
        }
        
        if (response.status === 401) {
          toast.error('Please log in to send messages', { icon: '🔐' });
          return {
            success: false,
            error: {
              type: 'unauthorized',
              message: data.message || 'Authentication required'
            }
          };
        }
        
        return {
          success: false,
          error: {
            type: 'unknown',
            message: data.error || 'Failed to send message'
          }
        };
      }

      if (!data.success) {
        return {
          success: false,
          error: {
            type: 'unknown',
            message: 'Failed to send message to server'
          }
        };
      }

      // Check for priority processing or high usage
      if (data.metadata?.budgetStatus?.used && data.metadata?.budgetStatus?.limit) {
        const usagePercent = (data.metadata.budgetStatus.used / data.metadata.budgetStatus.limit) * 100;
        
        if (usagePercent > 90) {
          toast(`⚡ High usage detected (${usagePercent.toFixed(0)}%) - you're prioritized as a ${tier} user`, {
            duration: 4000,
            icon: '⚡',
          });
        }
      }

      // Check for cache hits and show savings
      if (data.metadata?.cache?.hit && data.metadata?.cache?.savings) {
        console.log(`💰 Cache hit! Saved $${data.metadata.cache.savings.toFixed(4)} on this request`);
      }

      return {
        success: true,
        data: {
          response: data.response,
          conversationId: data.conversationId,
          metadata: data.metadata
        }
      };

    } catch (error) {
      console.error('Network error sending message:', error);
      return {
        success: false,
        error: {
          type: 'network',
          message: error instanceof Error ? error.message : 'Network error. Please try again.'
        }
      };
    } finally {
      setIsLoading(false);
    }
  }, [tier, showUpgradeModal]);

  return {
    sendMessage,
    isLoading,
    showUpgradeModal,
    upgradeModalVisible,
    setUpgradeModalVisible,
    upgradeReason
  };
}
