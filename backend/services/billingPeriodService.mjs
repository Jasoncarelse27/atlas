// Atlas Billing Period Service
// Cursor-Style Billing System - Billing Period Management
// Manages monthly billing cycles per user

import { logger } from '../lib/simpleLogger.mjs';
import { supabase } from '../config/supabaseClient.mjs';

/**
 * Get or create current billing period for a user
 * 
 * Billing periods run from the first day of the month to the first day of the next month (UTC)
 * 
 * @param {string} userId - User ID
 * @returns {Promise<string>} billing_period_id (UUID)
 */
export async function getOrCreateCurrentBillingPeriod(userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    // Calculate current billing period boundaries (UTC)
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    // Try to find existing billing period
    const { data: existingPeriod, error: findError } = await supabase
      .from('billing_periods')
      .select('id, tier')
      .eq('user_id', userId)
      .eq('period_start', periodStart.toISOString())
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows returned (expected)
      logger.error('[BillingPeriod] Error finding billing period:', findError);
      throw findError;
    }

    // If period exists, return its ID
    if (existingPeriod) {
      logger.debug(`[BillingPeriod] Found existing billing period: ${existingPeriod.id} for user ${userId}`);
      return existingPeriod.id;
    }

    // Period doesn't exist - get user's current tier and create new period
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (profileError) {
      logger.error('[BillingPeriod] Error fetching user tier:', profileError);
      throw new Error(`Failed to fetch user tier: ${profileError.message}`);
    }

    const tier = profile?.subscription_tier || 'free';

    // Create new billing period
    const { data: newPeriod, error: createError } = await supabase
      .from('billing_periods')
      .insert({
        user_id: userId,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        tier: tier
      })
      .select('id')
      .single();

    if (createError) {
      // Handle race condition: another request might have created the period
      if (createError.code === '23505') { // Unique violation
        logger.debug('[BillingPeriod] Period already exists (race condition), fetching...');
        const { data: racePeriod } = await supabase
          .from('billing_periods')
          .select('id')
          .eq('user_id', userId)
          .eq('period_start', periodStart.toISOString())
          .single();
        
        if (racePeriod) {
          return racePeriod.id;
        }
      }
      
      logger.error('[BillingPeriod] Error creating billing period:', createError);
      throw createError;
    }

    logger.info(`[BillingPeriod] ✅ Created new billing period: ${newPeriod.id} for user ${userId} (tier: ${tier})`);
    return newPeriod.id;

  } catch (error) {
    logger.error('[BillingPeriod] Unexpected error:', error);
    throw error;
  }
}

/**
 * Get billing period by ID
 * 
 * @param {string} billingPeriodId - Billing period ID
 * @returns {Promise<Object|null>} Billing period object or null
 */
export async function getBillingPeriodById(billingPeriodId) {
  if (!billingPeriodId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('billing_periods')
      .select('*')
      .eq('id', billingPeriodId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      logger.error('[BillingPeriod] Error fetching billing period:', error);
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('[BillingPeriod] Unexpected error:', error);
    throw error;
  }
}

