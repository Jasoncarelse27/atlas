import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export type UserTier = 'free' | 'core' | 'studio';

interface UsageStats {
  messages_today: number;
  messages_this_month: number;
  last_reset_date: string;
}

interface SubscriptionProfile {
  id: string;
  subscription_tier: UserTier;
  trial_ends_at: string | null;
  subscription_status: 'active' | 'inactive' | 'cancelled';
  subscription_id: string | null;
  usage_stats: UsageStats;
  created_at: string;
  updated_at: string;
}

interface UseSubscriptionAccessParams {
  userId: string;
}

export function useSubscriptionAccess({ userId }: UseSubscriptionAccessParams) {
  const [currentTier, setCurrentTier] = useState<UserTier>('free');
  const [usageStats, setUsageStats] = useState<UsageStats>({
    messages_today: 0,
    messages_this_month: 0,
    last_reset_date: new Date().toISOString().slice(0, 7)
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user profile and usage stats
  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) return;
      
      try {
        setIsLoading(true);
        
        // Get user profile from Supabase
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.warn('Profile not found, using default free tier:', profileError.message);
          setCurrentTier('free');
        } else {
          setCurrentTier(profile.subscription_tier || 'free');
          setUsageStats({
            messages_today: 0,
            messages_this_month: 0,
            last_reset_date: new Date().toISOString().slice(0, 7)
          });
        }

        // Check if we need to reset daily/monthly counts
        await checkAndResetUsageCounts();
        
      } catch (err) {
        console.error('Failed to load subscription profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  // Check and reset usage counts if needed
  const checkAndResetUsageCounts = useCallback(async () => {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const currentDay = now.toDateString();

    // Check if we need to reset monthly count
    if (usageStats.last_reset_date !== currentMonth) {
      setUsageStats(prev => ({
        ...prev,
        messages_this_month: 0,
        last_reset_date: currentMonth
      }));
      
      // Update in database
      try {
        await supabase
          .from('user_profiles')
          .update({
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
      } catch (err) {
        console.warn('Failed to reset monthly usage count:', err);
      }
    }

    // Check if we need to reset daily count (simplified - could be more sophisticated)
    // This is a basic implementation - in production you might want to track exact dates
  }, [userId, usageStats]);

  // Check if user can send a message
  const canSendMessage = useCallback((): boolean => {
    switch (currentTier) {
      case 'free':
        return usageStats.messages_today < 15; // 15 messages per day for free tier
      case 'core':
        return true; // Unlimited for core tier
      case 'studio':
        return true; // Unlimited for studio tier
      default:
        return false;
    }
  }, [currentTier, usageStats.messages_today]);

  // Get remaining messages for today
  const getRemainingMessages = useCallback((): number => {
    switch (currentTier) {
      case 'free':
        return Math.max(0, 15 - usageStats.messages_today);
      case 'core':
        return -1; // -1 indicates unlimited
      case 'studio':
        return -1; // -1 indicates unlimited
      default:
        return 0;
    }
  }, [currentTier, usageStats.messages_today]);

  // Check if user should see upgrade prompt
  const showUpgradePrompt = useCallback((): boolean => {
    if (currentTier === 'studio') return false;
    
    // Show upgrade prompt when approaching limits
    switch (currentTier) {
      case 'free':
        return usageStats.messages_today >= 10; // Show after 10 messages (approaching 15 limit)
      case 'core':
        return false; // Core is unlimited, no upgrade prompts needed
      default:
        return false;
    }
  }, [currentTier, usageStats.messages_today]);

  // Increment message count (called after successful message send)
  const incrementMessageCount = useCallback(async () => {
    const newStats = {
      ...usageStats,
      messages_today: usageStats.messages_today + 1,
      messages_this_month: usageStats.messages_this_month + 1
    };

    setUsageStats(newStats);

    // Update in database
    try {
      await supabase
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (err) {
      console.warn('Failed to update usage stats:', err);
    }
  }, [userId, usageStats]);

  // Get tier limits
  const getTierLimits = useCallback(() => {
    switch (currentTier) {
      case 'free':
        return { daily: 15, monthly: 450, features: ['Basic AI responses', 'Text input', 'Claude Haiku'] };
      case 'core':
        return { daily: -1, monthly: -1, features: ['Advanced AI responses', 'Voice input', 'Image analysis', 'Claude Sonnet'] };
      case 'studio':
        return { daily: -1, monthly: -1, features: ['Unlimited AI responses', 'All features', 'Priority support', 'Claude Opus'] };
      default:
        return { daily: 0, monthly: 0, features: [] };
    }
  }, [currentTier]);

  return {
    // State
    currentTier,
    usageStats,
    isLoading,
    error,
    
    // Computed values
    canSendMessage: canSendMessage(),
    remainingMessages: getRemainingMessages(),
    showUpgradePrompt: showUpgradePrompt(),
    tierLimits: getTierLimits(),
    
    // Actions
    incrementMessageCount,
    
    // Utils
    checkAndResetUsageCounts
  };
}
