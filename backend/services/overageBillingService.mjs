// Atlas Overage Billing Service
// Cursor-Style Billing System - Overage Calculation and Charging
// Handles mid-month and end-month overage billing

import { logger } from '../lib/simpleLogger.mjs';
import { supabase } from '../config/supabaseClient.mjs';
import { getIncludedCreditsUsdForTier } from '../config/intelligentTierSystem.mjs';
import { getOrCreateCurrentBillingPeriod } from './billingPeriodService.mjs';
import { createOverageInvoice, getFastSpringOrderReceiptUrl } from './fastspringOverageService.mjs';

// Minimum overage amount before creating a charge (in USD)
const OVERAGE_MIN_CHARGE_USD = 20.0;

/**
 * Calculate overage for a billing period
 * 
 * @param {string} userId - User ID
 * @param {string} billingPeriodId - Billing period ID
 * @returns {Promise<Object>} { totalCostUsd, includedCreditsUsd, overageUsd, remainingCreditsUsd }
 */
export async function calculateOverageForPeriod(userId, billingPeriodId) {
  if (!userId || !billingPeriodId) {
    throw new Error('User ID and billing period ID are required');
  }

  try {
    // Get billing period details (includes tier)
    const { data: billingPeriod, error: periodError } = await supabase
      .from('billing_periods')
      .select('tier')
      .eq('id', billingPeriodId)
      .eq('user_id', userId)
      .single();

    if (periodError || !billingPeriod) {
      logger.error('[OverageBilling] Failed to fetch billing period:', periodError);
      throw new Error(`Billing period not found: ${periodError?.message || 'Not found'}`);
    }

    const tier = billingPeriod.tier || 'free';

    // Sum total cost from usage_snapshots for this billing period
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('usage_snapshots')
      .select('total_cost_usd')
      .eq('billing_period_id', billingPeriodId);

    if (snapshotsError) {
      logger.error('[OverageBilling] Failed to fetch usage snapshots:', snapshotsError);
      throw new Error(`Failed to fetch usage: ${snapshotsError.message}`);
    }

    const totalCostUsd = snapshots?.reduce((sum, snapshot) => sum + (parseFloat(snapshot.total_cost_usd) || 0), 0) || 0;
    const includedCreditsUsd = getIncludedCreditsUsdForTier(tier);
    const overageUsd = Math.max(0, totalCostUsd - includedCreditsUsd);
    const remainingCreditsUsd = includedCreditsUsd === -1 ? -1 : Math.max(-Infinity, includedCreditsUsd - totalCostUsd);

    logger.debug(`[OverageBilling] Calculated overage for user ${userId}: totalCost=${totalCostUsd.toFixed(2)}, included=${includedCreditsUsd}, overage=${overageUsd.toFixed(2)}`);

    return {
      totalCostUsd,
      includedCreditsUsd,
      overageUsd,
      remainingCreditsUsd
    };

  } catch (error) {
    logger.error('[OverageBilling] Error calculating overage:', error);
    throw error;
  }
}

/**
 * Create an overage charge record
 * 
 * @param {Object} params - Charge parameters
 * @param {string} params.userId - User ID
 * @param {string} params.billingPeriodId - Billing period ID
 * @param {number} params.overageUsd - Overage amount in USD
 * @param {string} params.description - Charge description
 * @returns {Promise<string>} Charge ID
 */
