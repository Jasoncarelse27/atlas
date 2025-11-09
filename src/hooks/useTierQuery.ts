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

function getCachedTier(userId: string | null): TierData & { timestamp?: number } | null {
  if (!userId || typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(TIER_CACHE_KEY);
    if (!cached) return null;
    
    const { tier, cachedUserId, timestamp } = JSON.parse(cached);
    
    // Check if cache is for this user and still valid
    if (cachedUserId === userId && Date.now() - timestamp < TIER_CACHE_EXPIRY) {
      return { tier, userId, timestamp }; // Include timestamp for age checking
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
async function fetchTier(forceRefresh = false): Promise<TierData> {
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
      // Clear stale cache on session error
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(TIER_CACHE_KEY);
        } catch (e) {
          // Ignore localStorage errors
        }
      }
      return { tier: 'free', userId: null };
    }
    
    if (!session?.user) {
      // Clear cache when not logged in
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(TIER_CACHE_KEY);
        } catch (e) {
          // Ignore localStorage errors
        }
      }
      return { tier: 'free', userId: null };
    }

    const userId = session.user.id;
    
    // ✅ BEST PRACTICE: Check cache first for performance, but only if not forcing refresh
    if (!forceRefresh) {
      const cached = getCachedTier(userId);
      if (cached) {
        // Cache is valid - use it for instant UI update
        // Realtime subscription will update if tier changes
        logger.debug(`[useTierQuery] Using cached tier: ${cached.tier.toUpperCase()} (age: ${Math.round((Date.now() - (cached.timestamp || 0)) / 1000)}s)`);
        return { tier: cached.tier, userId: cached.userId };
      }
    } else {
      // Force refresh - clear cache
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(TIER_CACHE_KEY);
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    }
    
    // ✅ BEST PRACTICE: Fetch from Supabase when cache miss or force refresh
    logger.debug(`[useTierQuery] 📡 Fetching tier from Supabase for user: ${userId.slice(0, 8)}...`);
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single<{ subscription_tier: Tier }>();

    if (error) {
      // ✅ BETTER ERROR LOGGING: Capture full error details
      logger.error('[useTierQuery] ❌ Supabase query error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId: userId.slice(0, 8) + '...'
      });
      
      // ✅ MOBILE FIX: If profile doesn't exist, try to create it
      if (error.code === 'PGRST116') {
        logger.debug('[useTierQuery] Profile not found, attempting to create...');
        try {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email: session.user.email,
              subscription_tier: 'free'
            });
          
          if (insertError) {
            logger.error('[useTierQuery] Failed to create profile:', insertError.message);
          } else {
            logger.debug('[useTierQuery] ✅ Profile created with free tier');
          }
        } catch (createError) {
          logger.error('[useTierQuery] Error creating profile:', createError);
        }
      }
      
      return { tier: 'free', userId };
    }

    const tier = data?.subscription_tier || 'free';
    
    // ✅ BEST PRACTICE: Log tier fetch (debug level to reduce production noise)
    logger.debug(`[useTierQuery] ✅ Fetched tier from Supabase: ${tier.toUpperCase()} for user ${userId.slice(0, 8)}...`);
    
    const result = {
      tier,
      userId,
    };
    
    // ✅ BEST PRACTICE: Cache result for performance (Realtime will invalidate on changes)
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
    
    // ✅ MOBILE FIX: Clear stale cache on network error
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(TIER_CACHE_KEY);
      } catch (e) {
        // Ignore localStorage errors
      }
    }
    
    return { tier: 'free', userId: null };
  }
}

