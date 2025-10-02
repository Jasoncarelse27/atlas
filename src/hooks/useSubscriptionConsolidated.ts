import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type UserTier = 'free' | 'core' | 'studio';

interface UsageStats {
  messages_today: number;
  messages_this_month: number;
  last_reset_date: string;
}

interface SubscriptionProfile {
  id: string;
  email: string | null;
  subscription_tier: UserTier;
  subscription_status: 'active' | 'inactive' | 'cancelled' | 'trialing';
  subscription_id: string | null;
  trial_ends_at: string | null;
  first_payment: string | null;
  last_reset_date: string | null;
  usage_stats: UsageStats;
  created_at: string;
  updated_at: string;
}

interface TierLimits {
  dailyMessages: number;
  monthlyMessages: number;
  audioMinutes: number;
  imageUploads: number;
}

/**
 * Consolidated subscription hook that combines the best features from all subscription hooks
 * Provides real-time updates, proper error handling, and comprehensive tier management
 */
export function useSubscription(userId?: string) {
  const [profile, setProfile] = useState<SubscriptionProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get tier from profile
  const tier: UserTier = profile?.subscription_tier || 'free';
  
  // Calculate tier limits
  const tierLimits: TierLimits = {
    dailyMessages: tier === 'free' ? 15 : -1, // -1 means unlimited
    monthlyMessages: tier === 'free' ? 50 : -1,
    audioMinutes: tier === 'core' || tier === 'studio' ? 60 : 0,
    imageUploads: tier === 'core' || tier === 'studio' ? 10 : 0,
  };

  // Check if user can send messages
  const canSendMessage = (): boolean => {
    if (tier === 'core' || tier === 'studio') return true;
    
    const today = new Date().toISOString().slice(0, 10);
    const lastReset = profile?.usage_stats?.last_reset_date?.slice(0, 10);
    
    // Reset daily count if it's a new day
    if (lastReset !== today) {
      return true; // Fresh day, can send messages
    }
    
    const messagesToday = profile?.usage_stats?.messages_today || 0;
    return messagesToday < tierLimits.dailyMessages;
  };

  // Get remaining messages for display
  const remainingMessages = (): number => {
    if (tier === 'core' || tier === 'studio') return -1; // Unlimited
    
    const today = new Date().toISOString().slice(0, 10);
    const lastReset = profile?.usage_stats?.last_reset_date?.slice(0, 10);
    
    if (lastReset !== today) {
      return tierLimits.dailyMessages; // Fresh day
    }
    
    const messagesToday = profile?.usage_stats?.messages_today || 0;
    return Math.max(0, tierLimits.dailyMessages - messagesToday);
  };

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log(`📊 [useSubscription] Fetching profile for userId: ${userId}`);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ [useSubscription] Profile fetch error:', error);
        setError(error.message);
        return;
      }

      if (data) {
        console.log('✅ [useSubscription] Profile fetched:', data);
        setProfile(data);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('❌ [useSubscription] Unexpected error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Real-time updates and polling fallback
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchProfile();

    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    const channel = supabase
      .channel(`profiles-changes-${userId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles', 
          filter: `id=eq.${userId}` 
        },
        (payload) => {
          console.log('🔄 [useSubscription] Realtime profile update:', payload.new);
          if (payload.new) {
            setProfile(payload.new as SubscriptionProfile);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [useSubscription] Subscribed to profile realtime updates');
          // Clear any existing polling when real-time is working
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('⚠️ [useSubscription] Realtime subscription closed, falling back to polling');
          // Start polling fallback
          if (!pollingInterval) {
            pollingInterval = setInterval(() => {
              console.log('🔄 [useSubscription] Polling for profile updates...');
              fetchProfile();
            }, 60000); // Poll every 60 seconds
          }
        }
      });

    return () => { 
      supabase.removeChannel(channel);
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [userId, fetchProfile]);

  // Force refresh function
  const forceRefresh = useCallback(async () => {
    console.log('🔄 [useSubscription] Force refreshing profile...');
    await fetchProfile();
  }, [fetchProfile]);

  return {
    // Profile data
    profile,
    tier,
    tierLimits,
    
    // Status
    loading,
    error,
    
    // Computed values
    canSendMessage: canSendMessage(),
    remainingMessages: remainingMessages(),
    
    // Actions
    refresh: fetchProfile,
    forceRefresh,
  };
}

/**
 * Hook for checking if user can perform specific actions based on tier
 * This replaces the useTierAccess hook with subscription integration
 */
export function useTierAccess(userId?: string) {
  const { tier, tierLimits, canSendMessage, remainingMessages } = useSubscription(userId);

  const canUseFeature = (feature: string): boolean => {
    switch (feature) {
      case 'voice':
      case 'audio':
        return tier === 'core' || tier === 'studio';
      case 'image':
      case 'camera':
        return tier === 'core' || tier === 'studio';
      case 'unlimited_messages':
        return tier === 'core' || tier === 'studio';
      case 'priority_support':
        return tier === 'studio';
      default:
        return true; // Basic features available to all tiers
    }
  };

  const getFeatureLimit = (feature: string): number | null => {
    switch (feature) {
      case 'daily_messages':
        return tierLimits.dailyMessages === -1 ? null : tierLimits.dailyMessages;
      case 'monthly_messages':
        return tierLimits.monthlyMessages === -1 ? null : tierLimits.monthlyMessages;
      case 'audio_minutes':
        return tierLimits.audioMinutes;
      case 'image_uploads':
        return tierLimits.imageUploads;
      default:
        return null;
    }
  };

  const hasAccess = (feature: 'file' | 'image' | 'camera' | 'audio'): boolean => {
    return canUseFeature(feature);
  };

  return {
    tier,
    tierLimits,
    canSendMessage,
    remainingMessages,
    canUseFeature,
    getFeatureLimit,
    hasAccess,
  };
}
