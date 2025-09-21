// Atlas Usage Tracking Service
// Daily conversation limits with UTC reset + Revenue protection

import {
    DAILY_API_BUDGET,
    MENTAL_HEALTH_RESOURCES,
    containsCrisisKeywords,
    getRemainingConversations,
    getUsageWarningLevel,
    isWithinDailyLimit,
    tierFeatures
} from '../config/featureAccess';
import { supabase } from '../lib/supabase';
import type { Tier } from '../types/tier';
import { paddleService } from './paddleService';

export interface DailyUsage {
  user_id: string;
  date: string; // YYYY-MM-DD format
  conversations_count: number;
  total_tokens_used: number;
  api_cost_estimate: number;
  tier: Tier;
  created_at: string;
  updated_at: string;
}

export interface UsageCheckResult {
  canProceed: boolean;
  reason?: 'daily_limit' | 'budget_exceeded' | 'maintenance' | 'subscription_required' | 'payment_failed';
  remainingConversations: number | 'unlimited';
  upgradeRequired: boolean;
  suggestedTier?: Tier;
  warningLevel?: 'normal' | 'warning' | 'critical' | 'exceeded';
  crisisBypass?: boolean;
  graceEndsAt?: string;
  mentalHealthResources?: typeof MENTAL_HEALTH_RESOURCES;
}

class UsageTrackingService {
  private readonly COST_PER_TOKEN = {
    'claude-3-haiku': 0.00025 / 1000,     // $0.25 per 1M tokens
    'claude-3-sonnet': 0.003 / 1000,      // $3 per 1M tokens  
    'claude-3-opus': 0.015 / 1000,        // $15 per 1M tokens
  };

