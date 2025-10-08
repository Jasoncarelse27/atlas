import { supabase } from '../../../lib/supabase';
import { subscriptionApi } from '../../../services/subscriptionApi';
import { createChatError } from '../lib/errorHandler';
// import type { UserTier } from '../hooks/useSubscriptionAccess';
type UserTier = 'free' | 'core' | 'studio';

export interface UsageStats {
  messages_today: number;
  messages_this_month: number;
  last_reset_date: string;
  total_conversations: number;
  total_messages: number;
}

export interface SubscriptionProfile {
  id: string;
  user_id: string;
  subscription_tier: UserTier; // Updated to match database field
  trial_ends_at: string | null;
  subscription_status: 'active' | 'inactive' | 'cancelled' | 'trialing';
  subscription_id: string | null;
  paddle_subscription_id: string | null;
  usage_stats: UsageStats;
  created_at: string;
  updated_at: string;
}

export interface UpgradeRequest {
  userId: string;
  newTier: UserTier;
  paymentMethod?: string;
}

export interface UpgradeResponse {
  success: boolean;
  newTier: UserTier;
  subscriptionId: string;
  checkoutUrl?: string;
}

class SubscriptionService {
  /**
   * Get user's subscription profile
   */
  async getUserProfile(userId: string): Promise<SubscriptionProfile | null> {
    try {
      // Get access token for backend API calls
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      if (!accessToken) {
        throw new Error("No access token available");
      }

      // Use backend API to get profile
      try {
        const profile = await subscriptionApi.getUserProfile(userId, accessToken);
        return profile as SubscriptionProfile | null;
      } catch (apiError) {
        
        // Fallback to direct Supabase call
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getUserProfile',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Get user's current tier
   */
  async getUserTier(userId: string): Promise<UserTier> {
    try {
      // Get access token for backend API calls
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      if (!accessToken) {
        throw new Error("No access token available");
      }

      // Use backend API to get tier
      try {
        const tier = await subscriptionApi.getUserTier(userId, accessToken);
        return tier;
      } catch (apiError) {
        
        // Fallback to direct Supabase call
        const profile = await this.getUserProfile(userId);
        return profile?.subscription_tier || 'free';
      }
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getUserTier',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Get user's usage statistics
   */
  async getUsageStats(userId: string): Promise<UsageStats> {
    try {
      const profile = await this.getUserProfile(userId);
      
      if (!profile) {
        // Return default stats for new users
        return {
          messages_today: 0,
          messages_this_month: 0,
          last_reset_date: new Date().toISOString().slice(0, 7),
          total_conversations: 0,
          total_messages: 0,
        };
      }

      return profile.usage_stats;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getUsageStats',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Update usage statistics
   */
  async updateUsageStats(userId: string, updates: Partial<UsageStats>): Promise<UsageStats> {
    try {
      const currentStats = await this.getUsageStats(userId);
      const newStats = { ...currentStats, ...updates };

      const { error } = await supabase
        .from('profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('updated_at')
        .single();

      if (error) throw error;
      return newStats;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'updateUsageStats',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Increment message count
   */
  async incrementMessageCount(userId: string): Promise<void> {
    try {
      const currentStats = await this.getUsageStats(userId);
      const newStats = {
        ...currentStats,
        messages_today: currentStats.messages_today + 1,
        messages_this_month: currentStats.messages_this_month + 1,
        total_messages: currentStats.total_messages + 1,
      };

      await this.updateUsageStats(userId, newStats);
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'incrementMessageCount',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Reset daily usage counts
   */
  async resetDailyUsage(userId: string): Promise<void> {
    try {
      const currentStats = await this.getUsageStats(userId);
      const today = new Date().toISOString().slice(0, 10);
      
      if (currentStats.last_reset_date !== today) {
        await this.updateUsageStats(userId, {
          messages_today: 0,
          last_reset_date: today,
        });
      }
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'resetDailyUsage',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Reset monthly usage counts
   */
  async resetMonthlyUsage(userId: string): Promise<void> {
    try {
      const currentStats = await this.getUsageStats(userId);
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      if (currentStats.last_reset_date !== currentMonth) {
        await this.updateUsageStats(userId, {
          messages_this_month: 0,
          last_reset_date: currentMonth,
        });
      }
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'resetMonthlyUsage',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Upgrade user tier
   */
  async upgradeTier(request: UpgradeRequest): Promise<UpgradeResponse> {
    try {
      // Get access token for backend API calls
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      if (!accessToken) {
        throw new Error("No access token available");
      }

      // Use backend API to update tier
      try {
        const updatedProfile = await subscriptionApi.updateSubscriptionTier(
          request.userId, 
          request.newTier, 
          accessToken
        );
        
        console.log('✅ Tier upgraded via backend API:', updatedProfile);
        
        return {
          success: true,
          newTier: request.newTier,
          subscriptionId: updatedProfile.subscription_id || `sub_${Date.now()}`,
          checkoutUrl: undefined, // For development, no checkout URL needed
        };
      } catch (apiError) {
        
        // Fallback to direct Supabase update
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            subscription_tier: request.newTier,
            subscription_status: 'trialing',
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.userId);

        if (updateError) throw updateError;

        return {
          success: true,
          newTier: request.newTier,
          subscriptionId: `sub_${Date.now()}`,
          checkoutUrl: undefined,
        };
      }
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'upgradeTier',
        userId: request.userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<void> {
    try {
      const profile = await this.getUserProfile(userId);
      
      if (!profile?.subscription_id) {
        throw new Error('No active subscription found');
      }

      // Cancel with Paddle
      const { error: paddleError } = await supabase.functions.invoke('cancel-paddle-subscription', {
        body: { subscriptionId: profile.subscription_id },
      });

      if (paddleError) throw paddleError;

      // Update local profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          subscription_status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'cancelSubscription',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(userId: string): Promise<void> {
    try {
      const profile = await this.getUserProfile(userId);
      
      if (!profile?.subscription_id) {
        throw new Error('No subscription found to reactivate');
      }

      // Reactivate with Paddle
      const { error: paddleError } = await supabase.functions.invoke('reactivate-paddle-subscription', {
        body: { subscriptionId: profile.subscription_id },
      });

      if (paddleError) throw paddleError;

      // Update local profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          subscription_status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'reactivateSubscription',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Get subscription limits for a tier
   */
  getTierLimits(tier: UserTier) {
    switch (tier) {
      case 'free':
        return {
          dailyMessages: 15,
          monthlyMessages: 450, // 15 * 30
          features: ['Basic AI responses', 'Text input', 'Claude Haiku'],
          price: 0,
        };
      case 'core':
        return {
          dailyMessages: -1, // Unlimited
          monthlyMessages: -1, // Unlimited
          features: ['Advanced AI responses', 'Voice input', 'Image analysis', 'Claude Sonnet'],
          price: 19.99,
        };
      case 'studio':
        return {
          dailyMessages: -1, // Unlimited
          monthlyMessages: -1, // Unlimited
          features: ['Unlimited AI responses', 'All features', 'Priority support', 'Claude Opus'],
          price: 179.99,
        };
      default:
        return {
          dailyMessages: 0,
          monthlyMessages: 0,
          features: [],
          price: 0,
        };
    }
  }

  /**
   * Check if user can send message based on tier limits
   */
  async canSendMessage(userId: string): Promise<boolean> {
    try {
      const tier = await this.getUserTier(userId);
      const usage = await this.getUsageStats(userId);
      const limits = this.getTierLimits(tier);

      if (limits.dailyMessages === -1) return true; // Unlimited
      return usage.messages_today < limits.dailyMessages;
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'canSendMessage',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }

  /**
   * Get remaining messages for today
   */
  async getRemainingMessages(userId: string): Promise<number> {
    try {
      const tier = await this.getUserTier(userId);
      const usage = await this.getUsageStats(userId);
      const limits = this.getTierLimits(tier);

      if (limits.dailyMessages === -1) return -1; // Unlimited
      return Math.max(0, limits.dailyMessages - usage.messages_today);
    } catch (error) {
      const chatError = createChatError(error, {
        operation: 'getRemainingMessages',
        userId,
        timestamp: new Date().toISOString(),
      });
      throw chatError;
    }
  }
}

export const subscriptionService = new SubscriptionService();
export default subscriptionService;
