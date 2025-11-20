// backend/services/userOnboardingService.mjs

import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/simpleLogger.mjs';
import { notificationService } from './notificationService.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * Send welcome notification to new users
 */
export async function sendWelcomeNotification(userId) {
  if (!userId) {
    logger.debug('[UserOnboarding] Missing userId - skipping welcome notification');
    return;
  }

  try {
    await notificationService.sendWelcomeNotification(userId);
    logger.debug('[UserOnboarding] ✅ Welcome notification sent:', userId);
  } catch (error) {
    logger.error('[UserOnboarding] Failed to send welcome notification:', error);
    // Don't throw - welcome notification failure shouldn't break signup
  }
}

/**
 * Sync new user to MailerLite
 */
export async function syncMailerLiteOnSignup(userId) {
  if (!userId) {
    logger.debug('[UserOnboarding] Missing userId - skipping MailerLite sync');
    return;
  }

  const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
  if (!MAILERLITE_API_KEY) {
    logger.debug('[UserOnboarding] MailerLite not configured - skipping sync');
    return;
  }

  if (!supabase) {
    logger.debug('[UserOnboarding] Supabase not configured - skipping MailerLite sync');
    return;
  }

  try {
    // Get user profile with email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, subscription_tier')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.email) {
      logger.debug('[UserOnboarding] Could not fetch user profile for MailerLite sync:', profileError);
      return;
    }

    const email = profile.email;
    const tier = profile.subscription_tier || 'free';

    // Create subscriber in MailerLite
    const subscriberData = {
      email,
      fields: {
        tier,
        signup_date: new Date().toISOString(),
        subscription_status: 'active',
        last_active: new Date().toISOString(),
      },
      resubscribe: true,
    };

    const response = await fetch('https://api.mailerlite.com/api/v2/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
      },
      body: JSON.stringify(subscriberData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`[UserOnboarding] MailerLite subscriber creation failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
      return;
    }

    // Trigger signup event
    await fetch(`https://api.mailerlite.com/api/v2/subscribers/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
      },
      body: JSON.stringify({
        fields: {
          last_event: 'user_signup',
          last_event_time: new Date().toISOString(),
        },
      }),
    }).catch(error => {
      logger.debug('[UserOnboarding] MailerLite event update failed (non-critical):', error);
    });

    // Add to new_users group
    const tierGroups = {
      free: 'atlas_free_users',
      core: 'core_subscribers',
      studio: 'studio_subscribers',
    };

    if (tierGroups[tier]) {
      await fetch(`https://api.mailerlite.com/api/v2/groups/${tierGroups[tier]}/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
        },
        body: JSON.stringify({ email }),
      }).catch(error => {
        logger.debug('[UserOnboarding] MailerLite group add failed (non-critical):', error);
      });
    }

    logger.debug(`[UserOnboarding] ✅ MailerLite synced for new user ${email}`);
  } catch (error) {
    logger.error('[UserOnboarding] MailerLite sync error:', error);
    // Don't throw - MailerLite failures shouldn't break signup
  }
}