  /**
   * Get or create today's usage record for user
   */
  async getTodaysUsage(userId: string, tier: Tier): Promise<DailyUsage> {
    const today = new Date().toISOString().split('T')[0]; // UTC date

    // Try to get existing record
    const { data: existing, error } = await supabase
      .from('daily_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (existing && !error) {
      return existing;
    }

    // Create new record for today
    const newRecord: Omit<DailyUsage, 'created_at' | 'updated_at'> = {
      user_id: userId,
      date: today,
      conversations_count: 0,
      total_tokens_used: 0,
      api_cost_estimate: 0,
      tier
    };

    const { data: created, error: createError } = await supabase
      .from('daily_usage')
      .insert(newRecord)
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create daily usage record: ${createError.message}`);
    }

    return created;
  }

  /**
   * Check if user can start a new conversation with ethical safeguards
   */
  async checkUsageBeforeConversation(
    userId: string, 
    tier: Tier, 
    message?: string
  ): Promise<UsageCheckResult> {
    try {
      // 🚨 ETHICAL SAFEGUARD: Crisis bypass check
      const isCrisisMessage = message && containsCrisisKeywords(message);
      
      if (isCrisisMessage) {
        // Crisis situations bypass usage limits temporarily
        await this.logCrisisBypass(userId, tier, message!);
        
        return {
          canProceed: true,
          remainingConversations: 'unlimited',
          upgradeRequired: false,
          crisisBypass: true,
          mentalHealthResources: MENTAL_HEALTH_RESOURCES
        };
      }

      // Validate subscription status first
      const subscriptionCheck = await paddleService.validateSubscriptionForRequest(userId);
      
      if (!subscriptionCheck.canProceed) {
        return {
          canProceed: false,
          reason: subscriptionCheck.reason === 'cancelled' ? 'subscription_required' : 'payment_failed',
          remainingConversations: 0,
          upgradeRequired: true,
          suggestedTier: tier === 'free' ? 'core' : 'studio',
          graceEndsAt: subscriptionCheck.graceEndsAt
        };
      }

      // Update tier from subscription validation
      tier = subscriptionCheck.tier;
      const usage = await this.getTodaysUsage(userId, tier);
      
      // Get usage warning level for soft limits
      const warningLevel = getUsageWarningLevel(tier, usage.conversations_count);
      
      // Check daily conversation limit
      const withinLimit = isWithinDailyLimit(tier, usage.conversations_count);
      const remaining = getRemainingConversations(tier, usage.conversations_count);

      if (!withinLimit) {
        return {
          canProceed: false,
          reason: 'daily_limit',
          remainingConversations: 0,
          upgradeRequired: true,
          suggestedTier: tier === 'free' ? 'core' : 'studio',
          warningLevel: 'exceeded'
        };
      }

      // Check daily API budget (production safety)
      const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
      const dailyBudget = DAILY_API_BUDGET[environment];
      
      if (usage.api_cost_estimate >= dailyBudget) {
        return {
          canProceed: false,
          reason: 'budget_exceeded',
          remainingConversations: remaining,
          upgradeRequired: false
        };
      }

      // Show soft limit warnings
      const showUpgradePrompt = warningLevel === 'warning' || warningLevel === 'critical';
      
      return {
        canProceed: true,
        remainingConversations: remaining,
        upgradeRequired: showUpgradePrompt && tier !== 'studio',
        suggestedTier: tier === 'free' ? 'core' : 'studio',
        warningLevel
      };
    } catch (error) {
      console.error('Usage check failed:', error);
      
      // Graceful degradation - allow but log
      await this.logError('usage_check_failed', { userId, tier, error: error.message });
      
      return {
        canProceed: true,
        remainingConversations: 'unlimited',
        upgradeRequired: false,
        warningLevel: 'normal'
      };
    }
  }

  /**
   * Record conversation with usage reconciliation logging
   */
  async recordConversation(
    userId: string, 
    tier: Tier, 
    tokensUsed: number, 
    crisisBypass: boolean = false
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const modelName = tierFeatures[tier].model as keyof typeof this.COST_PER_TOKEN;
      const estimatedCost = tokensUsed * this.COST_PER_TOKEN[modelName];

      // Get current values first
      const { data: current, error: fetchError } = await supabase
        .from('daily_usage')
        .select('conversations_count, total_tokens_used, api_cost_estimate')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch current usage: ${fetchError.message}`);
      }

      // Update with calculated values
      const { error } = await supabase
        .from('daily_usage')
        .update({
          conversations_count: (current?.conversations_count || 0) + 1,
          total_tokens_used: (current?.total_tokens_used || 0) + tokensUsed,
          api_cost_estimate: (current?.api_cost_estimate || 0) + estimatedCost,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('date', today);

      if (error) {
        throw new Error(`Failed to record conversation: ${error.message}`);
      }

      // Log for billing analysis and reconciliation
      await this.logUsageEvent('conversation_completed', {
        userId,
        tier,
        tokensUsed,
        estimatedCost,
        crisisBypass,
        date: today
      });
      
      // Log usage attempt for billing reconciliation
      await supabase
        .rpc('log_usage_attempt', {
          p_user_id: userId,
          p_tier: tier,
          p_attempted: true,
          p_allowed: true,
          p_tokens_used: tokensUsed,
          p_api_cost: estimatedCost,
          p_crisis_bypass: crisisBypass
        });

    } catch (error) {
      console.error('Failed to record conversation:', error);
      await this.logError('record_conversation_failed', { userId, tier, tokensUsed, crisisBypass, error: error.message });
    }
  }

  /**
   * Get usage statistics for dashboard
   */
  async getUsageStats(userId: string): Promise<{
    today: DailyUsage;
    thisMonth: { conversations: number; totalCost: number };
    avgDaily: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date().toISOString().slice(0, 7) + '-01'; // First day of month

    // Get today's usage
    const { data: todayUsage } = await supabase
      .from('daily_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    // Get monthly stats
    const { data: monthlyData } = await supabase
      .from('daily_usage')
      .select('conversations_count, api_cost_estimate')
      .eq('user_id', userId)
      .gte('date', monthStart);

    const monthlyStats = monthlyData?.reduce(
      (acc, day) => ({
        conversations: acc.conversations + day.conversations_count,
        totalCost: acc.totalCost + day.api_cost_estimate
      }),
      { conversations: 0, totalCost: 0 }
    ) || { conversations: 0, totalCost: 0 };

    const avgDaily = monthlyData?.length > 0 
      ? monthlyStats.conversations / monthlyData.length 
      : 0;

    return {
      today: todayUsage || {
        user_id: userId,
        date: today,
        conversations_count: 0,
        total_tokens_used: 0,
        api_cost_estimate: 0,
        tier: 'free' as Tier,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      thisMonth: monthlyStats,
      avgDaily
    };
  }

  /**
   * Check if we're approaching daily budget limit
   */
  async checkBudgetHealth(): Promise<{ status: 'ok' | 'warning' | 'critical'; totalCost: number; budget: number }> {
    const today = new Date().toISOString().split('T')[0];
    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    const dailyBudget = DAILY_API_BUDGET[environment];

    const { data } = await supabase
      .from('daily_usage')
      .select('api_cost_estimate')
      .eq('date', today);

    const totalCost = data?.reduce((sum, usage) => sum + usage.api_cost_estimate, 0) || 0;
    const percentage = (totalCost / dailyBudget) * 100;

    let status: 'ok' | 'warning' | 'critical' = 'ok';
    if (percentage >= 90) status = 'critical';
    else if (percentage >= 75) status = 'warning';

    return { status, totalCost, budget: dailyBudget };
  }

  /**
   * Reset usage at midnight UTC (called by cron job)
   */
  async resetDailyUsage(): Promise<void> {
    // This is handled automatically by date-based records
    // Old records remain for billing analysis
    console.log('Daily usage reset handled by date-based records');
  }

  /**
   * Log usage events for billing analysis
   */
  private async logUsageEvent(event: string, data: any): Promise<void> {
    try {
      await supabase
        .from('usage_logs')
        .insert({
          event,
          data,
          timestamp: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log usage event:', error);
    }
  }

  /**
   * Log crisis bypass for ethical safeguarding
   */
  private async logCrisisBypass(userId: string, tier: Tier, message: string): Promise<void> {
    try {
      await this.logUsageEvent('crisis_bypass_activated', {
        userId,
        tier,
        message: message.substring(0, 200), // Truncate for privacy
        timestamp: new Date().toISOString()
      });
      
      // Also log in usage reconciliation
      await supabase
        .rpc('log_usage_attempt', {
          p_user_id: userId,
          p_tier: tier,
          p_attempted: true,
          p_allowed: true,
          p_tokens_used: 0,
          p_api_cost: 0,
          p_crisis_bypass: true
        });
        
      console.log(`🚨 Crisis bypass activated for user ${userId}`);
    } catch (error) {
      console.error('Failed to log crisis bypass:', error);
    }
  }

  /**
   * Log blocked usage attempt for reconciliation
   */
  async logBlockedAttempt(userId: string, tier: Tier, reason: string): Promise<void> {
    try {
      await supabase
        .rpc('log_usage_attempt', {
          p_user_id: userId,
          p_tier: tier,
          p_attempted: true,
          p_allowed: false,
          p_tokens_used: 0,
          p_api_cost: 0,
          p_crisis_bypass: false
        });
        
      await this.logUsageEvent('conversation_blocked', {
        userId,
        tier,
        reason,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log blocked attempt:', error);
    }
  }

  /**
   * Log errors for monitoring
   */
  private async logError(error: string, data: any): Promise<void> {
    try {
      await supabase
        .from('error_logs')
        .insert({
          error,
          data,
          timestamp: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to log error:', error);
    }
  }
}

export const usageTrackingService = new UsageTrackingService();
