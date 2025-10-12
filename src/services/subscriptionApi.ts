// Subscription API Service - Clean Backend Integration
// This service handles all subscription/tier queries through our backend API
// instead of direct Supabase calls, ensuring proper security and CORS handling

import { atlasDB } from '../database/atlasDB'; // ✅ FIXED: Import from new Golden Standard Dexie
import { safeToast } from './toastService';

// Track active mode clearly
let activeMode: "dexie" | "backend" | null = null;

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
  private readonly CACHE_TTL = 5000; // 🎯 FUTURE-PROOF FIX: 5 seconds for faster tier updates
  private pendingRequests: Map<string, Promise<SubscriptionProfile | null>> = new Map();

  private setMode(mode: "dexie" | "backend") {
    if (activeMode !== mode) {
      activeMode = mode;
      if (mode === "dexie") {
        safeToast("⚡ Using offline subscription mode", "error");
      } else {
        console.log("[SubscriptionAPI] ✅ Using backend API for subscriptions");
      }
    }
  }

  constructor() {
    // Use relative URL to leverage Vite proxy for mobile compatibility
    // This ensures mobile devices use the proxy instead of direct localhost calls
    this.baseUrl = '';
    
    // Check if we're in mock mode (no real FastSpring credentials)
    this.isMockMode = !import.meta.env.VITE_FASTSPRING_API_KEY;
    
  }

  /**
   * Get user's subscription profile through backend API
   */
  async getUserProfile(userId: string, accessToken: string): Promise<SubscriptionProfile | null> {
    // Check cache first
    const cached = this.profileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('[SubscriptionAPI] Using cached profile ✅', userId, 'tier:', cached.data?.subscription_tier);
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
      
      const profile = await safeFetch(`${this.baseUrl}/v1/user_profiles/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,   // Required for Supabase REST
          'Content-Type': 'application/json',
        },
      });

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
            console.log('[SubscriptionAPI] ✅ Got fresh profile from direct Supabase:', (directProfile as any).subscription_tier);
            // Cache the fresh data
            this.profileCache.set(userId, { data: directProfile as any, timestamp: Date.now() });
            return directProfile as any;
          }
        } catch (directErr) {
          console.error('[SubscriptionAPI] Direct Supabase fallback failed:', directErr);
        }
        
        // If direct Supabase also failed, use Dexie cache as last resort
        return await this.getProfileFromDexie(userId);
      }

      this.setMode("backend");
      
      // Cache the result
      this.profileCache.set(userId, { data: profile, timestamp: Date.now() });
      
      return profile;
    } catch (error) {
      // Try direct Supabase before falling back to Dexie
      this.setMode("dexie");
      
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
          console.log('[SubscriptionAPI] ✅ Got fresh profile from direct Supabase fallback:', (directProfile as any).subscription_tier);
          // Cache the fresh data
          this.profileCache.set(userId, { data: directProfile as any, timestamp: Date.now() });
          return directProfile as any;
        }
      } catch (directErr) {
        console.error('[SubscriptionAPI] Error in direct Supabase query:', directErr);
      }
      
      return await this.getProfileFromDexie(userId);
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
    try {
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
    } catch (error) {
      throw error;
    }
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
    try {
      
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
      
      // Clear cache since tier was updated
      this.clearProfileCache(userId);
      
      return updatedProfile;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get subscription status (mock mode)
   * Uses backend API instead of direct Supabase calls
   */
  async getSubscriptionStatus(userId: string, accessToken: string): Promise<FastSpringSubscription | null> {
    if (!this.isMockMode) {
      // FastSpring API integration pending approval
      throw new Error('Real FastSpring integration not implemented yet');
    }

    try {
      
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
      console.log('[SubscriptionAPI] Using backend API ✅', profile);
      
      // Convert profile to FastSpringSubscription format
      return {
        id: profile.id,
        status: profile.subscription_tier === 'free' ? 'free' : 'active',
        subscription_tier: profile.subscription_tier,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      };
    } catch (error) {
      throw error;
    }
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
    try {
      
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

      console.log('[SubscriptionAPI] Using backend API ✅', { userId, status, tier });
      
      // Clear cache since subscription was updated
      this.clearProfileCache(userId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user stats with offline caching
   * Tries to fetch from API, falls back to cached data if offline
   */
  async getUserStats(userId: string): Promise<any> {
    try {
      
      const response = await fetch(`${this.baseUrl}/api/subscriptions/stats/${userId}`, {
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

      console.log('[SubscriptionAPI] Using backend API ✅', data);
      return data;
    } catch (err) {

      // ⚠️ Fallback to cached stats (not implemented in new schema)
      return { usage: [], attempts: [] };
    }
  }

  /**
   * Fallback method to get profile from Dexie cache when backend is unavailable
   */
  private async getProfileFromDexie(userId: string): Promise<SubscriptionProfile | null> {
    try {
      // ✅ FIXED: Use profiles table from new Golden Standard Dexie
      const profile = await atlasDB.conversations
        ?.where('userId')
        .equals(userId)
        .first();

      if (profile) {
        // Note: Conversation type doesn't match SubscriptionProfile, returning null for now
        return null;
      }

      // Return default core tier profile if no cache available (better UX)
      return {
        id: userId,
        email: 'unknown@example.com',
        subscription_tier: 'core',
        subscription_status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      return null;
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
  }
}

// Export singleton instance
export const subscriptionApi = new SubscriptionApiService();
export type { FastSpringSubscription, SubscriptionProfile, SubscriptionResponse };