/**
 * ✅ BEST PRACTICE: Modern tier management hook using React Query + Supabase Realtime
 * 
 * Architecture:
 * 1. **Smart Caching**: Uses localStorage + React Query cache for instant UI (5min stale, 30min cache)
 * 2. **Realtime Updates**: Supabase WebSocket pushes instant tier changes (no polling needed)
 * 3. **Cache Invalidation**: Automatically clears caches when tier changes via Realtime
 * 4. **Fallback Refetch**: Refetches on window focus/reconnect for reliability
 * 
 * Why this approach:
 * - ✅ Performance: Cached data = instant UI load
 * - ✅ Accuracy: Realtime = instant updates when tier changes
 * - ✅ Efficiency: No polling = less server load
 * - ✅ Reliability: Fallback refetch = handles edge cases
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

    // ✅ BEST PRACTICE: React Query with smart caching + Realtime updates
  const query = useQuery({
    queryKey: ['user-tier'],
    queryFn: () => fetchTier(false),
    staleTime: 5 * 60 * 1000, // ✅ BEST PRACTICE: Consider fresh for 5 minutes (Realtime handles instant updates)
    gcTime: 30 * 60 * 1000, // ✅ BEST PRACTICE: Keep in cache for 30 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnReconnect: true, // Auto-refetch on network restore
    // ✅ BEST PRACTICE: NO refetchInterval - Realtime subscription handles instant updates
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    // ✅ BEST PRACTICE: Use cached data for instant UI, but Realtime will update if stale
    initialData: () => {
      // Check React Query cache first
      const cached = queryClient.getQueryData<TierData>(['user-tier']);
      if (cached) return cached;
      return undefined; // Let fetchTier check localStorage cache
    },
  });

  // ✅ PERFORMANCE FIX: Only log tier changes in dev mode (reduce console spam)
  useEffect(() => {
    if (query.data?.tier && import.meta.env.DEV) {
      const prevTier = queryClient.getQueryData<TierData>(['user-tier'])?.tier;
      if (prevTier !== query.data.tier) {
        logger.debug(`[useTierQuery] ✅ Tier changed: ${prevTier} → ${query.data.tier} for user ${query.data.userId?.slice(0, 8)}...`);
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
          const oldTier = queryClient.getQueryData<TierData>(['user-tier'])?.tier;
          
          // ✅ BEST PRACTICE: Log tier changes for debugging
          logger.info(`[useTierQuery] ✨ Tier updated via Realtime: ${oldTier?.toUpperCase() || 'UNKNOWN'} → ${newTier.toUpperCase()}`);
          
          // ✅ BEST PRACTICE: Clear all caches first, then update
          if (typeof window !== 'undefined') {
            try {
              // Clear localStorage cache
              localStorage.removeItem(TIER_CACHE_KEY);
              
              // Trigger centralized cache invalidation (clears all related caches)
              import('../services/cacheInvalidationService').then(({ cacheInvalidationService }) => {
                cacheInvalidationService.onTierChange(userId, newTier, 'realtime');
              }).catch(err => {
                logger.warn('[useTierQuery] Could not trigger cache invalidation:', err);
              });
            } catch (e) {
              // Fallback: Clear local cache if service unavailable
              try {
                localStorage.removeItem(TIER_CACHE_KEY);
              } catch (e2) {
                // Ignore localStorage errors
              }
            }
          }
          
          // ✅ BEST PRACTICE: Instantly update React Query cache (no API call needed!)
          const updatedData: TierData = {
            tier: newTier,
            userId: userId,
          };
          queryClient.setQueryData<TierData>(['user-tier'], updatedData);
          
          // ✅ BEST PRACTICE: Update localStorage cache with fresh timestamp
          setCachedTier(updatedData);
          
          logger.debug(`[useTierQuery] ✅ Cache updated via Realtime: ${newTier.toUpperCase()} for user ${userId.slice(0, 8)}...`);
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

  // ✅ UNIFIED: Listen for centralized cache invalidation events
  useEffect(() => {
    const handleCacheInvalidation = (event: CustomEvent) => {
      const { userId: invalidatedUserId } = event.detail;
      const currentUserId = query.data?.userId;
      
      // Only invalidate if it's for the current user
      if (currentUserId && invalidatedUserId === currentUserId) {
        logger.debug('[useTierQuery] 🔄 Received cache invalidation event, refreshing tier...');
        queryClient.removeQueries({ queryKey: ['user-tier'] });
        query.refetch();
      }
    };
    
    const handleTierChanged = (event: CustomEvent) => {
      const { userId: changedUserId, newTier } = event.detail;
      const currentUserId = query.data?.userId;
      
      // Update immediately if it's for the current user
      if (currentUserId && changedUserId === currentUserId) {
        logger.debug(`[useTierQuery] 🔄 Received tier change event: ${newTier}`);
        queryClient.setQueryData<TierData>(['user-tier'], {
          tier: newTier,
          userId: currentUserId
        });
        setCachedTier({ tier: newTier, userId: currentUserId });
      }
    };
    
    window.addEventListener('tier-cache-invalidated', handleCacheInvalidation as EventListener);
    window.addEventListener('tier-changed', handleTierChanged as EventListener);
    
    return () => {
      window.removeEventListener('tier-cache-invalidated', handleCacheInvalidation as EventListener);
      window.removeEventListener('tier-changed', handleTierChanged as EventListener);
    };
  }, [query.data?.userId, queryClient, query]);

  // Listen for auth state changes (login/logout) - SILENT (no logging to prevent spam)
  useEffect(() => {
    let isSubscribed = true;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!isSubscribed) return; // Ignore events after unmount
      
      // ✅ PRODUCTION FIX: Clear localStorage cache on logout (security best practice)
      if (event === 'SIGNED_OUT') {
        try {
          localStorage.removeItem(TIER_CACHE_KEY);
          logger.debug('[useTierQuery] 🧹 Cleared tier cache on logout');
        } catch (e) {
          // Ignore localStorage errors
        }
      }
      
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

  // ✅ UNIFIED: Enhanced refetch that uses centralized cache invalidation
  const forceRefreshTier = async () => {
    logger.debug('[useTierQuery] 🔄 Force refreshing tier...');
    
    const userId = query.data?.userId;
    if (userId) {
      // Use centralized cache invalidation service
      try {
        const { cacheInvalidationService } = await import('../services/cacheInvalidationService');
        await cacheInvalidationService.invalidateUserTier(userId);
      } catch (err) {
        logger.warn('[useTierQuery] Could not use cache invalidation service, using fallback:', err);
        // Fallback: Clear local cache
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(TIER_CACHE_KEY);
          } catch (e) {
            // Ignore localStorage errors
          }
        }
      }
    }
    
    // Clear React Query cache
    queryClient.removeQueries({ queryKey: ['user-tier'] });
    // Force refetch with fresh data
    return query.refetch();
  };

  return {
    tier: query.data?.tier || 'free',
    userId: query.data?.userId || null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch, // Manual refetch (rarely needed - realtime handles updates)
    forceRefresh: forceRefreshTier, // ✅ MOBILE FIX: Force refresh with cache clear
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

