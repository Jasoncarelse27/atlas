import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuthJSON } from '../services/fetchWithAuth';

export interface UsageStats {
  tier: 'free' | 'core' | 'studio';
  dailyMessagesUsed: number;
  dailyMessagesLimit: number;
  monthlyBudgetUsed: number;
  monthlyBudgetLimit: number;
  lastUpdated: string;
}

export interface UsageIndicatorState {
  usage: UsageStats | null;
  loading: boolean;
  error: string | null;
  remainingMessages: number;
  isUnlimited: boolean;
}

const TIER_LIMITS = {
  free: { dailyMessages: 15, monthlyBudget: 0 },
  core: { dailyMessages: -1, monthlyBudget: 20 },
  studio: { dailyMessages: -1, monthlyBudget: 200 },
} as const;

/**
 * Hook to track and display user usage statistics
 * Automatically refreshes after message sends and provides real-time updates
 */
export function useUsageIndicator() {
  const [state, setState] = useState<UsageIndicatorState>({
    usage: null,
    loading: true,
    error: null,
    remainingMessages: 0,
    isUnlimited: false,
  });

  /**
   * Fetch current usage from the backend
   */
  const fetchUsage = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      // For development, call admin endpoint directly without auth
      const usage = await fetchWithAuthJSON(`${API_URL}/admin/usage`);

      const tier = usage.tier || 'free';
      const dailyUsed = usage.dailyMessagesUsed || 0;
      const dailyLimit = usage.dailyMessagesLimit || TIER_LIMITS[tier].dailyMessages;
      
      const remainingMessages = dailyLimit === -1 ? -1 : Math.max(0, dailyLimit - dailyUsed);
      const isUnlimited = dailyLimit === -1;

      setState({
        usage,
        loading: false,
        error: null,
        remainingMessages,
        isUnlimited,
      });

      // Debug logging in development
      if (import.meta.env.DEV) {
        console.log('[useUsageIndicator] Usage updated:', {
          tier,
          dailyUsed,
          dailyLimit,
          remainingMessages,
          isUnlimited,
        });
      }
    } catch (error: any) {
      console.error('[useUsageIndicator] Error fetching usage:', error);
      
      // Set fallback state for free tier if API fails
      setState({
        usage: null,
        loading: false,
        error: error.message || 'Failed to fetch usage',
        remainingMessages: 15, // Default to free tier limit
        isUnlimited: false,
      });
    }
  }, []);

  /**
   * Refresh usage (called after sending messages)
   */
  const refreshUsage = useCallback(() => {
    fetchUsage();
  }, [fetchUsage]);

  /**
   * Get display text for the usage indicator
   */
  const getDisplayText = useCallback(() => {
    const { usage, remainingMessages, isUnlimited, loading, error } = state;

    if (loading) {
      return 'Loading usage...';
    }

    if (error) {
      return '⚠️ Usage unavailable';
    }

    if (!usage) {
      return '⚠️ 15 messages remaining today';
    }

    const { tier } = usage;

    if (isUnlimited) {
      switch (tier) {
        case 'core':
          return '🌱 Core (unlimited messages)';
        case 'studio':
          return '🚀 Studio (unlimited messages)';
        default:
          return '🌱 Unlimited messages';
      }
    }

    if (remainingMessages <= 3 && remainingMessages > 0) {
      return `⚠️ ${remainingMessages} messages remaining today`;
    } else if (remainingMessages === 0) {
      return '⚠️ Daily limit reached';
    } else {
      return `${remainingMessages} messages remaining today`;
    }
  }, [state]);

  /**
   * Get CSS classes for styling based on usage state
   */
  const getDisplayClasses = useCallback(() => {
    const { usage, remainingMessages, isUnlimited, loading, error } = state;

    if (loading) {
      return 'text-gray-500';
    }

    if (error) {
      return 'text-yellow-600';
    }

    if (isUnlimited) {
      return 'text-green-600 font-medium';
    }

    if (remainingMessages <= 3 && remainingMessages > 0) {
      return 'text-yellow-600 font-medium';
    } else if (remainingMessages === 0) {
      return 'text-red-600 font-medium';
    } else {
      return 'text-gray-600';
    }
  }, [state]);

  /**
   * Check if user should see upgrade prompt
   */
  const shouldShowUpgradePrompt = useCallback(() => {
    const { usage, remainingMessages, isUnlimited, loading, error } = state;
    
    if (isUnlimited || loading || error) {
      return false;
    }

    // Show upgrade prompt if less than 3 messages remaining or at limit
    return remainingMessages <= 3;
  }, [state]);

  // Fetch usage on mount
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Set up periodic refresh (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(fetchUsage, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  return {
    ...state,
    fetchUsage,
    refreshUsage,
    getDisplayText,
    getDisplayClasses,
    shouldShowUpgradePrompt,
  };
}
