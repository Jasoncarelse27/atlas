// Atlas Paddle Integration Service
// Subscription management, webhooks, and payment processing

import { PADDLE_CONFIG } from '../config/featureAccess';
import { supabase } from '../lib/supabase';
import type { Tier } from '../types/tier';

export interface PaddleSubscription {
  id: string;
  user_id: string;
  paddle_subscription_id: string;
  paddle_plan_id: string;
  tier: Tier;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled' | 'unpaid';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  grace_period_end?: string; // 7-day grace period for failed payments
  created_at: string;
  updated_at: string;
}

export interface PaddleWebhookEvent {
  alert_id: string;
  alert_name: string;
  subscription_id?: string;
  subscription_plan_id?: string;
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
  p_signature?: string;
}

export interface SubscriptionCache {
  userId: string;
  tier: Tier;
  status: string;
  isActive: boolean;
  expiresAt: number;
  cachedAt: number;
}

class PaddleService {
  private subscriptionCache = new Map<string, SubscriptionCache>();

  /**
   * Get user's subscription status with 5-minute caching
   */
  async getUserSubscription(userId: string): Promise<{ tier: Tier; isActive: boolean; subscription?: PaddleSubscription }> {
    // Check cache first
    const cached = this.subscriptionCache.get(userId);
    if (cached && Date.now() < cached.expiresAt) {
      return {
        tier: cached.tier,
        isActive: cached.isActive
      };
    }

    try {
      const { data: subscription, error } = await supabase
        .from('paddle_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      let tier: Tier = 'free';
      let isActive = false;

      if (subscription && !error) {
        tier = subscription.tier;
        isActive = this.isSubscriptionActive(subscription);
      }

      // Cache the result
      this.subscriptionCache.set(userId, {
        userId,
        tier,
        status: subscription?.status || 'none',
        isActive,
        expiresAt: Date.now() + PADDLE_CONFIG.cacheTimeout,
        cachedAt: Date.now()
      });

      return { tier, isActive, subscription };

    } catch (error) {
      console.error('Failed to get user subscription:', error);
      
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
   * Handle Paddle webhook events
   */
  async handleWebhookEvent(event: PaddleWebhookEvent): Promise<{ success: boolean; message: string }> {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(event)) {
        return { success: false, message: 'Invalid webhook signature' };
      }

      switch (event.alert_name) {
        case 'subscription_created':
          return await this.handleSubscriptionCreated(event);
        
        case 'subscription_updated':
          return await this.handleSubscriptionUpdated(event);
        
        case 'subscription_cancelled':
          return await this.handleSubscriptionCancelled(event);
        
        case 'subscription_payment_succeeded':
          return await this.handlePaymentSucceeded(event);
        
        case 'subscription_payment_failed':
          return await this.handlePaymentFailed(event);
        
        default:
          console.log(`Unhandled webhook event: ${event.alert_name}`);
          return { success: true, message: 'Event acknowledged but not processed' };
      }

    } catch (error) {
      console.error('Webhook processing error:', error);
      return { success: false, message: 'Webhook processing failed' };
    }
  }

  /**
   * Create Paddle checkout URL for subscription using live API
   */
  async createCheckoutUrl(userId: string, tier: Tier, email: string): Promise<string> {
    if (tier === 'free') {
      throw new Error('Cannot create checkout for free tier');
    }

    const product = PADDLE_CONFIG.products[tier];
    if (!product) {
      throw new Error(`No product configuration for tier: ${tier}`);
    }

    try {
      // Call Paddle API to create checkout session
      const response = await fetch('/api/paddle/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          tier,
          email,
          priceId: product.priceId,
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
      console.error('Checkout creation error:', error);
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
        .from('paddle_subscriptions')
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('paddle_subscription_id', subscription.paddle_subscription_id);

      if (error) {
        throw error;
      }

      // Clear cache
      this.subscriptionCache.delete(userId);

      // TODO: Call Paddle API to cancel subscription
      
      return { success: true, message: 'Subscription will be cancelled at the end of the current period' };

    } catch (error) {
      console.error('Subscription cancellation error:', error);
      return { success: false, message: 'Failed to cancel subscription' };
    }
  }

  /**
   * Reactivate cancelled subscription
   */
  async reactivateSubscription(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('paddle_subscriptions')
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
      console.error('Subscription reactivation error:', error);
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
        .from('paddle_subscriptions')
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
          analytics.subscriptionsByTier[sub.tier]++;
          
          if (sub.status === 'active') {
            if (sub.tier === 'core') analytics.monthlyRecurringRevenue += 19.99;
            if (sub.tier === 'studio') analytics.monthlyRecurringRevenue += 179.99;
          }
        }

        // Calculate churn rate (simplified)
        const recentCancellations = subscriptions.filter(s => 
          s.status === 'cancelled' && 
          new Date(s.updated_at) > thirtyDaysAgo
        ).length;
        
        analytics.churnRate = analytics.totalSubscriptions > 0 
          ? (recentCancellations / analytics.totalSubscriptions) * 100 
          : 0;
      }

      return analytics;

    } catch (error) {
      console.error('Analytics calculation error:', error);
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

  private isSubscriptionActive(subscription: PaddleSubscription): boolean {
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    
    return subscription.status === 'active' && now < periodEnd;
  }

  private verifyWebhookSignature(event: PaddleWebhookEvent): boolean {
    // TODO: Implement proper Paddle webhook signature verification
    // This is a simplified version - in production, you'd verify the p_signature
    return true;
  }

  private async handleSubscriptionCreated(event: PaddleWebhookEvent): Promise<{ success: boolean; message: string }> {
    if (!event.subscription_id || !event.subscription_plan_id) {
      return { success: false, message: 'Missing subscription data' };
    }

    const passthrough = event.user_id ? JSON.parse(event.user_id) : null;
    if (!passthrough?.userId) {
      return { success: false, message: 'Missing user ID in passthrough data' };
    }

    const tier = this.getTierFromPlanId(event.subscription_plan_id);
    
    const subscription: Omit<PaddleSubscription, 'id' | 'created_at' | 'updated_at'> = {
      user_id: passthrough.userId,
      paddle_subscription_id: event.subscription_id,
      paddle_plan_id: event.subscription_plan_id,
      tier,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: event.next_bill_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      cancel_at_period_end: false
    };

    const { error } = await supabase
      .from('paddle_subscriptions')
      .insert(subscription);

    if (error) {
      console.error('Failed to create subscription:', error);
      return { success: false, message: 'Failed to create subscription record' };
    }

    // Clear cache
    this.subscriptionCache.delete(passthrough.userId);

    return { success: true, message: 'Subscription created successfully' };
  }

  private async handleSubscriptionUpdated(event: PaddleWebhookEvent): Promise<{ success: boolean; message: string }> {
    if (!event.subscription_id) {
      return { success: false, message: 'Missing subscription ID' };
    }

    const updates: Partial<PaddleSubscription> = {
      updated_at: new Date().toISOString()
    };

    if (event.status) {
      updates.status = event.status as PaddleSubscription['status'];
    }

    if (event.next_bill_date) {
      updates.current_period_end = event.next_bill_date;
    }

    const { error } = await supabase
      .from('paddle_subscriptions')
      .update(updates)
      .eq('paddle_subscription_id', event.subscription_id);

    if (error) {
      console.error('Failed to update subscription:', error);
      return { success: false, message: 'Failed to update subscription' };
    }

    return { success: true, message: 'Subscription updated successfully' };
  }

  private async handleSubscriptionCancelled(event: PaddleWebhookEvent): Promise<{ success: boolean; message: string }> {
    if (!event.subscription_id) {
      return { success: false, message: 'Missing subscription ID' };
    }

    const { error } = await supabase
      .from('paddle_subscriptions')
      .update({
        status: 'cancelled',
        cancel_at_period_end: true,
        updated_at: new Date().toISOString()
      })
      .eq('paddle_subscription_id', event.subscription_id);

    if (error) {
      console.error('Failed to cancel subscription:', error);
      return { success: false, message: 'Failed to cancel subscription' };
    }

    return { success: true, message: 'Subscription cancelled successfully' };
  }

  private async handlePaymentSucceeded(event: PaddleWebhookEvent): Promise<{ success: boolean; message: string }> {
    if (!event.subscription_id) {
      return { success: false, message: 'Missing subscription ID' };
    }

    // Clear any grace period and ensure subscription is active
    const { error } = await supabase
      .from('paddle_subscriptions')
      .update({
        status: 'active',
        grace_period_end: null,
        current_period_start: new Date().toISOString(),
        current_period_end: event.next_bill_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('paddle_subscription_id', event.subscription_id);

    if (error) {
      console.error('Failed to update subscription after payment:', error);
      return { success: false, message: 'Failed to update subscription' };
    }

    return { success: true, message: 'Payment processed successfully' };
  }

  private async handlePaymentFailed(event: PaddleWebhookEvent): Promise<{ success: boolean; message: string }> {
    if (!event.subscription_id) {
      return { success: false, message: 'Missing subscription ID' };
    }

    // Set 7-day grace period
    const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { error } = await supabase
      .from('paddle_subscriptions')
      .update({
        status: 'past_due',
        grace_period_end: gracePeriodEnd.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('paddle_subscription_id', event.subscription_id);

    if (error) {
      console.error('Failed to update subscription after payment failure:', error);
      return { success: false, message: 'Failed to update subscription' };
    }

    return { success: true, message: 'Grace period activated for failed payment' };
  }

  private getTierFromPlanId(planId: string): Tier {
    if (planId === PADDLE_CONFIG.products.core.planId) return 'core';
    if (planId === PADDLE_CONFIG.products.studio.planId) return 'studio';
    return 'free';
  }
}

export const paddleService = new PaddleService();