export async function createOverageCharge({ userId, billingPeriodId, overageUsd, description }) {
  if (!userId || !billingPeriodId || !overageUsd || !description) {
    throw new Error('Missing required parameters for overage charge');
  }

  try {
    // Calculate total tokens for this overage (for description)
    const { data: snapshots } = await supabase
      .from('usage_snapshots')
      .select('input_tokens, output_tokens')
      .eq('billing_period_id', billingPeriodId);

    const totalTokens = snapshots?.reduce((sum, s) => sum + (parseInt(s.input_tokens) || 0) + (parseInt(s.output_tokens) || 0), 0) || 0;

    // Insert overage charge with status='pending'
    const { data: charge, error: insertError } = await supabase
      .from('overage_charges')
      .insert({
        user_id: userId,
        billing_period_id: billingPeriodId,
        description: description,
        tokens: totalTokens,
        cost_usd: overageUsd,
        status: 'pending'
      })
      .select('id')
      .single();

    if (insertError) {
      logger.error('[OverageBilling] Failed to create overage charge:', insertError);
      throw insertError;
    }

    logger.info(`[OverageBilling] ✅ Created overage charge: ${charge.id} for user ${userId}, amount: $${overageUsd.toFixed(2)}`);

    return charge.id;

  } catch (error) {
    logger.error('[OverageBilling] Error creating overage charge:', error);
    throw error;
  }
}

/**
 * Charge an overage via FastSpring
 * 
 * @param {string} chargeId - Overage charge ID
 * @returns {Promise<boolean>} True if charged successfully, false otherwise
 */
export async function chargeOverageViaFastSpring(chargeId) {
  if (!chargeId) {
    throw new Error('Charge ID is required');
  }

  try {
    // Get charge details
    const { data: charge, error: chargeError } = await supabase
      .from('overage_charges')
      .select('*')
      .eq('id', chargeId)
      .single();

    if (chargeError || !charge) {
      logger.error('[OverageBilling] Failed to fetch charge:', chargeError);
      return false;
    }

    // Skip if already charged or failed
    if (charge.status === 'charged') {
      logger.debug(`[OverageBilling] Charge ${chargeId} already charged, skipping`);
      return true;
    }

    if (charge.status === 'failed') {
      logger.debug(`[OverageBilling] Charge ${chargeId} previously failed, skipping`);
      return false;
    }

    // Create FastSpring invoice
    const invoiceResult = await createOverageInvoice({
      userId: charge.user_id,
      amountUsd: parseFloat(charge.cost_usd),
      description: charge.description,
      billingPeriodId: charge.billing_period_id
    });

    if (!invoiceResult || !invoiceResult.orderId) {
      // Update charge status to 'failed'
      await supabase
        .from('overage_charges')
        .update({ status: 'failed' })
        .eq('id', chargeId);

      logger.error(`[OverageBilling] Failed to create FastSpring invoice for charge ${chargeId}`);
      return false;
    }

    // Update charge with FastSpring order ID and status
    const receiptUrl = invoiceResult.receiptUrl || await getFastSpringOrderReceiptUrl(invoiceResult.orderId);

    const { error: updateError } = await supabase
      .from('overage_charges')
      .update({
        fastspring_order_id: invoiceResult.orderId,
        status: 'charged',
        charged_at: new Date().toISOString()
      })
      .eq('id', chargeId);

    if (updateError) {
      logger.error('[OverageBilling] Failed to update charge:', updateError);
      return false;
    }

    logger.info(`[OverageBilling] ✅ Successfully charged overage ${chargeId} via FastSpring: ${invoiceResult.orderId}`);

    // TODO: Send MailerLite email notification (will be added in Phase 5)

    return true;

  } catch (error) {
    logger.error('[OverageBilling] Error charging overage:', error);
    
    // Update charge status to 'failed'
    try {
      await supabase
        .from('overage_charges')
        .update({ status: 'failed' })
        .eq('id', chargeId);
    } catch (updateError) {
      logger.error('[OverageBilling] Failed to update charge status to failed:', updateError);
    }

    return false;
  }
}

/**
 * Run overage billing cycle for all active users
 * 
 * This function:
 * 1. Gets all active Core/Studio users
 * 2. For each user, calculates overage for current billing period
 * 3. Creates overage charges if overage > minimum threshold
 * 4. Processes all pending charges via FastSpring
 * 
 * @returns {Promise<Object>} { processedUsers, chargesCreated, chargesProcessed, errors }
 */
