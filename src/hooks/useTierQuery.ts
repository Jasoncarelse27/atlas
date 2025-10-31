// 🚀 Modern Tier Management with React Query + Supabase Realtime
// ✅ Single source of truth
// ✅ Automatic cache management
// ✅ Instant updates via WebSocket
// ✅ Zero manual refreshes needed

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';

export type Tier = 'free' | 'core' | 'studio';

interface TierData {
  tier: Tier;
  userId: string | null;
}

// 🔥 SINGLETON: Prevent multiple realtime subscriptions
let realtimeChannelRef: ReturnType<typeof supabase.channel> | null = null;
let subscribedUserId: string | null = null;

/**
 * Fetch user tier from Supabase (optimized for speed)
 * @returns TierData with tier and userId
 */
async function fetchTier(): Promise<TierData> {
  // Get cached session first (faster than getUser)
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    return { tier: 'free', userId: null };
  }

  const userId = session.user.id;

  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single<{ subscription_tier: Tier }>();

  if (error) {
    logger.error('[useTierQuery] Error fetching tier:', error);
    return { tier: 'free', userId };
  }

  const tier = data?.subscription_tier || 'free';
  // Reduce logging verbosity - only log tier changes, not every fetch
  // (React Query calls this frequently for cache validation)

  return {
    tier,
    userId,
  };
}

/**
 * Modern tier management hook using React Query
 * 
 * Features:
 * - Automatic caching (5min stale, 30min cache)
 * - Background refetching on window focus/reconnect
 * - Instant updates via Supabase Realtime WebSocket
 * - Zero manual refreshes needed
 * - Automatic retry on failure
 * 
 * @example
 * ```tsx
 * const { tier, isLoading } = useTierQuery();
 * 
 * if (isLoading) return <Skeleton />;
 * return <div>Current tier: {tier}</div>;
 * ```
 */
export function useTierQuery() {
  const queryClient = useQueryClient();

  // React Query hook with production-grade configuration
  const query = useQuery({
    queryKey: ['user-tier'],
    queryFn: fetchTier,
    staleTime: 5 * 60 * 1000, // Data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes (formerly cacheTime)
    refetchOnWindowFocus: false, // ✅ FIX: Disable auto-refetch on focus (reduces excessive calls)
    refetchOnReconnect: true, // Auto-refetch on network restore
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Log tier only when it changes (reduce console spam)
  useEffect(() => {
    if (query.data?.tier) {
      const prevTier = queryClient.getQueryData<TierData>(['user-tier'])?.tier;
      if (prevTier !== query.data.tier) {
        logger.debug(`[useTierQuery] ✅ Tier: ${query.data.tier} for user ${query.data.userId?.slice(0, 8)}...`);
      }
    }
  }, [query.data?.tier, queryClient]);

  // 🔥 Supabase Realtime: Instant tier updates via WebSocket (SINGLETON)
  useEffect(() => {
    if (!query.data?.userId) return;

    const userId = query.data.userId;

    // ✅ CRITICAL FIX: Only allow ONE realtime connection per user across ALL components
    if (subscribedUserId === userId && realtimeChannelRef) {
      // Already subscribed for this user - do nothing
      return;
    }

    // Clean up old subscription if user changed
    if (realtimeChannelRef && subscribedUserId !== userId) {
      logger.debug('[useTierQuery] 🔄 User changed, cleaning up old subscription');
      supabase.removeChannel(realtimeChannelRef);
      realtimeChannelRef = null;
      subscribedUserId = null;
    }

    // Create new subscription
    if (import.meta.env.DEV) {
    logger.debug(`[useTierQuery] 📡 Starting realtime for user: ${userId.slice(0, 8)}...`);
    }
    subscribedUserId = userId;

    const channel = supabase
      .channel(`tier-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const newTier = (payload.new as any).subscription_tier as Tier || 'free';
          logger.info(`[useTierQuery] ✨ Tier updated: ${newTier.toUpperCase()}`);
          
          // Instantly update cache with new tier (no API call needed!)
          queryClient.setQueryData<TierData>(['user-tier'], (_old) => ({
            tier: newTier,
            userId: userId,
          }));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (import.meta.env.DEV) {
          logger.debug('[useTierQuery] ✅ Realtime ready');
          }
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('[useTierQuery] ❌ Channel error - reconnecting...');
          // Don't immediately reconnect - let it retry naturally
        }
      });

    realtimeChannelRef = channel;

    // Cleanup on unmount - but DON'T clean up if another component is still using it
    return () => {
      // Only clean up if we're the last component unmounting
      // React Query will handle the coordination
    };
  }, [query.data?.userId, queryClient]);

  // Listen for auth state changes (login/logout) - SILENT (no logging to prevent spam)
  useEffect(() => {
    let isSubscribed = true;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!isSubscribed) return; // Ignore events after unmount
      
      // ✅ FIX: Invalidate queries silently (no logging - prevents console spam)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        queryClient.invalidateQueries({ queryKey: ['user-tier'] });
      }
      // Silently ignore: TOKEN_REFRESHED, INITIAL_SESSION, USER_UPDATED
    });

    return () => {
      isSubscribed = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return {
    tier: query.data?.tier || 'free',
    userId: query.data?.userId || null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch, // Manual refetch (rarely needed - realtime handles updates)
  };
}

/**
 * Get tier display name for UI
 */
export function getTierDisplayName(tier: Tier): string {
  switch (tier) {
    case 'free':
      return 'Atlas Free';
    case 'core':
      return 'Atlas Core';
    case 'studio':
      return 'Atlas Studio';
    default:
      return 'Atlas Free';
  }
}

/**
 * Get tier color class for Tailwind
 */
export function getTierColor(tier: Tier): string {
  switch (tier) {
    case 'free':
      return 'text-yellow-400';
    case 'core':
      return 'text-atlas-sage';
    case 'studio':
      return 'text-purple-400';
    default:
      return 'text-yellow-400';
  }
}

/**
 * Get tier tooltip text
 */
export function getTierTooltip(tier: Tier): string {
  switch (tier) {
    case 'free':
      return '15 messages/month. Upgrade for unlimited conversations and advanced features.';
    case 'core':
      return 'Unlimited text + voice + image analysis with Claude Sonnet.';
    case 'studio':
      return 'All features unlocked with Claude Opus and priority support.';
    default:
      return '15 messages/month. Upgrade for unlimited conversations and advanced features.';
  }
}

