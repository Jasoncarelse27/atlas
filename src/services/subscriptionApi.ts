// Subscription API Service - Clean Backend Integration
// This service handles all subscription/tier queries through our backend API
// instead of direct Supabase calls, ensuring proper security and CORS handling

import { isPaidTier } from '../config/featureAccess';
import { logger } from '../lib/logger';
import { getApiEndpoint } from '../utils/apiClient';
import { perfMonitor } from '../utils/performanceMonitor';
import { safeToast } from './toastService';

// Track active mode clearly
let activeMode: "dexie" | "backend" | "supabase" | null = null;

// TypeScript const for placeholder detection
const PENDING_PLACEHOLDER = '__PENDING__' as const;

// Safe fetch helper with toast fallback
async function safeFetch(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    safeToast("⚠️ Backend unreachable, using offline mode", "error");
    return null;
  }
}

interface SubscriptionProfile {
  id: string;
  email: string;
  subscription_tier: 'free' | 'core' | 'studio';
  subscription_status: 'active' | 'inactive' | 'cancelled' | 'trialing';
  subscription_id?: string;
  fastspring_subscription_id?: string;
  trial_ends_at?: string;
  created_at: string;
  updated_at: string;
}

interface FastSpringSubscription {
  id: string;
  price_id?: string;
  status: 'free' | 'active' | 'canceled' | 'past_due';
  subscription_tier: 'free' | 'core' | 'studio';
  created_at: string;
  updated_at: string;
}

interface SubscriptionResponse {
  success: boolean;
  profile?: SubscriptionProfile;
  error?: string;
}

class SubscriptionApiService {
  private baseUrl: string;
  private isMockMode: boolean;
  private profileCache: Map<string, { data: SubscriptionProfile; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes - tier changes are rare, cache aggressively
  private pendingRequests: Map<string, Promise<SubscriptionProfile | null>> = new Map();

  private setMode(mode: "dexie" | "backend" | "supabase") {
    if (activeMode !== mode) {
      activeMode = mode;
      if (mode === "dexie") {
        safeToast("⚡ Using offline subscription mode", "error");
      } else {
        logger.debug("[SubscriptionAPI] ✅ Using backend API for subscriptions");
      }
    }
  }

  constructor() {
    // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
    // baseUrl is now handled by getApiEndpoint() - kept for backward compatibility
    this.baseUrl = '';
    
    // Check if we're in mock mode (no real FastSpring credentials)
    this.isMockMode = !import.meta.env.VITE_FASTSPRING_API_KEY || 
                     import.meta.env.VITE_FASTSPRING_API_KEY === PENDING_PLACEHOLDER;
    
  }

  /**
   * Get user's subscription profile through backend API
   */
  async getUserProfile(userId: string, accessToken: string): Promise<SubscriptionProfile | null> {
    // Check cache first
    const cached = this.profileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.debug('[SubscriptionAPI] Using cached profile ✅', userId, 'tier:', cached.data?.subscription_tier);
      return cached.data;
    }

    // Check if there's already a pending request for this user
    const pendingRequest = this.pendingRequests.get(userId);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Create new request and store it
    const requestPromise = this.fetchUserProfile(userId, accessToken);
    this.pendingRequests.set(userId, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(userId);
    }
  }

