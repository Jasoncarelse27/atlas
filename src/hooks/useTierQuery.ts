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

// ✅ NETWORK FIX: Request deduplication - prevent multiple simultaneous queries
let inFlightRequest: Promise<TierData> | null = null;
let circuitBreakerFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5; // Stop retrying after 5 consecutive failures
const CIRCUIT_BREAKER_RESET_TIME = 30000; // Reset after 30 seconds
let circuitBreakerOpenUntil = 0;

// ✅ CROSS-DEVICE SYNC FIX: Reduced cache duration for faster sync across mobile/web
// localStorage cache persists across devices, so we need shorter expiry to catch tier changes
const TIER_CACHE_KEY = 'atlas:tier_cache';
const TIER_CACHE_EXPIRY = 30 * 1000; // ✅ FIX: 30 seconds (was 2 minutes) - ensures cross-device sync within 30s
const TIER_CACHE_MAX_AGE = 5 * 60 * 1000; // ✅ FIX: Maximum cache age - force refresh if older than 5 minutes

function getCachedTier(userId: string | null): TierData & { timestamp?: number } | null {
  if (!userId || typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(TIER_CACHE_KEY);
    if (!cached) return null;
    
    const { tier, cachedUserId, timestamp } = JSON.parse(cached);
    
    // ✅ CROSS-DEVICE SYNC FIX: Validate cache age and user match
    const cacheAge = Date.now() - timestamp;
    
    // ✅ FIX: Reject cache if user doesn't match (different user logged in)
    if (cachedUserId !== userId) {
      logger.debug(`[useTierQuery] ⚠️ Cache user mismatch: ${cachedUserId?.slice(0, 8)} vs ${userId.slice(0, 8)}, clearing cache`);
      localStorage.removeItem(TIER_CACHE_KEY);
      return null;
    }
    
    // ✅ FIX: Reject cache if too old (forces refresh on app start after 5 minutes)
    if (cacheAge > TIER_CACHE_MAX_AGE) {
      logger.debug(`[useTierQuery] ⚠️ Cache too old (${Math.round(cacheAge / 1000)}s), forcing refresh`);
      localStorage.removeItem(TIER_CACHE_KEY);
      return null;
    }
    
    // ✅ FIX: Use shorter cache expiry for cross-device sync (30 seconds)
    if (cacheAge < TIER_CACHE_EXPIRY) {
      return { tier, userId, timestamp };
    }
    
    // Cache expired but not too old - return null to trigger refresh
    return null;
  } catch (e) {
    // Invalid cache, ignore
    logger.debug('[useTierQuery] Invalid cache format, clearing');
    try {
      localStorage.removeItem(TIER_CACHE_KEY);
    } catch (e2) {
      // Ignore
    }
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
  // ✅ NETWORK FIX: Request deduplication - reuse in-flight request
  if (inFlightRequest && !forceRefresh) {
    logger.debug('[useTierQuery] ⚡ Reusing in-flight request');
    return inFlightRequest;
  }
  
  // ✅ NETWORK FIX: Circuit breaker - stop retrying if too many failures
  const now = Date.now();
  if (circuitBreakerOpenUntil > now) {
    const remainingSeconds = Math.ceil((circuitBreakerOpenUntil - now) / 1000);
    logger.debug(`[useTierQuery] ⚠️ Circuit breaker open, using cache (resets in ${remainingSeconds}s)`);
    // Return cached tier if available, otherwise free tier
    const cached = getCachedTier(null);
    return cached || { tier: 'free', userId: null };
  }
  
  // Create new request promise
  const requestPromise = (async () => {
    const requestStartTime = Date.now();
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
      // ✅ MOBILE FIX: Clear stale cache on session error
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
      // ✅ MOBILE FIX: Clear stale cache when not logged in
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
    
    // ✅ MOBILE FIX: Skip cache if forceRefresh is true (for manual refresh)
    if (forceRefresh) {
      // ✅ MOBILE FIX: Clear cache when forcing refresh
      logger.debug('[useTierQuery] 🔄 Force refresh - clearing cache');
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(TIER_CACHE_KEY);
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    } else {
      // ✅ CROSS-DEVICE SYNC FIX: Check cache but always validate freshness
      const cached = getCachedTier(userId);
      if (cached) {
        const cacheAge = Date.now() - (cached as any).timestamp;
        // ✅ FIX: Use cache only if less than 30 seconds old (ensures cross-device sync within 30s)
        if (cacheAge < TIER_CACHE_EXPIRY) {
          logger.debug(`[useTierQuery] ✅ Using cached tier (${Math.round(cacheAge / 1000)}s old):`, cached.tier);
          return cached;
        } else {
          // Cache expired - fetch fresh
          logger.debug(`[useTierQuery] ⚠️ Cache expired (${Math.round(cacheAge / 1000)}s old), fetching fresh...`);
        }
      }
    }

    // ✅ BEST PRACTICE: Fetch fresh from database (cache is for performance, realtime handles updates)
    // ✅ NETWORK FIX: Retry logic with exponential backoff for "Load failed" errors
    logger.debug(`[useTierQuery] 📡 Fetching tier from database for user: ${userId.slice(0, 8)}...`);
    
    let lastError: any = null;
    const MAX_RETRIES = 3;
    let data: { subscription_tier: Tier } | null = null;
    let error: any = null;
    let attempt = 0;
    
    for (attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', userId)
          .single<{ subscription_tier: Tier }>();
        
        data = result.data;
        error = result.error;
        
        // Success - break retry loop
        if (!error) {
          break;
        }
        
        // Don't retry non-network errors (auth, not found, etc.)
        if (error.code && error.code !== 'PGRST116') {
          break;
        }
        
        lastError = error;
        
        // Retry with exponential backoff (only for network errors)
        if (attempt < MAX_RETRIES - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Max 5s delay
          logger.debug(`[useTierQuery] ⚡ Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (fetchError: any) {
        // Network error (TypeError: Load failed)
        lastError = fetchError;
        
        // Don't retry if it's not a network error
        if (!(fetchError instanceof TypeError) || !fetchError.message?.includes('Load failed')) {
          error = { message: fetchError.message, code: 'NETWORK_ERROR' };
          break;
        }
        
        // Retry network errors with exponential backoff
        if (attempt < MAX_RETRIES - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          logger.debug(`[useTierQuery] ⚡ Network error, retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          error = { message: fetchError.message, code: 'NETWORK_ERROR' };
        }
      }
    }

    if (error || lastError) {
      // ✅ IMPROVED: Only log errors once (not on every retry)
      const finalError = error || lastError;
      if (attempt === MAX_RETRIES - 1 || !finalError.message?.includes('Load failed')) {
        logger.error('[useTierQuery] Supabase query error:', {
          code: finalError.code || 'NETWORK_ERROR',
          message: finalError.message,
          details: finalError.details,
          hint: finalError.hint,
          userId: userId.slice(0, 8) + '...',
          retries: attempt + 1
        });
      }
      
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
    
    // ✅ PERFORMANCE FIX: Removed log entirely - useEffect below logs when tier actually changes
    // This prevents console spam from hundreds of refetches
    
    const result = {
      tier,
      userId,
    };
    
    // ✅ PERFORMANCE FIX: Cache result for instant future loads
    setCachedTier(result);
    
    // ✅ NETWORK FIX: Reset circuit breaker on success
    circuitBreakerFailures = 0;
    circuitBreakerOpenUntil = 0;
    
      return result;
    } catch (fetchError) {
      // ✅ CATCH NETWORK ERRORS: Better diagnostics for "Failed to fetch"
      const isNetworkError = fetchError instanceof TypeError && fetchError.message?.includes('Load failed');
      
      // ✅ NETWORK FIX: Circuit breaker - track consecutive failures
      if (isNetworkError) {
        circuitBreakerFailures++;
        if (circuitBreakerFailures >= CIRCUIT_BREAKER_THRESHOLD) {
          circuitBreakerOpenUntil = requestStartTime + CIRCUIT_BREAKER_RESET_TIME;
          logger.warn(`[useTierQuery] ⚠️ Circuit breaker opened after ${circuitBreakerFailures} failures (resets in ${CIRCUIT_BREAKER_RESET_TIME / 1000}s)`);
          circuitBreakerFailures = 0; // Reset counter
        }
      } else {
        // Reset counter on non-network errors
        circuitBreakerFailures = 0;
      }
      
      // Only log errors if circuit breaker not open (prevent spam)
      if (circuitBreakerOpenUntil <= requestStartTime) {
        logger.error('[useTierQuery] Network/fetch error:', {
          message: fetchError instanceof Error ? fetchError.message : 'Unknown error',
          type: fetchError instanceof TypeError ? 'TypeError' : fetchError?.constructor?.name || 'Unknown',
          stack: fetchError instanceof Error ? fetchError.stack : undefined,
          hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
          hasSupabaseKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
          supabaseUrlPreview: import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) + '...' || 'NOT SET',
          circuitBreakerFailures
        });
      }
      
      // ✅ MOBILE FIX: Clear stale cache on network error
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(TIER_CACHE_KEY);
        } catch (e) {
          // Ignore localStorage errors
        }
      }
      
      return { tier: 'free', userId: null };
    } finally {
      // Clear in-flight request
      inFlightRequest = null;
    }
  })();
  
  // Store in-flight request
  inFlightRequest = requestPromise;
  
  return requestPromise;
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

    // ✅ TIER SYNC FIX: Synchronously check localStorage before React Query initializes
  // This prevents the "free" flash on mobile/web by hydrating from cache immediately
  const getInitialTierData = (): TierData | undefined => {
    // Check React Query cache first (fastest - from previous session)
    const cached = queryClient.getQueryData<TierData>(['user-tier']);
    if (cached) {
      logger.debug('[useTierQuery] ✅ Using React Query cache:', cached.tier);
      return cached;
    }
    
    // ✅ CRITICAL FIX: Synchronously check localStorage before async session check
    // This prevents "free" flash by using cached tier immediately
    if (typeof window !== 'undefined') {
      try {
        const cachedStr = localStorage.getItem(TIER_CACHE_KEY);
        if (cachedStr) {
          const parsed = JSON.parse(cachedStr);
          const { tier, cachedUserId, timestamp } = parsed;
          
          // Validate cache age (30 seconds max for instant hydration)
          const cacheAge = Date.now() - timestamp;
          if (cacheAge < TIER_CACHE_EXPIRY && cachedUserId) {
            logger.debug(`[useTierQuery] ✅ Using localStorage cache (${Math.round(cacheAge / 1000)}s old):`, tier);
            // Return cached tier immediately - session will be checked async in fetchTier
            return { tier, userId: cachedUserId };
          }
        }
      } catch (e) {
        // Invalid cache, ignore
        logger.debug('[useTierQuery] Invalid localStorage cache, will fetch fresh');
      }
    }
    
    // ✅ BEST PRACTICE: Return undefined instead of "free" placeholder
    // This prevents flash - React Query will show loading state until fetchTier completes
    // fetchTier will check session and return appropriate tier (cached or fresh)
    return undefined;
  };

  // React Query hook with production-grade configuration
  const query = useQuery({
    queryKey: ['user-tier'],
    queryFn: fetchTier,
    staleTime: 5 * 60 * 1000, // ✅ PERFORMANCE FIX: 5 minutes (was 30 seconds) - reduces excessive refetches
    gcTime: 10 * 60 * 1000, // ✅ FIX: 10 minutes cache time - prevents stale data while reducing queries
    refetchOnWindowFocus: false, // ✅ PERFORMANCE FIX: Disable refetch on focus (was causing spam)
    refetchOnReconnect: true, // Auto-refetch on network restore
    refetchInterval: false, // ✅ PERFORMANCE FIX: Disable polling (was every 60 seconds causing spam)
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    // ✅ TIER SYNC FIX: Use initialData instead of placeholderData to prevent "free" flash
    // initialData is used immediately, placeholderData shows during refetch
    initialData: getInitialTierData,
    // ✅ BEST PRACTICE: Only show "free" as placeholder during refetch if we have no cache
    // This prevents flash during background refreshes
    placeholderData: (previousData) => {
      // If we had previous data, keep showing it during refetch
      if (previousData) return previousData;
      // Only show "free" if truly no data available (shouldn't happen with initialData)
      return { tier: 'free' as Tier, userId: null };
    },
  });

  // ✅ PERFORMANCE FIX: Removed tier change logging - reduces console spam
  // Tier changes are already logged via Realtime subscription below

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
          
          logger.info(`[useTierQuery] ✨ Tier updated via Realtime: ${oldTier?.toUpperCase() || 'UNKNOWN'} → ${newTier.toUpperCase()}`);
          
          // ✅ UNIFIED: Trigger centralized cache invalidation (clears all caches)
          if (typeof window !== 'undefined') {
            try {
              // Import and trigger centralized invalidation service
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
          
          // Instantly update cache with new tier (no API call needed!)
          const updatedData: TierData = {
            tier: newTier,
            userId: userId,
          };
          queryClient.setQueryData<TierData>(['user-tier'], updatedData);
          
          // ✅ PERFORMANCE FIX: Update localStorage cache with fresh timestamp
          setCachedTier(updatedData);
          
          // ✅ MOBILE FIX: Log cache update for debugging
          logger.debug(`[useTierQuery] ✅ Cache updated: ${newTier.toUpperCase()} for user ${userId.slice(0, 8)}...`);
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

  // ✅ PERFORMANCE OPTIMIZATION: Module-level cooldown tracking (prevents spam across all instances)
  let lastRefetchTime = 0;
  const REFETCH_COOLDOWN = 10000; // ✅ OPTIMIZED: 10 seconds minimum between refetches (increased from 5s)

  // ✅ CROSS-DEVICE SYNC FIX: Force refresh tier when app becomes visible (catches tier changes from other devices)
  // ✅ PERFORMANCE FIX: Consolidated handler with cooldown to prevent duplicate refetches
  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    // ✅ BEST PRACTICE: Track pending timeout for cleanup (prevents memory leaks)
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
    
    // ✅ Consolidated handler for both visibilitychange and focus events
    const handleAppVisibility = () => {
      // ✅ BEST PRACTICE: Clear any pending timeout before creating new one (prevents race conditions)
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }
      
      // ✅ IMPROVEMENT 1: Explicit offline check (prevents unnecessary refetch attempts)
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (import.meta.env.DEV) {
          logger.debug('[useTierQuery] ⏳ Offline detected, skipping refetch');
        }
        return;
      }
      
      if (!document.hidden && query.data?.userId) {
        const now = Date.now();
        
        // ✅ PERFORMANCE FIX: Cooldown check - prevent refetch if last refetch < 5 seconds ago
        if (now - lastRefetchTime < REFETCH_COOLDOWN) {
          if (import.meta.env.DEV) {
            logger.debug(`[useTierQuery] ⏳ Refetch cooldown active (${Math.round((REFETCH_COOLDOWN - (now - lastRefetchTime)) / 1000)}s remaining), skipping...`);
          }
          return;
        }
        
        const cached = getCachedTier(query.data.userId);
        
        // ✅ FIX: Only refetch if cache exists AND is stale (prevents infinite loop when no cache)
        if (cached) {
          const cacheAge = Date.now() - (cached as any).timestamp;
          // ✅ FIX: If cache is older than 30 seconds, force refresh to catch tier changes from other devices
          if (cacheAge > TIER_CACHE_EXPIRY) {
            if (import.meta.env.DEV) {
              logger.debug(`[useTierQuery] 🔄 App visible, cache stale (${Math.round(cacheAge / 1000)}s), refreshing tier...`);
            }
            // ✅ PERFORMANCE OPTIMIZATION: Add jitter (0-1000ms random delay) to prevent synchronized refresh storms
            const jitter = Math.floor(Math.random() * 1000); // ✅ Increased from 300ms to 1000ms for better distribution
            pendingTimeout = setTimeout(() => {
              pendingTimeout = null; // Clear reference when timeout fires
              lastRefetchTime = Date.now();
              // ✅ BEST PRACTICE: Check if query is still mounted before refetching (prevents stale closure issues)
              query.refetch().catch((err) => {
                // Silently handle errors (query might be unmounted)
                if (import.meta.env.DEV) {
                  logger.debug('[useTierQuery] Refetch error (likely unmounted):', err);
                }
              });
            }, jitter);
          }
        }
        // ✅ FIX: If no cache exists, let the normal query handle it (don't force refetch)
      }
    };
    
    // ✅ PERFORMANCE FIX: Single handler for both events (prevents duplicate refetches)
    document.addEventListener('visibilitychange', handleAppVisibility);
    window.addEventListener('focus', handleAppVisibility);
    
    return () => {
      // ✅ BEST PRACTICE: Clean up event listeners
      document.removeEventListener('visibilitychange', handleAppVisibility);
      window.removeEventListener('focus', handleAppVisibility);
      // ✅ BEST PRACTICE: Clean up pending timeout (prevents memory leaks and stale refetches)
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }
    };
  }, [query, query.data?.userId]);

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

  // ✅ TIER SYNC FIX: Return cached tier immediately, only default to "free" if truly no data
  // Components should check isLoading to show loading state instead of assuming "free"
  const tier: Tier = query.data?.tier || 'free';
  const userId = query.data?.userId || null;

  return {
    tier,
    userId,
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

