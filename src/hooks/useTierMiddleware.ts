import { useCallback, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import { getApiEndpoint } from '../utils/apiClient';
import { useSupabaseAuth } from './useSupabaseAuth';
import { useTierAccess } from './useTierAccess';

interface MiddlewareResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: {
    type: 'daily_limit' | 'budget_limit' | 'network' | 'unknown';
    message: string;
    metadata?: Record<string, unknown>;
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
      // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
      const apiEndpoint = getApiEndpoint('/message');
      
      // ✅ FIXED: Use centralized auth helper with automatic refresh
      const { getAuthTokenOrThrow } = await import('../utils/getAuthToken');
      const { handle401Auth } = await import('../utils/handle401Auth');
      
      const token = await getAuthTokenOrThrow('Authentication required. Please sign in again.');

      // Create original request function for retry
      const makeRequest = async (): Promise<Response> => {
        const currentToken = await getAuthTokenOrThrow('Authentication required. Please sign in again.');
        return fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
          },
          body: JSON.stringify({
            userId,
            message,
            tier,
            ...(conversationId && { conversationId }),
            promptType
          })
        });
      };

      let response = await makeRequest();

      // ✅ FIXED: Handle 401 with automatic token refresh
      if (response.status === 401) {
        try {
          response = await handle401Auth({
            response,
            originalRequest: makeRequest,
            preventRedirect: false
          });
        } catch (error) {
          logger.error('[useTierMiddleware] 401 handling failed:', error);
          throw error;
        }
      }

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
        // Cache savings tracked in metadata
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
      // Intentionally empty - error handling not required
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
