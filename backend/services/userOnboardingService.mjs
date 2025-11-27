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

    // ✅ FIX: Add to tier-specific group (using group IDs)
    const tierGroups = {
      free: 'atlas_free_users',
      core: 'core_subscribers',
      studio: 'studio_subscribers',
    };

    // ✅ FIX: Helper to get group ID from name (with better error handling)
    const getGroupId = async (groupName) => {
      // Check environment variables first
      const GROUP_ID_MAP = {
        'atlas_free_users': process.env.MAILERLITE_GROUP_FREE_ID,
        'core_subscribers': process.env.MAILERLITE_GROUP_CORE_ID,
        'studio_subscribers': process.env.MAILERLITE_GROUP_STUDIO_ID,
      };
      
      if (GROUP_ID_MAP[groupName]) {
        logger.debug(`[UserOnboarding] Using env var for group ${groupName}: ${GROUP_ID_MAP[groupName]}`);
        return GROUP_ID_MAP[groupName];
      }
      
      // Fallback: fetch from API
      try {
        logger.debug(`[UserOnboarding] Fetching group ID for ${groupName} from MailerLite API...`);
        const groupsResponse = await fetch('https://api.mailerlite.com/api/v2/groups', {
          headers: {
            'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
          },
        });
        
        if (groupsResponse.ok) {
          const groupsData = await groupsResponse.json();
          const groups = groupsData.data || groupsData; // Handle different response formats
          const group = Array.isArray(groups) ? groups.find(g => g.name === groupName) : null;
          
          if (group) {
            logger.info(`[UserOnboarding] ✅ Found group ID for ${groupName}: ${group.id}`);
            return group.id;
          } else {
            logger.warn(`[UserOnboarding] ⚠️ Group ${groupName} not found in MailerLite. Available groups:`, 
              Array.isArray(groups) ? groups.map(g => g.name).join(', ') : 'unknown');
          }
        } else {
          const errorText = await groupsResponse.text();
          logger.warn(`[UserOnboarding] ⚠️ Failed to fetch groups: ${groupsResponse.status} - ${errorText}`);
        }
      } catch (error) {
        logger.error(`[UserOnboarding] ❌ Error fetching group ID for ${groupName}:`, error.message || error);
      }
      
      return null;
    };

    if (tierGroups[tier]) {
      const groupName = tierGroups[tier];
      const groupId = await getGroupId(groupName);
      
      if (groupId) {
        // ✅ FIX: Use group ID instead of group name
        logger.info(`[UserOnboarding] Adding ${email} to group ${groupName} (ID: ${groupId})...`);
        const addResponse = await fetch(`https://api.mailerlite.com/api/v2/groups/${groupId}/subscribers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MailerLite-ApiKey': MAILERLITE_API_KEY,
          },
          body: JSON.stringify({ email }),
        });
        
        if (addResponse.ok) {
          logger.info(`[UserOnboarding] ✅ Successfully added ${email} to group ${groupName} (ID: ${groupId}) - welcome email automation will trigger`);
        } else {
          const errorData = await addResponse.json().catch(() => ({ message: 'Unknown error' }));
          logger.error(`[UserOnboarding] ❌ Failed to add ${email} to group ${groupName}: ${addResponse.status} - ${errorData.message || JSON.stringify(errorData)}`);
          
          // ✅ CRITICAL: If group add fails, welcome email won't send - log this prominently
          logger.error(`[UserOnboarding] 🚨 WELCOME EMAIL WON'T SEND - User ${email} not added to ${groupName} group`);
        }
      } else {
        logger.error(`[UserOnboarding] ❌ Group ${groupName} not found - subscriber created but NOT added to group. Welcome email automation will NOT trigger.`);
        logger.error(`[UserOnboarding] 💡 Fix: Set MAILERLITE_GROUP_FREE_ID env var or ensure group exists in MailerLite dashboard`);
      }
    } else {
      logger.warn(`[UserOnboarding] ⚠️ No group mapping for tier ${tier} - welcome email may not trigger`);
    }

    logger.debug(`[UserOnboarding] ✅ MailerLite synced for new user ${email}`);
    
    // ✅ LOG EMAIL: Log welcome email trigger (MailerLite automation will send it)
    // MailerLite automations trigger automatically when subscribers are added, so we log the trigger
    if (supabase) {
      try {
        await supabase
          .from('email_logs')
          .insert({
            flow_type: 'welcome',
            recipient_email: email,
            recipient_user_id: userId,
            sent_at: new Date().toISOString(),
            status: 'triggered', // Will be updated to 'sent' when MailerLite webhook confirms
            metadata: {
              source: 'signup_sync',
              tier: tier,
              group: tierGroups[tier] || null,
            }
          })
          .catch(err => {
            logger.debug('[UserOnboarding] Failed to log welcome email trigger (non-critical):', err.message);
          });
      } catch (logError) {
        logger.debug('[UserOnboarding] Email logging error (non-critical):', logError);
      }
    }
  } catch (error) {
    logger.error('[UserOnboarding] MailerLite sync error:', error);
    // Don't throw - MailerLite failures shouldn't break signup
  }
}








