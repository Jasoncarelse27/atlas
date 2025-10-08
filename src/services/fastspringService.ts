// Atlas FastSpring Integration Service
// Subscription management, webhooks, and payment processing

import { FASTSPRING_CONFIG } from '../config/featureAccess';
import { supabase } from '../lib/supabase';
import type { Tier } from '../types/tier';
import { subscriptionApi } from './subscriptionApi';

export interface FastSpringSubscription {
  id: string;
  user_id: string;
  fastspring_subscription_id: string;
  fastspring_product_id: string;
  tier: Tier;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'unpaid';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  grace_period_end?: string; // 7-day grace period for failed payments
  created_at: string;
  updated_at: string;
}

export interface FastSpringWebhookEvent {
  id: string;
  type: string;
  subscription_id?: string;
  product_id?: string;
  user_id?: string;
  email?: string;
  status?: string;
  cancel_url?: string;
  update_url?: string;
  next_bill_date?: string;
  unit_price?: string;
  currency?: string;
  marketing_consent?: boolean;
  checkout_id?: string;
  event_time?: string;
  signature?: string;
}

export interface SubscriptionCache {
  userId: string;
  tier: Tier;
  status: string;
  isActive: boolean;
  expiresAt: number;
  cachedAt: number;
}

class FastSpringService {
  private subscriptionCache = new Map<string, SubscriptionCache>();

  /**
   * Get user's subscription status with 5-minute caching
   */
  async getUserSubscription(userId: string): Promise<{ tier: Tier; isActive: boolean; subscription?: FastSpringSubscription }> {
    // Check cache first
    const cached = this.subscriptionCache.get(userId);
    if (cached && Date.now() < cached.expiresAt) {
      return {
        tier: cached.tier,
        isActive: cached.isActive
      };
    }

    try {
      // Get access token for backend API calls
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      if (!accessToken) {
        return { tier: 'free', isActive: false };
      }

      // Use subscription API instead of direct Supabase call
      const profile = await subscriptionApi.getUserProfile(userId, accessToken);

      let tier: Tier = 'free';
      let isActive = false;

      if (profile) {
        tier = profile.subscription_tier;
        isActive = profile.subscription_status === 'active';
      }

      // Cache the result
      this.subscriptionCache.set(userId, {
        userId,
        tier,
        status: profile?.subscription_status || 'none',
        isActive,
        expiresAt: Date.now() + FASTSPRING_CONFIG.cacheTimeout,
        cachedAt: Date.now()
      });

      return { tier, isActive };

    } catch (error) {
      
      // Return cached if available, otherwise free tier
      if (cached) {
        return { tier: cached.tier, isActive: cached.isActive };
      }
      
      return { tier: 'free', isActive: false };
    }
  }

  /**
   * Validate subscription status before AI request
   */
  async validateSubscriptionForRequest(userId: string): Promise<{
    canProceed: boolean;
    tier: Tier;
    reason?: 'subscription_required' | 'payment_failed' | 'grace_period' | 'cancelled';
    graceEndsAt?: string;
  }> {
    const { tier, isActive, subscription } = await this.getUserSubscription(userId);

    // Free tier is always allowed (with its own limits)
    if (tier === 'free') {
      return { canProceed: true, tier };
    }

    // Active subscription
    if (isActive) {
      return { canProceed: true, tier };
    }

    // Check if in grace period (7 days after failed payment)
    if (subscription && subscription.grace_period_end) {
      const graceEnd = new Date(subscription.grace_period_end);
      const now = new Date();
      
      if (now < graceEnd) {
        return { 
          canProceed: true, 
          tier, 
          reason: 'grace_period',
          graceEndsAt: subscription.grace_period_end
        };
      }
    }

    // Subscription expired or cancelled
    return {
      canProceed: false,
      tier: 'free', // Downgrade to free
      reason: subscription?.status === 'cancelled' ? 'cancelled' : 'payment_failed'
    };
  }

  /**
   * Handle FastSpring webhook events
   */
  async handleWebhookEvent(event: FastSpringWebhookEvent): Promise<{ success: boolean; message: string }> {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(event)) {
        return { success: false, message: 'Invalid webhook signature' };
      }

