// backend/services/signupQueueProcessor.mjs

import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/simpleLogger.mjs';
import { syncMailerLiteOnSignup } from './userOnboardingService.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * Process pending user signups in the queue
 * This ensures MailerLite sync happens even if the initial trigger fails
 */
export async function processSignupQueue() {
  if (!supabase) {
    logger.error('[SignupQueue] Supabase not configured');
    return { processed: 0, errors: [] };
  }

  const results = {
    processed: 0,
    errors: []
  };

  try {
    // Fetch unprocessed signups (limit to prevent overwhelming the system)
    const { data: pendingSignups, error: fetchError } = await supabase
      .from('user_signup_queue')
      .select('*')
      .eq('processed', false)
      .lt('error_count', 3) // Skip items that have failed 3+ times
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      logger.error('[SignupQueue] Failed to fetch pending signups:', fetchError);
      results.errors.push({ type: 'fetch', error: fetchError.message });
      return results;
    }

    if (!pendingSignups || pendingSignups.length === 0) {
      logger.debug('[SignupQueue] No pending signups to process');
      return results;
    }

    logger.info(`[SignupQueue] Processing ${pendingSignups.length} pending signups`);

    // Process each signup
    for (const signup of pendingSignups) {
      try {
        // Call the MailerLite sync
        await syncMailerLiteOnSignup(signup.user_id);

        // Mark as processed
        const { error: updateError } = await supabase
          .from('user_signup_queue')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            last_error: null
          })
          .eq('id', signup.id);

        if (updateError) {
          logger.error(`[SignupQueue] Failed to mark signup ${signup.id} as processed:`, updateError);
          results.errors.push({ userId: signup.user_id, error: updateError.message });
        } else {
          results.processed++;
          logger.debug(`[SignupQueue] ✅ Processed signup for ${signup.email}`);
        }
      } catch (syncError) {
        // Increment error count and log the error
        const errorMessage = syncError.message || 'Unknown error';
        
        const { error: updateError } = await supabase
          .from('user_signup_queue')
          .update({
            error_count: signup.error_count + 1,
            last_error: errorMessage
          })
          .eq('id', signup.id);

        if (updateError) {
          logger.error(`[SignupQueue] Failed to update error count for ${signup.id}:`, updateError);
        }

        logger.error(`[SignupQueue] Failed to sync ${signup.email} to MailerLite:`, errorMessage);
        results.errors.push({ userId: signup.user_id, email: signup.email, error: errorMessage });
      }
    }

    logger.info(`[SignupQueue] ✅ Processed ${results.processed} signups, ${results.errors.length} errors`);
  } catch (error) {
    logger.error('[SignupQueue] Unexpected error:', error);
    results.errors.push({ type: 'unexpected', error: error.message });
  }

  return results;
}

/**
 * Clean up old processed records (maintenance)
 */
export async function cleanupProcessedSignups() {
  if (!supabase) {
    return { deleted: 0, error: null };
  }

  try {
    // Delete processed records older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('user_signup_queue')
      .delete()
      .eq('processed', true)
      .lt('processed_at', thirtyDaysAgo.toISOString())
      .select('id');

    if (error) {
      logger.error('[SignupQueue] Cleanup failed:', error);
      return { deleted: 0, error: error.message };
    }

    const deletedCount = data?.length || 0;
    if (deletedCount > 0) {
      logger.info(`[SignupQueue] Cleaned up ${deletedCount} old processed records`);
    }

    return { deleted: deletedCount, error: null };
  } catch (error) {
    logger.error('[SignupQueue] Cleanup error:', error);
    return { deleted: 0, error: error.message };
  }
}
