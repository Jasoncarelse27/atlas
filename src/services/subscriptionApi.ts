// Subscription API Service - Clean Backend Integration
// This service handles all subscription/tier queries through our backend API
// instead of direct Supabase calls, ensuring proper security and CORS handling

import { db } from '../lib/db';

interface SubscriptionProfile {
  id: string;
  email: string;
  subscription_tier: 'free' | 'core' | 'studio';
  subscription_status: 'active' | 'inactive' | 'cancelled' | 'trialing';
  subscription_id?: string;
  paddle_subscription_id?: string;
  trial_ends_at?: string;
  created_at: string;
  updated_at: string;
}

interface PaddleSubscription {
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
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor() {
    // Use backend URL from environment or default to localhost
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    // Check if we're in mock mode (no real Paddle credentials)
    this.isMockMode = !import.meta.env.VITE_PADDLE_CLIENT_TOKEN || 
                     import.meta.env.VITE_PADDLE_CLIENT_TOKEN === 'mock-client-token';
    
    console.log('[Atlas] Subscription API running in backend+Dexie mode 🚀');
    
    if (this.isMockMode) {
      console.log('[SubscriptionAPI] Running in mock mode - using paddle_subscriptions table');
    }
  }

  /**
   * Get user's subscription profile through backend API
   */
  async getUserProfile(userId: string, accessToken: string): Promise<SubscriptionProfile | null> {
    // Check cache first
    const cached = this.profileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('[SubscriptionAPI] Using cached profile ✅', userId);
      return cached.data;
    }

    try {
      console.log('[SubscriptionAPI] Fetching subscription status for', userId);
      
      const response = await fetch(`${this.baseUrl}/v1/user_profiles/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[SubscriptionAPI] User profile not found, will be created on first access');
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const profile: SubscriptionProfile = await response.json();
      console.log('[SubscriptionAPI] Using backend API ✅', profile);
      
      // Cache the result
      this.profileCache.set(userId, { data: profile, timestamp: Date.now() });
      
      return profile;
    } catch (error) {
      console.error('[SubscriptionAPI] Error fetching user profile:', error);
      throw error;
    }
  }

  /**
   * Clear profile cache for a user (call after updates)
   */
  clearProfileCache(userId?: string): void {
    if (userId) {
      this.profileCache.delete(userId);
      console.log('[SubscriptionAPI] Cleared cache for user:', userId);
    } else {
      this.profileCache.clear();
      console.log('[SubscriptionAPI] Cleared all profile cache');
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const profile: SubscriptionProfile = await response.json();
      console.log('[SubscriptionAPI] Profile created:', profile.subscription_tier);
      
      // Cache the newly created profile
      this.profileCache.set(userId, { data: profile, timestamp: Date.now() });
      
      return profile;
    } catch (error) {
      console.error('[SubscriptionAPI] Error creating user profile:', error);
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
      console.error('[SubscriptionAPI] Error getting user tier:', error);
      return 'free'; // Default to free tier on error
    }
  }

  /**
   * Update subscription tier (for development/testing)
   * Note: In production, this would be handled by Paddle webhooks
   */
  async updateSubscriptionTier(
    userId: string, 
    newTier: 'free' | 'core' | 'studio', 
    accessToken: string
  ): Promise<SubscriptionProfile> {
    try {
      // For now, we'll use direct Supabase update since backend doesn't have this endpoint yet
      // TODO: Add PUT /v1/user_profiles/:id endpoint to backend
      const { supabase } = await import('../lib/supabase');
      
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          subscription_tier: newTier,
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update tier: ${error.message}`);
      }

      console.log('[SubscriptionAPI] Tier updated to:', newTier);
      return data;
    } catch (error) {
      console.error('[SubscriptionAPI] Error updating subscription tier:', error);
      throw error;
    }
  }

  /**
   * Get subscription status (mock mode)
   * Uses backend API instead of direct Supabase calls
   */
  async getSubscriptionStatus(userId: string, accessToken: string): Promise<PaddleSubscription | null> {
    if (!this.isMockMode) {
      // TODO: Replace with real Paddle API calls after approval
      throw new Error('Real Paddle integration not implemented yet');
    }

    try {
      console.log('[SubscriptionAPI] Fetching subscription status for', userId);
      
      // Use backend API instead of direct Supabase calls
      const response = await fetch(`${this.baseUrl}/v1/user_profiles/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[SubscriptionAPI] No subscription found for user');
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const profile = await response.json();
      console.log('[SubscriptionAPI] Using backend API ✅', profile);
      
      // Convert profile to PaddleSubscription format
      return {
        id: profile.id,
        status: profile.subscription_tier === 'free' ? 'free' : 'active',
        subscription_tier: profile.subscription_tier,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      };
    } catch (error) {
      console.error('[SubscriptionAPI] Error fetching subscription status:', error);
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
      console.log('[SubscriptionAPI] Updating subscription status for', userId);
      
      // Use backend API to update subscription tier
      const response = await fetch(`${this.baseUrl}/v1/user_profiles/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
      console.error('[SubscriptionAPI] Error updating subscription status:', error);
      throw error;
    }
  }

  /**
   * Get user stats with offline caching
   * Tries to fetch from API, falls back to cached data if offline
   */
  async getUserStats(userId: string): Promise<any> {
    try {
      console.log('[SubscriptionAPI] Fetching subscription stats for', userId);
      
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

      // ✅ Save to Dexie cache
      await db.subscription_stats.put({
        userId,
        data,
        updatedAt: Date.now(),
      });

      console.log('[SubscriptionAPI] Using backend API ✅', data);
      return data;
    } catch (err) {
      console.error('[SubscriptionAPI] getUserStats failed, falling back to cache:', err);

      // ⚠️ Fallback to cached stats
      const cached = await db.subscription_stats
        .where('userId')
        .equals(userId)
        .last();

      if (cached) {
        console.log('[SubscriptionAPI] Using Dexie cache (offline) 🗄️', new Date(cached.updatedAt));
        return cached.data;
      }

      // Return empty stats if no cache available
      console.warn('[SubscriptionAPI] No cached stats available, returning empty data');
      return { usage: [], attempts: [] };
    }
  }
}

// Export singleton instance
export const subscriptionApi = new SubscriptionApiService();
export type { PaddleSubscription, SubscriptionProfile, SubscriptionResponse };