      switch (event.type) {
        case 'subscription.created':
          return await this.handleSubscriptionCreated(event);
        
        case 'subscription.updated':
          return await this.handleSubscriptionUpdated(event);
        
        case 'subscription.cancelled':
          return await this.handleSubscriptionCancelled(event);
        
        case 'subscription.payment.succeeded':
          return await this.handlePaymentSucceeded(event);
        
        case 'subscription.payment.failed':
          return await this.handlePaymentFailed(event);
        
        default:
          return { success: true, message: 'Event acknowledged but not processed' };
      }

    } catch (error) {
      return { success: false, message: 'Webhook processing failed' };
    }
  }

  /**
   * Create FastSpring checkout URL for subscription using live API
   */
  async createCheckoutUrl(userId: string, tier: Tier, email: string): Promise<string> {
    if (tier === 'free') {
      throw new Error('Cannot create checkout for free tier');
    }

    const product = FASTSPRING_CONFIG.products[tier];
    if (!product) {
      throw new Error(`No product configuration for tier: ${tier}`);
    }

    try {
      // Call FastSpring API to create checkout session
      const response = await fetch('/api/fastspring/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          tier,
          email,
          productId: product.productId,
          successUrl: `${import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173'}/subscription/success`,
          cancelUrl: `${import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173'}/subscription/cancel`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { checkoutUrl } = await response.json();
      return checkoutUrl;

    } catch (error) {
      throw new Error('Failed to create checkout session');
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { subscription } = await this.getUserSubscription(userId);
      
      if (!subscription) {
        return { success: false, message: 'No active subscription found' };
      }

      // Mark for cancellation at period end
      const { error } = await supabase
        .from('fastspring_subscriptions')
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('fastspring_subscription_id', subscription.fastspring_subscription_id);

      if (error) {
        throw error;
      }

      // Clear cache
      this.subscriptionCache.delete(userId);

      // TODO: Call FastSpring API to cancel subscription
      
      return { success: true, message: 'Subscription will be cancelled at the end of the current period' };

    } catch (error) {
      return { success: false, message: 'Failed to cancel subscription' };
    }
  }

  /**
   * Reactivate cancelled subscription
   */
  async reactivateSubscription(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('fastspring_subscriptions')
        .update({
          cancel_at_period_end: false,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      // Clear cache
      this.subscriptionCache.delete(userId);

      return { success: true, message: 'Subscription reactivated successfully' };

    } catch (error) {
      return { success: false, message: 'Failed to reactivate subscription' };
    }
  }

  /**
   * Get subscription analytics
   */
  async getSubscriptionAnalytics(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    subscriptionsByTier: Record<Tier, number>;
    monthlyRecurringRevenue: number;
    churnRate: number;
  }> {
    try {
      const { data: subscriptions } = await supabase
        .from('fastspring_subscriptions')
        .select('tier, status, current_period_start, current_period_end');

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const analytics = {
        totalSubscriptions: subscriptions?.length || 0,
        activeSubscriptions: subscriptions?.filter(s => s.status === 'active').length || 0,
        subscriptionsByTier: {
          free: 0,
          core: 0,
          studio: 0
        } as Record<Tier, number>,
        monthlyRecurringRevenue: 0,
        churnRate: 0
      };

      if (subscriptions) {
        // Count by tier and calculate MRR
        for (const sub of subscriptions) {
          const tier = sub.tier as Tier;
          if (tier in analytics.subscriptionsByTier) {
            analytics.subscriptionsByTier[tier]++;
          }
          
          if (sub.status === 'active') {
            if (tier === 'core') analytics.monthlyRecurringRevenue += 19.99;
            if (tier === 'studio') analytics.monthlyRecurringRevenue += 179.99;
          }
        }

        // Calculate churn rate (simplified)
        const recentCancellations = subscriptions.filter(s => 
          s.status === 'cancelled' && 
          new Date(s.updated_at || new Date()) > thirtyDaysAgo
        ).length;
        
        analytics.churnRate = analytics.totalSubscriptions > 0 
          ? (recentCancellations / analytics.totalSubscriptions) * 100 
          : 0;
      }

      return analytics;

    } catch (error) {
      return {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        subscriptionsByTier: { free: 0, core: 0, studio: 0 },
        monthlyRecurringRevenue: 0,
        churnRate: 0
      };
    }
  }

  // Private helper methods

  private verifyWebhookSignature(_event: FastSpringWebhookEvent): boolean {
    // TODO: Implement proper FastSpring webhook signature verification
    // This is a simplified version - in production, you'd verify the signature
    return true;
  }

  private async handleSubscriptionCreated(event: FastSpringWebhookEvent): Promise<{ success: boolean; message: string }> {
    if (!event.subscription_id || !event.product_id) {
      return { success: false, message: 'Missing subscription data' };
    }

    const passthrough = event.user_id ? JSON.parse(event.user_id) : null;
    if (!passthrough?.userId) {
      return { success: false, message: 'Missing user ID in passthrough data' };
    }

    const tier = this.getTierFromProductId(event.product_id);
    
    const subscription: Omit<FastSpringSubscription, 'id' | 'created_at' | 'updated_at'> = {
      user_id: passthrough.userId,
      fastspring_subscription_id: event.subscription_id,
      fastspring_product_id: event.product_id,
      tier,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: event.next_bill_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: false
    };

    const { error } = await supabase
      .from('fastspring_subscriptions')
      .insert(subscription);

    if (error) {
      return { success: false, message: 'Failed to create subscription record' };
    }

    // Clear cache
    this.subscriptionCache.delete(passthrough.userId);

    return { success: true, message: 'Subscription created successfully' };
  }

  private async handleSubscriptionUpdated(event: FastSpringWebhookEvent): Promise<{ success: boolean; message: string }> {
    if (!event.subscription_id) {
      return { success: false, message: 'Missing subscription ID' };
    }

    const updates: Partial<FastSpringSubscription> = {
      updated_at: new Date().toISOString()
    };

    if (event.status) {
      updates.status = event.status as FastSpringSubscription['status'];
    }

    if (event.next_bill_date) {
      updates.current_period_end = event.next_bill_date;
    }

    const { error } = await supabase
      .from('fastspring_subscriptions')
      .update(updates)
      .eq('fastspring_subscription_id', event.subscription_id);

    if (error) {
      return { success: false, message: 'Failed to update subscription' };
    }

    return { success: true, message: 'Subscription updated successfully' };
  }

  private async handleSubscriptionCancelled(event: FastSpringWebhookEvent): Promise<{ success: boolean; message: string }> {
    if (!event.subscription_id) {
      return { success: false, message: 'Missing subscription ID' };
    }

    const { error } = await supabase
      .from('fastspring_subscriptions')
      .update({
        status: 'cancelled',
        cancel_at_period_end: true,
        updated_at: new Date().toISOString()
      })
      .eq('fastspring_subscription_id', event.subscription_id);

    if (error) {
      return { success: false, message: 'Failed to cancel subscription' };
    }

    return { success: true, message: 'Subscription cancelled successfully' };
  }

  private async handlePaymentSucceeded(event: FastSpringWebhookEvent): Promise<{ success: boolean; message: string }> {
    if (!event.subscription_id) {
      return { success: false, message: 'Missing subscription ID' };
    }

    // Clear any grace period and ensure subscription is active
    const { error } = await supabase
      .from('fastspring_subscriptions')
      .update({
        status: 'active',
        grace_period_end: null,
        current_period_start: new Date().toISOString(),
        current_period_end: event.next_bill_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('fastspring_subscription_id', event.subscription_id);

    if (error) {
      return { success: false, message: 'Failed to update subscription' };
    }

    return { success: true, message: 'Payment processed successfully' };
  }

  private async handlePaymentFailed(event: FastSpringWebhookEvent): Promise<{ success: boolean; message: string }> {
    if (!event.subscription_id) {
      return { success: false, message: 'Missing subscription ID' };
    }

    // Set 7-day grace period
    const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { error } = await supabase
      .from('fastspring_subscriptions')
      .update({
        status: 'past_due',
        grace_period_end: gracePeriodEnd.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('fastspring_subscription_id', event.subscription_id);

    if (error) {
      return { success: false, message: 'Failed to update subscription' };
    }

    return { success: true, message: 'Grace period activated for failed payment' };
  }

  private getTierFromProductId(productId: string): Tier {
    if (productId === FASTSPRING_CONFIG.products.core.productId) return 'core';
    if (productId === FASTSPRING_CONFIG.products.studio.productId) return 'studio';
    return 'free';
  }
}

export const fastspringService = new FastSpringService();
