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

// ✅ PERFORMANCE: Cache tier in localStorage for instant loading
const TIER_CACHE_KEY = 'atlas:tier_cache';
const TIER_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

function getCachedTier(userId: string | null): TierData | null {
  if (!userId || typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(TIER_CACHE_KEY);
    if (!cached) return null;
    
    const { tier, cachedUserId, timestamp } = JSON.parse(cached);
    
    // Check if cache is for this user and still valid
    if (cachedUserId === userId && Date.now() - timestamp < TIER_CACHE_EXPIRY) {
      return { tier, userId };
    }
  } catch (e) {
    // Invalid cache, ignore
  }
  
  return null;
}

function setCachedTier(data: TierData): void {
  if (!data.userId || typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(TIER_CACHE_KEY, JSON.stringify({
      tier: data.tier,
      cachedUserId: data.userId,
      timestamp: Date.now()
    }));
  } catch (e) {
    // localStorage full or disabled, ignore
  }
}

/**
 * Fetch user tier from Supabase (optimized for speed with localStorage cache)
 * @returns TierData with tier and userId
 */
async function fetchTier(): Promise<TierData> {
  try {
    // Get cached session first (faster than getUser)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      logger.error('[useTierQuery] Session error:', {
        code: sessionError.code,
        message: sessionError.message,
        details: sessionError.details,
        hint: sessionError.hint
      });
      return { tier: 'free', userId: null };
    }
    
    if (!session?.user) {
      return { tier: 'free', userId: null };
    }

    const userId = session.user.id;
    
    // ✅ PERFORMANCE FIX: Check localStorage cache first for instant loading
    const cached = getCachedTier(userId);
    if (cached) {
      logger.debug('[useTierQuery] ✅ Using cached tier:', cached.tier);
      return cached;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single<{ subscription_tier: Tier }>();

    if (error) {
      // ✅ BETTER ERROR LOGGING: Capture full error details
      logger.error('[useTierQuery] Supabase query error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId: userId.slice(0, 8) + '...'
      });
      return { tier: 'free', userId };
    }

    const tier = data?.subscription_tier || 'free';
    
    const result = {
      tier,
      userId,
    };
    
    // ✅ PERFORMANCE FIX: Cache result for instant future loads
    setCachedTier(result);
    
    return result;
  } catch (fetchError) {
    // ✅ CATCH NETWORK ERRORS: Better diagnostics for "Failed to fetch"
    logger.error('[useTierQuery] Network/fetch error:', {
      message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
      type: fetchError instanceof TypeError ? 'TypeError' : fetchError?.constructor?.name || 'Unknown',
      stack: fetchError instanceof Error ? fetchError.stack : undefined,
      // Check if Supabase URL/key are available
      hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
      hasSupabaseKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      supabaseUrlPreview: import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) + '...' || 'NOT SET'
    });
    return { tier: 'free', userId: null };
  }
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
    // ✅ PERFORMANCE FIX: Show 'free' tier immediately while loading (prevents slow drawer)
    placeholderData: { tier: 'free' as Tier, userId: null },
    // ✅ PERFORMANCE FIX: Use cached data immediately if available (localStorage + React Query cache)
    initialData: () => {
      // First check React Query cache
      const cached = queryClient.getQueryData<TierData>(['user-tier']);
      if (cached) return cached;
      
      // Then check localStorage cache for instant loading
      if (typeof window !== 'undefined') {
        try {
          const session = localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
          if (session) {
            const parsed = JSON.parse(session);
            const userId = parsed?.user?.id;
            if (userId) {
              const localStorageCached = getCachedTier(userId);
              if (localStorageCached) {
                logger.debug('[useTierQuery] ✅ Using localStorage cache for instant load');
                return localStorageCached;
              }
            }
          }
        } catch (e) {
          // Ignore localStorage errors
        }
      }
      
      return { tier: 'free' as Tier, userId: null };
    },
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
          const updatedData: TierData = {
            tier: newTier,
            userId: userId,
          };
          queryClient.setQueryData<TierData>(['user-tier'], updatedData);
          
          // ✅ PERFORMANCE FIX: Update localStorage cache too
          setCachedTier(updatedData);
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

