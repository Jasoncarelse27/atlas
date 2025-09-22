// Subscription API Service - Clean Backend Integration
// This service handles all subscription/tier queries through our backend API
// instead of direct Supabase calls, ensuring proper security and CORS handling

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

interface SubscriptionResponse {
  success: boolean;
  profile?: SubscriptionProfile;
  error?: string;
}

class SubscriptionApiService {
  private baseUrl: string;

  constructor() {
    // Use backend URL from environment or default to localhost
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  }

  /**
   * Get user's subscription profile through backend API
   */
  async getUserProfile(userId: string, accessToken: string): Promise<SubscriptionProfile | null> {
    try {
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
      console.log('[SubscriptionAPI] Profile loaded:', profile.subscription_tier);
      return profile;
    } catch (error) {
      console.error('[SubscriptionAPI] Error fetching user profile:', error);
      throw error;
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
}

// Export singleton instance
export const subscriptionApi = new SubscriptionApiService();
export type { SubscriptionProfile, SubscriptionResponse };
