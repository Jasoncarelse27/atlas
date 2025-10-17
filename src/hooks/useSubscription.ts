import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { subscriptionApi } from '../services/subscriptionApi';
import { extractMemoryFromMessage, mergeMemory } from '../utils/memoryExtractor';
import { logger } from '../lib/logger';

export type UserTier = 'free' | 'core' | 'studio';

interface UsageStats {
  messages_today: number;
  messages_this_month: number;
  last_reset_date: string;
}

interface UserMemory {
  name?: string;
  preferences?: string[];
  interests?: string[];
  context?: string;
  last_updated?: string;
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
  user_context?: UserMemory; // New memory field
  personal_details?: UserMemory; // New personal details field
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

  // Get tier from profile - wait for actual data, don't hardcode fallbacks
  const tier: UserTier = profile?.subscription_tier || 'free'; // Only default to free when no profile loaded
  
  // Log tier resolution for debugging - only log when profile is loaded
  useEffect(() => {
    if (userId && profile) {
      logger.debug(`✅ [useSubscription] User ${userId} tier resolved: ${tier} (from profile: ${profile.subscription_tier})`);
    }
    // Removed misleading "no profile" warning - it triggers before async fetch completes
  }, [userId, tier, profile]);
  
  // Calculate tier limits
  const tierLimits: TierLimits = {
    dailyMessages: tier === 'free' ? 15 : -1, // -1 means unlimited (for daily tracking)
    monthlyMessages: tier === 'free' ? 15 : -1, // 15 messages per month for Free tier
    audioMinutes: tier === 'core' || tier === 'studio' ? 60 : 0,
    imageUploads: tier === 'core' || tier === 'studio' ? 10 : 0,
  };

  // Check if user can send messages (monthly limit for Free tier)
  const canSendMessage = (): boolean => {
    if (tier === 'core' || tier === 'studio') return true;
    
    // Get current month in YYYY-MM format
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const lastResetMonth = profile?.last_reset_date?.slice(0, 7);
    
    // Reset monthly count if it's a new month
    if (lastResetMonth !== currentMonth) {
      return true; // Fresh month, can send messages
    }
    
    const messagesThisMonth = profile?.usage_stats?.messages_this_month || 0;
    return messagesThisMonth < tierLimits.monthlyMessages;
  };

  // Get remaining messages for display (monthly for Free tier)
  const remainingMessages = (): number => {
    if (tier === 'core' || tier === 'studio') return -1; // Unlimited
    
    // Get current month in YYYY-MM format
    // const now = new Date();
    // const currentMonth = now.toISOString().slice(0, 7);
    // const lastResetMonth = profile?.last_reset_date?.slice(0, 7);
    
    // Calculate remaining messages for current month
    const messagesThisMonth = profile?.usage_stats?.messages_this_month || 0;
    const remaining = Math.max(0, tierLimits.monthlyMessages - messagesThisMonth);
    return remaining;
  };

  // Add debounce mechanism to prevent excessive API calls
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const FETCH_DEBOUNCE_MS = 5000; // 5 seconds debounce

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // 🎯 FUTURE-PROOF FIX: Skip debounce for force refresh
    const now = Date.now();
    const skipDebounce = (window as any).__skipDebounce || false;
    if (!skipDebounce && now - lastFetchTime < FETCH_DEBOUNCE_MS) {
      return;
    }
    setLastFetchTime(now);
    (window as any).__skipDebounce = false;

    try {
      setLoading(true);
      setError(null);
      
      
      // Get access token for backend API calls
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token;
      
      if (!accessToken) {
        // Fallback to direct Supabase call
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          setError(error.message);
          return;
        }

        if (data) {
          setProfile(data);
        }
        return;
      }

      // Use backend API (same as useSupabaseAuth)
      const profile = await subscriptionApi.getUserProfile(userId, accessToken);
      