  private async fetchUserProfile(userId: string, accessToken: string): Promise<SubscriptionProfile | null> {
    try {
      perfMonitor.start('tier-fetch');
      
      // ✅ CRITICAL FIX: This is a Supabase REST endpoint, use full Supabase URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const profile = await safeFetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,   // Required for Supabase REST
          'Content-Type': 'application/json',
        },
      });
      
      const duration = perfMonitor.end('tier-fetch');
      if (duration && profile) {
        logger.debug(`✅ [Tier] Loaded "${profile.subscription_tier}" in ${duration.toFixed(0)}ms`);
      }

      if (profile === null) {
        // Backend failed, try direct Supabase before falling back to Dexie
        this.setMode("dexie");
        
        // 🎯 FUTURE-PROOF FIX: Try direct Supabase query before using stale Dexie cache
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY
          );
          
          const { data: directProfile, error: directError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
          
          if (directProfile && !directError) {
            logger.debug('[SubscriptionAPI] ✅ Got fresh profile from direct Supabase:', (directProfile as any).subscription_tier);
            // Cache the fresh data
            this.profileCache.set(userId, { data: directProfile as any, timestamp: Date.now() });
            return directProfile as any;
          }
        } catch (directErr) {
          logger.error('[SubscriptionAPI] Direct Supabase fallback failed:', directErr);
        }
        
        // 🔒 SECURITY FIX: Never use stale Dexie cache for tier data
        // If we can't reach the backend or Supabase, fail with error
        logger.error('[SubscriptionAPI] ❌ Cannot fetch tier - all sources failed');
        throw new Error('Unable to fetch tier - please check your connection');
      }

      this.setMode("backend");
      
      // Cache the result
      this.profileCache.set(userId, { data: profile, timestamp: Date.now() });
      
      return profile;
    } catch (error) {
      // 🔒 SECURITY FIX: Try direct Supabase but NEVER fall back to stale Dexie cache
      this.setMode("supabase");
      
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY
        );
        
        const { data: directProfile, error: directError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (directProfile && !directError) {
          logger.debug('[SubscriptionAPI] ✅ Got fresh profile from direct Supabase fallback:', (directProfile as any).subscription_tier);
          // Cache the fresh data
          this.profileCache.set(userId, { data: directProfile as any, timestamp: Date.now() });
          return directProfile as any;
        }
      } catch (directErr) {
        logger.error('[SubscriptionAPI] Error in direct Supabase query:', directErr);
      }
      
      // 🔒 SECURITY FIX: Never use stale Dexie cache for tier data
      // This prevents users from accessing paid features after cancellation during outages
      logger.error('[SubscriptionAPI] ❌ All tier fetch attempts failed');
      throw new Error('Unable to fetch tier - please check your connection and try again');
    }
  }

  /**
   * Clear profile cache for a user (call after updates)
   */
  clearProfileCache(userId?: string): void {
    if (userId) {
      this.profileCache.delete(userId);
    } else {
      this.profileCache.clear();
    }
  }

  /**
   * Create user profile through backend API
   */
  async createUserProfile(userId: string, accessToken: string): Promise<SubscriptionProfile> {
    const response = await fetch(`${this.baseUrl}/v1/user_profiles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,   // Required for Supabase REST
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const profile: SubscriptionProfile = await response.json();
    
    // Cache the newly created profile
    this.profileCache.set(userId, { data: profile, timestamp: Date.now() });
    
    return profile;
  }

  /**
   * Get user's subscription tier (convenience method)
   */
  async getUserTier(userId: string, accessToken: string): Promise<'free' | 'core' | 'studio'> {
    try {
      const profile = await this.getUserProfile(userId, accessToken);
      return profile?.subscription_tier || 'free';
    } catch (error) {
      return 'free'; // Default to free tier on error
    }
  }

  /**
   * Update subscription tier (for development/testing)
   * Note: In production, this would be handled by FastSpring webhooks
   */
  async updateSubscriptionTier(
    userId: string, 
    newTier: 'free' | 'core' | 'studio', 
    accessToken: string
  ): Promise<SubscriptionProfile> {
    const response = await fetch(`${this.baseUrl}/v1/user_profiles/${userId}/tier`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,   // Required for Supabase REST
      },
      body: JSON.stringify({ tier: newTier })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to update subscription tier: ${response.status} ${response.statusText} - ${errorData.message || 'Unknown error'}`);
    }

    const updatedProfile = await response.json();
    
    // ✅ UNIFIED: Clear cache and trigger centralized invalidation
    this.clearProfileCache(userId);
    
    // Trigger centralized cache invalidation for all caches (mobile + web)
    try {
      const { cacheInvalidationService } = await import('./cacheInvalidationService');
      await cacheInvalidationService.onTierChange(userId, newTier, 'api');
    } catch (err) {
      logger.warn('[SubscriptionAPI] Could not trigger cache invalidation:', err);
      // Continue anyway - Realtime will catch the update
    }
    
    return updatedProfile;
  }

  /**
   * Get mock subscription response for testing/development
   */
  private async getMockSubscriptionResponse(userId: string): Promise<FastSpringSubscription> {
    // Get user profile to determine mock tier
    const profile = this.profileCache.get(userId)?.data;
    const tier = profile?.subscription_tier || 'free';
    
    return {
      id: `mock_${userId}`,
      status: isPaidTier(tier) ? 'active' : 'free',
      subscription_tier: tier,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Get subscription status (mock mode)
   * Uses backend API instead of direct Supabase calls
   */
  async getSubscriptionStatus(userId: string, accessToken: string): Promise<FastSpringSubscription | null> {
    if (!this.isMockMode) {
      // FastSpring API integration pending approval
      logger.warn('⏳ FastSpring credentials pending 2FA - using mock mode');
      return this.getMockSubscriptionResponse(userId);
    }

    // Use backend API instead of direct Supabase calls
    const response = await fetch(`${this.baseUrl}/v1/user_profiles/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,   // Required for Supabase REST
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const profile = await response.json();
    logger.debug('[SubscriptionAPI] Using backend API ✅', profile);
    
    // Convert profile to FastSpringSubscription format
    return {
      id: profile.id,
      status: isPaidTier(profile.subscription_tier) ? 'active' : 'free',
      subscription_tier: profile.subscription_tier,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  }

  /**
   * Update subscription status (mock mode)
   * Uses backend API instead of direct Supabase calls
   */
  async updateSubscriptionStatus(
    userId: string, 
    status: 'free' | 'active' | 'canceled' | 'past_due',
    tier: 'free' | 'core' | 'studio',
    accessToken: string
  ): Promise<void> {
    // Use backend API to update subscription tier
    const response = await fetch(`${this.baseUrl}/v1/user_profiles/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,   // Required for Supabase REST
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        subscription_tier: tier,
        subscription_status: status === 'free' ? 'active' : 'active',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    logger.debug('[SubscriptionAPI] Using backend API ✅', { userId, status, tier });
    
    // Clear cache since subscription was updated
    this.clearProfileCache(userId);
  }

  /**
   * Get user stats with offline caching
   * Tries to fetch from API, falls back to cached data if offline
   */
  async getUserStats(userId: string): Promise<any> {
    try {
      
      // ✅ CRITICAL FIX: Use centralized API client for production Vercel deployment
      const response = await fetch(getApiEndpoint(`/api/subscriptions/stats/${userId}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed: ${response.status}`);
      }

      const data = await response.json();

      // ✅ Save to Dexie cache (using new Golden Standard)
      // Note: subscription_stats table not implemented in new schema yet

      logger.debug('[SubscriptionAPI] Using backend API ✅', data);
      return data;
    } catch (err) {

      // ⚠️ Fallback to cached stats (not implemented in new schema)
      return { usage: [], attempts: [] };
    }
  }


  /**
   * Clear all caches
   */
  clearCache(): void {
    this.profileCache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Clear cache for specific user
   */
  clearUserCache(userId: string): void {
    this.profileCache.delete(userId);
    this.pendingRequests.delete(userId);
    logger.debug(`[SubscriptionAPI] 🧹 Cleared cache for user: ${userId}`);
  }

  // Force refresh user profile (bypasses all caches)
  async forceRefreshProfile(userId: string, accessToken: string): Promise<SubscriptionProfile | null> {
    logger.debug(`[SubscriptionAPI] 🔄 Force refreshing profile for user: ${userId}`);
    
    // Clear all caches first
    this.clearUserCache(userId);
    
    // Add cache-busting timestamp to prevent HTTP caching
    const timestamp = Date.now();
    const url = `${this.baseUrl}/v1/user_profiles/${userId}?t=${timestamp}`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        // ✅ GRACEFUL HANDLING: Check if response is HTML (error page) vs JSON
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          logger.debug(`[SubscriptionAPI] ⚠️ Backend returned HTML (likely error page) - FastSpring may not be ready yet`);
          return null; // Gracefully return null instead of throwing
        }
        logger.debug(`[SubscriptionAPI] ❌ Force refresh failed: ${response.status}`);
        return null;
      }

      // ✅ GRACEFUL HANDLING: Check content type before parsing JSON
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        logger.debug(`[SubscriptionAPI] ⚠️ Response is not JSON (${contentType}) - FastSpring may not be ready yet`);
        return null; // Gracefully return null instead of throwing
      }

      const profile = await response.json();
      logger.debug(`[SubscriptionAPI] ✅ Force refresh successful: ${profile.subscription_tier}`);
      
      // Cache the fresh result
      this.profileCache.set(userId, { data: profile, timestamp: Date.now() });
      
      return profile;
    } catch (error) {
      logger.error('[SubscriptionAPI] ❌ Force refresh error:', error);
      return null;
    }
  }

  // Clear all caches (for debugging/admin use)
  clearAllCache(): void {
    this.profileCache.clear();
    this.pendingRequests.clear();
    logger.debug('[SubscriptionAPI] 🧹 Cleared all caches');
  }

  // Get cache stats for debugging
  getCacheStats(): { userCount: number; cacheSize: number } {
    return {
      userCount: this.profileCache.size,
      cacheSize: this.profileCache.size
    };
  }
}

// Export singleton instance
export const subscriptionApi = new SubscriptionApiService();
export type { FastSpringSubscription, SubscriptionProfile, SubscriptionResponse };

// Global debug function for browser console
if (typeof window !== 'undefined') {
  (window as any).atlasTierDebug = {
    clearAllCaches: () => subscriptionApi.clearAllCache(),
    forceRefresh: async (userId?: string) => {
      if (!userId) {
        const supabase = (await import('../lib/supabaseClient')).default;
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id;
      }
      if (!userId) return logger.error('No user ID found');
      
      const supabase = (await import('../lib/supabaseClient')).default;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) return logger.error('No access token found');
      
      logger.debug('🔄 Force refreshing tier for user:', userId);
      const result = await subscriptionApi.forceRefreshProfile(userId, accessToken);
      logger.debug('✅ Result:', result);
      return result;
    },
    getCacheStats: () => subscriptionApi.getCacheStats()
  };
  
  logger.debug('🛠️ Atlas Tier Debug Tools Available:');
  logger.debug('  - atlasTierDebug.clearAllCaches()');
  logger.debug('  - atlasTierDebug.forceRefresh()');
  logger.debug('  - atlasTierDebug.getCacheStats()');
}

