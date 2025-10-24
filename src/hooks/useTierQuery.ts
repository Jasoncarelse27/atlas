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
    .single();

  if (error) {
    logger.error('[useTierQuery] Error fetching tier:', error);
    return { tier: 'free', userId };
  }

  const tier = (data?.subscription_tier as Tier) || 'free';
  logger.debug(`[useTierQuery] ✅ Tier loaded: ${tier} for user ${userId}`);

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
    refetchOnWindowFocus: true, // Auto-refetch when user returns to tab
    refetchOnReconnect: true, // Auto-refetch on network restore
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // 🔥 Supabase Realtime: Instant tier updates via WebSocket
  useEffect(() => {
    if (!query.data?.userId) return;

    logger.info(`[useTierQuery] 📡 Realtime active for user: ${query.data.userId.slice(0, 8)}...`);

    const channel = supabase
      .channel(`tier-updates-${query.data.userId}`) // Fixed: Use unique channel name format
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${query.data.userId}`,
        },
        (payload) => {
          const newTier = (payload.new as any).subscription_tier as Tier || 'free';
          logger.debug('[useTierQuery] 🔄 Realtime tier update:', {
            old: query.data?.tier,
            new: newTier,
            userId: query.data?.userId,
          });
          
          // Instantly update cache with new tier (no API call needed!)
          queryClient.setQueryData<TierData>(['user-tier'], (old) => ({
            tier: newTier,
            userId: query.data!.userId,
          }));

          // Show success toast (optional - can be disabled)
          logger.info(`✨ Tier updated to ${newTier.toUpperCase()}`);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('[useTierQuery] ✅ Realtime subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('[useTierQuery] ❌ Realtime subscription error - reconnecting...');
          // Auto-reconnect after channel error
          setTimeout(() => {
            logger.debug('[useTierQuery] 🔄 Attempting reconnection...');
            supabase.removeChannel(channel);
            query.refetch(); // This will trigger the useEffect to recreate the channel
          }, 2000);
        } else if (status === 'TIMED_OUT') {
          logger.warn('[useTierQuery] ⏱️ Realtime subscription timed out');
        } else {
          logger.debug('[useTierQuery] 📡 Subscription status:', status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [query.data?.userId, queryClient]);

  // Listen for auth state changes (login/logout)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Only log significant events
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        logger.info(`[useTierQuery] 🔐 Auth: ${event}`);
      }
      
      // Refetch tier on auth changes
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        query.refetch();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [query]);

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