      if (profile) {
        logger.debug(`✅ [useSubscription] Profile fetched via backend API: ${profile.subscription_tier}`);
        setProfile(profile as any);
      } else {
        
        // 🎯 FUTURE-PROOF FIX: Fallback to direct Supabase call if backend API fails
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (data) {
          logger.debug(`✅ [useSubscription] Profile fetched via direct Supabase: ${(data as any).subscription_tier}`);
          setProfile(data as any);
        } else {
          setError('No profile found');
        }
      }
    } catch (err) {
      // Intentionally empty - error handling not required
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [userId, lastFetchTime]);

  // Real-time updates and polling fallback
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Check if we already have a subscription for this user
    const subscriptionKey = `realtime-sub-${userId}`;
    if (sessionStorage.getItem(subscriptionKey)) {
      return;
    }

    // Initial fetch
    fetchProfile();

    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`profiles-changes-${userId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: userId }
        }
      })
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles', 
          filter: `id=eq.${userId}` 
        },
        (payload) => {
          if (payload.new) {
            setProfile(payload.new as SubscriptionProfile);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('✅ [useSubscription] Subscribed to profile realtime updates');
          // Mark subscription as active
          sessionStorage.setItem(subscriptionKey, 'active');
          // Clear any existing polling when real-time is working
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // Realtime connection issue - only log in development
          if (process.env.NODE_ENV === 'development') {
            // Logged in development only
          }
          // Start polling fallback with faster interval for better tier sync
          if (!pollingInterval) {
            pollingInterval = setInterval(() => {
              fetchProfile(); // Remove logging to reduce spam
            }, 10000); // 🎯 FUTURE-PROOF FIX: Poll every 10 seconds for faster tier updates
          }
          // Retry realtime connection after 30 seconds
          if (!retryTimeout) {
            retryTimeout = setTimeout(() => {
              // The effect will re-run and create a new subscription
            }, 30000);
          }
        } else if (status === 'TIMED_OUT') {
          // Start polling fallback with faster interval
          if (!pollingInterval) {
            pollingInterval = setInterval(() => {
              fetchProfile();
            }, 10000); // 🎯 FUTURE-PROOF FIX: Poll every 10 seconds for faster tier updates
          }
          // Retry realtime connection after 30 seconds
          if (!retryTimeout) {
            retryTimeout = setTimeout(() => {
              // The effect will re-run and create a new subscription
            }, 30000);
          }
        }
      });

    return () => { 
      supabase.removeChannel(channel);
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      // Clear subscription flag on cleanup
      sessionStorage.removeItem(subscriptionKey);
    };
  }, [userId, fetchProfile]);

  // Force refresh function - clears cache for immediate update
  const forceRefresh = useCallback(async () => {
    // 🎯 FUTURE-PROOF FIX: Clear cache before fetching to ensure fresh data
    if (userId) {
      subscriptionApi.clearUserCache(userId);
      (window as any).__skipDebounce = true; // Skip debounce for immediate refresh
    }
    await fetchProfile();
  }, [fetchProfile, userId]);

  // Memory functions
  const updateMemory = useCallback(async (message: string) => {
    // Memory update - only log in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('🧠 [updateMemory] Called with message:', message);
      logger.debug('🧠 [updateMemory] userId:', userId, 'profile:', !!profile);
    }
    
    if (!userId || !profile) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('🧠 [updateMemory] Skipping - missing userId or profile');
      }
      return;
    }
    
    try {
      const extractedMemory = extractMemoryFromMessage(message);
      if (process.env.NODE_ENV === 'development') {
        logger.debug('🧠 [updateMemory] Extracted memory:', extractedMemory);
      }
      
      if (!extractedMemory.name && !extractedMemory.context) {
        if (process.env.NODE_ENV === 'development') {
          logger.debug('🧠 [updateMemory] No memory to extract');
        }
        return; // Nothing to update
      }
      
      const currentMemory = profile.user_context || {};
      if (process.env.NODE_ENV === 'development') {
        logger.debug('🧠 [updateMemory] Current memory:', currentMemory);
      }
      
      const mergedMemory = mergeMemory(currentMemory, extractedMemory);
      if (process.env.NODE_ENV === 'development') {
        logger.debug('🧠 [updateMemory] Merged memory:', mergedMemory);
      }
      
      const { error } = await (supabase.from('profiles') as any).update({
        user_context: mergedMemory,
        updated_at: new Date().toISOString()
      }).eq('id', userId);
      
      if (error) {
        // Update error logged elsewhere
      } else {
        logger.debug('✅ Memory updated successfully:', mergedMemory);
        // Refresh profile to get updated data
        await fetchProfile();
        logger.debug('✅ Profile refreshed with updated memory');
      }
    } catch (error) {
      // Intentionally empty - error handling not required
    }
  }, [userId, profile, fetchProfile]);

  const getUserMemory = useCallback(() => {
    return profile?.user_context || {};
  }, [profile]);

  const getPersonalizedPrompt = useCallback((basePrompt: string) => {
    const memory = getUserMemory();
    if (!memory.name && !memory.context) return basePrompt;
    
    let personalizedPrompt = basePrompt;
    
    if (memory.name) {
      personalizedPrompt += `\n\nUser's name: ${memory.name}`;
    }
    
    if (memory.context) {
      personalizedPrompt += `\n\nUser context: ${memory.context}`;
    }
    
    personalizedPrompt += '\n\nUse this information to provide more personalized and context-aware responses.';
    
    return personalizedPrompt;
  }, [getUserMemory]);

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
    remainingMessages: remainingMessages(), // Already called, returns number
    
    // Memory functions
    updateMemory,
    getUserMemory,
    getPersonalizedPrompt,
    
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
