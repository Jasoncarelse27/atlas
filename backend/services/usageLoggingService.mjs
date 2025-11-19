// Atlas Usage Logging Service
// Cursor-Style Billing System - Token Usage Tracking
// Logs token usage to usage_logs and updates usage_snapshots for billing

import { logger } from '../lib/simpleLogger.mjs';
import { calculateTokenCostUsd } from '../config/intelligentTierSystem.mjs';
import { supabase } from '../config/supabaseClient.mjs';

/**
 * Log token usage for billing system
 * 
 * This function:
 * 1. Inserts raw usage into usage_logs table (existing columns)
 * 2. Calls Postgres function to upsert aggregated usage_snapshots
 * 
 * Error handling: Never throws - logs errors but doesn't break the request
 * 
 * @param {Object} params - Usage parameters
 * @param {string} params.userId - User ID
 * @param {string} params.model - Model name (e.g. 'claude-sonnet-4-5-20250929')
 * @param {number} params.inputTokens - Input token count
 * @param {number} params.outputTokens - Output token count
 * @param {string} [params.conversationId] - Conversation ID (optional, for rollback support)
 * @param {string} [params.messageId] - Message ID (optional, for rollback support)
 * @returns {Promise<void>}
 */
export async function logTokenUsage({ 
  userId, 
  model, 
  inputTokens, 
  outputTokens, 
  conversationId = null, 
  messageId = null 
}) {
  if (!userId || !model) {
    logger.warn('[UsageLogging] Missing required parameters:', { userId, model });
    return;
  }

  try {
    // Calculate cost using billing system function
    const costUsd = calculateTokenCostUsd({ model, inputTokens, outputTokens });
    const totalTokens = inputTokens + outputTokens;

    // 1) Insert into usage_logs (raw log) - using existing columns
    const { error: logError } = await supabase
      .from('usage_logs')
      .insert({
        user_id: userId,
        event: 'chat_message', // or 'image_analysis', 'file_analysis', etc.
        tier: null, // Will be set by trigger or backend logic
        feature: 'chat', // Can be 'chat', 'image', 'voice', etc.
        tokens_used: totalTokens,
        estimated_cost: costUsd,
        metadata: {
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          conversation_id: conversationId,
          message_id: messageId
        },
        created_at: new Date().toISOString()
      });

    if (logError) {
      logger.error('[UsageLogging] Failed to insert into usage_logs:', logError);
      // Continue anyway - don't break the request
    } else {
      logger.debug(`[UsageLogging] ✅ Logged ${totalTokens} tokens (${inputTokens} in, ${outputTokens} out) to usage_logs, cost: $${costUsd.toFixed(6)}`);
    }

    // 2) Upsert into usage_snapshots (aggregated) via Postgres function
    const { data: billingPeriodId, error: snapshotError } = await supabase
      .rpc('upsert_usage_snapshot', {
        p_user_id: userId,
        p_model: model,
        p_input_tokens: inputTokens,
        p_output_tokens: outputTokens,
        p_cost_usd: costUsd
      });

    if (snapshotError) {
      logger.error('[UsageLogging] Failed to upsert usage_snapshot:', snapshotError);
      // Continue anyway - don't break the request
    } else {
      logger.debug(`[UsageLogging] ✅ Updated usage_snapshot for billing_period_id: ${billingPeriodId}`);
    }

  } catch (error) {
    // Catch-all error handler - never throw, just log
    logger.error('[UsageLogging] Unexpected error logging token usage:', error);
    // Don't throw - billing logging failures should not break chat
  }
}

