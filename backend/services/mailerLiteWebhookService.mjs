import crypto from 'crypto';
import { supabase } from '../config/supabaseClient.mjs';
import { logger } from '../lib/simpleLogger.mjs';

const MAILERLITE_WEBHOOK_SECRET = process.env.MAILERLITE_WEBHOOK_SECRET;

/**
 * Log email event to email_logs table
 */
async function logEmailEvent(event, data, userId, email) {
  try {
    // Map MailerLite events to flow_type (using actual MailerLite event names)
    const flowTypeMap = {
      'campaign.sent': data.campaign_name || 'campaign',
      'campaign.open': data.campaign_name || 'campaign',
      'campaign.click': data.campaign_name || 'campaign',
      'subscriber.automation_triggered': data.automation_name || 'automation',
      'subscriber.automation_completed': data.automation_name || 'automation',
    };
    
    // Determine flow_type from campaign/automation name or event
    let flowType = flowTypeMap[event] || 'unknown';
    
    // Try to extract flow type from campaign/automation name
    if (data.campaign_name) {
      const campaignName = data.campaign_name.toLowerCase();
      if (campaignName.includes('welcome')) flowType = 'welcome';
      else if (campaignName.includes('upgrade') || campaignName.includes('nudge')) flowType = 'upgrade_nudge';
      else if (campaignName.includes('inactivity') || campaignName.includes('reminder')) flowType = 'inactivity_reminder';
      else if (campaignName.includes('weekly') || campaignName.includes('summary')) flowType = 'weekly_summary';
    }
    
    // Try to extract flow type from automation name
    if (data.automation_name && flowType === 'automation') {
      const automationName = data.automation_name.toLowerCase();
      if (automationName.includes('welcome')) flowType = 'welcome';
      else if (automationName.includes('upgrade') || automationName.includes('nudge')) flowType = 'upgrade_nudge';
      else if (automationName.includes('inactivity') || automationName.includes('reminder')) flowType = 'inactivity_reminder';
      else if (automationName.includes('weekly') || automationName.includes('summary')) flowType = 'weekly_summary';
    }
    
    // Determine status based on event type
    let status = 'sent';
    if (event === 'campaign.open') status = 'opened';
    else if (event === 'campaign.click') status = 'clicked';
    else if (event === 'subscriber.automation_triggered') status = 'triggered';
    else if (event === 'subscriber.automation_completed') status = 'sent';
    
    const { error } = await supabase
      .from('email_logs')
      .insert({
        flow_type: flowType,
        recipient_email: email,
        recipient_name: data.name || data.subscriber?.name || null,
        recipient_user_id: userId,
        message_id: data.message_id || data.id || data.campaign_id || null,
        sent_at: data.sent_at || data.timestamp || new Date().toISOString(),
        status: status,
        metadata: {
          event: event,
          campaign_id: data.campaign_id,
          automation_id: data.automation_id,
          campaign_name: data.campaign_name,
          automation_name: data.automation_name,
        }
      });
    
    if (error) {
      logger.warn('[MailerLite] Failed to log email event:', error.message);
    } else {
      logger.debug(`[MailerLite] ✅ Logged email event: ${event} for ${email}`);
    }
  } catch (error) {
    logger.warn('[MailerLite] Error logging email event:', error.message);
  }
}

export async function handleMailerLiteWebhook(req, res) {
  try {
    // ✅ CRITICAL: Use raw body for signature verification (same as FastSpring)
    // MailerLite sends raw JSON bytes, and signature is computed from those exact bytes
    const rawBody = req.body.toString('utf8');
    
    // Verify signature if configured
    if (MAILERLITE_WEBHOOK_SECRET) {
      const signature = req.headers['x-mailerlite-signature'];
      
      if (!signature) {
        logger.error('[MailerLite] ❌ Missing X-MailerLite-Signature header');
        return res.status(401).send('missing signature');
      }
      
      const computed = crypto
        .createHmac('sha256', MAILERLITE_WEBHOOK_SECRET.trim())
        .update(rawBody)
        .digest('hex');
      
      if (signature !== computed) {
        logger.error('[MailerLite] ❌ Invalid signature', {
          received: signature?.substring(0, 20) + '...',
          computed: computed?.substring(0, 20) + '...',
          bodyLength: rawBody.length
        });
        return res.status(401).send('invalid signature');
      }
    }
    
    // Parse JSON from raw body
    const payload = JSON.parse(rawBody);
    const { event, data } = payload || {};
    
    if (!event) {
      logger.error('[MailerLite] ❌ No event in webhook');
      return res.status(400).send('no event');
    }
    
    logger.info(`[MailerLite] 🔔 Webhook event: ${event}`);
    
    const email = data?.email;
    if (!email) {
      logger.warn('[MailerLite] ⚠️ No email in webhook data');
      return res.status(200).send('ok');
    }
    
    // Find user by email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();
    
    if (profileError) {
      logger.error('[MailerLite] Database error:', profileError);
      return res.status(200).send('ok');
    }
    
    if (!profile) {
      logger.warn(`[MailerLite] ⚠️ Profile not found for email: ${email}`);
      return res.status(200).send('ok');
    }
    
    switch (event) {
      case 'subscriber.created':
      case 'subscriber.updated': {
        // Update profile - sync email if changed
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            email: email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
        
        if (updateError) {
          logger.error('[MailerLite] Failed to update profile:', updateError);
        } else {
          logger.info(`[MailerLite] ✅ Updated profile for ${email}`);
        }
        break;
      }
        
      case 'subscriber.unsubscribed': {
        // Mark as unsubscribed (if column exists, otherwise just log)
        const { error: unsubError } = await supabase
          .from('profiles')
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
        
        if (unsubError) {
          logger.debug('[MailerLite] Note: mailerlite_status column may not exist - this is OK');
        }
        
        logger.info(`[MailerLite] ✅ Subscriber ${email} unsubscribed`);
        break;
      }
        
      case 'subscriber.added_to_group':
      case 'subscriber.removed_from_group':
        // Log group changes but don't update database (no column for this)
        logger.debug(`[MailerLite] Group change for ${email}: ${event}`);
        break;
      
      // ✅ EMAIL EVENT LOGGING: Log email sends/deliveries/opens
      case 'campaign.sent':
      case 'campaign.open':
      case 'campaign.click':
      case 'subscriber.automation_triggered':
      case 'subscriber.automation_completed': {
        await logEmailEvent(event, data, profile.id, email);
        break;
      }
        
      default:
        logger.debug(`[MailerLite] ℹ️ Ignored event: ${event}`);
    }
    
    return res.status(200).send('ok');
  } catch (error) {
    logger.error('[MailerLite] Webhook error:', error);
    return res.status(200).send('ok');
  }
}