export async function runOverageBillingCycle() {
  logger.info('[OverageBilling] 🚀 Starting overage billing cycle...');

  const results = {
    processedUsers: 0,
    chargesCreated: 0,
    chargesProcessed: 0,
    errors: []
  };

  try {
    // Get all active Core/Studio users
    const { data: activeUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, subscription_tier, subscription_status')
      .in('subscription_tier', ['core', 'studio'])
      .eq('subscription_status', 'active');

    if (usersError) {
      logger.error('[OverageBilling] Failed to fetch active users:', usersError);
      results.errors.push(`Failed to fetch users: ${usersError.message}`);
      return results;
    }

    if (!activeUsers || activeUsers.length === 0) {
      logger.info('[OverageBilling] No active Core/Studio users found');
      return results;
    }

    logger.info(`[OverageBilling] Found ${activeUsers.length} active Core/Studio users`);

    // Process each user
    for (const user of activeUsers) {
      try {
        results.processedUsers++;

        // Get or create current billing period
        const billingPeriodId = await getOrCreateCurrentBillingPeriod(user.id);

        // Calculate overage
        const { overageUsd } = await calculateOverageForPeriod(user.id, billingPeriodId);

        // Check if overage exceeds minimum threshold
        if (overageUsd < OVERAGE_MIN_CHARGE_USD) {
          logger.debug(`[OverageBilling] User ${user.id} overage ${overageUsd.toFixed(2)} below minimum ${OVERAGE_MIN_CHARGE_USD}, skipping`);
          continue;
        }

        // Check if charge already exists for this period
        const { data: existingCharge } = await supabase
          .from('overage_charges')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('billing_period_id', billingPeriodId)
          .in('status', ['pending', 'charged'])
          .maybeSingle();

        if (existingCharge) {
          logger.debug(`[OverageBilling] User ${user.id} already has charge ${existingCharge.id} for this period, skipping`);
          continue;
        }

        // Determine if this is mid-month or end-month charge
        const now = new Date();
        const periodStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
        const daysSincePeriodStart = Math.floor((now - periodStart) / (1000 * 60 * 60 * 24));
        const isMidMonth = daysSincePeriodStart < 15; // First half of month

        const periodMonth = periodStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const description = isMidMonth
          ? `Atlas Usage for ${periodMonth} (Mid-Month Invoice)`
          : `Atlas Usage for ${periodMonth}`;

        // Create overage charge
        const chargeId = await createOverageCharge({
          userId: user.id,
          billingPeriodId,
          overageUsd,
          description
        });

        results.chargesCreated++;
        logger.info(`[OverageBilling] ✅ Created charge ${chargeId} for user ${user.id}: $${overageUsd.toFixed(2)}`);

      } catch (userError) {
        logger.error(`[OverageBilling] Error processing user ${user.id}:`, userError);
        results.errors.push(`User ${user.id}: ${userError.message}`);
        // Continue with next user
      }
    }

    // Process all pending charges via FastSpring
    const { data: pendingCharges, error: pendingError } = await supabase
      .from('overage_charges')
      .select('id')
      .eq('status', 'pending');

    if (pendingError) {
      logger.error('[OverageBilling] Failed to fetch pending charges:', pendingError);
      results.errors.push(`Failed to fetch pending charges: ${pendingError.message}`);
    } else if (pendingCharges && pendingCharges.length > 0) {
      logger.info(`[OverageBilling] Processing ${pendingCharges.length} pending charges...`);

      for (const charge of pendingCharges) {
        try {
          const success = await chargeOverageViaFastSpring(charge.id);
          if (success) {
            results.chargesProcessed++;
          }
        } catch (chargeError) {
          logger.error(`[OverageBilling] Error processing charge ${charge.id}:`, chargeError);
          results.errors.push(`Charge ${charge.id}: ${chargeError.message}`);
        }
      }
    }

    logger.info(`[OverageBilling] ✅ Billing cycle complete: ${results.processedUsers} users, ${results.chargesCreated} charges created, ${results.chargesProcessed} charges processed`);

    return results;

  } catch (error) {
    logger.error('[OverageBilling] Fatal error in billing cycle:', error);
    results.errors.push(`Fatal error: ${error.message}`);
    return results;
  }
}

