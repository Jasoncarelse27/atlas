import crypto from 'crypto';
import { supabase } from '../config/supabaseClient.mjs';
import { logger } from '../lib/simpleLogger.mjs';

const MAILERLITE_WEBHOOK_SECRET = process.env.MAILERLITE_WEBHOOK_SECRET;

export async function handleMailerLiteWebhook(req, res) {
  try {
    // Verify signature if configured
    if (MAILERLITE_WEBHOOK_SECRET) {
      const signature = req.headers['x-mailerlite-signature'];
      const bodyString = JSON.stringify(req.body);
      const computed = crypto
        .createHmac('sha256', MAILERLITE_WEBHOOK_SECRET)
        .update(bodyString)
        .digest('hex');
      
      if (signature !== computed) {
        logger.error('[MailerLite] ❌ Invalid signature');
        return res.status(401).send('invalid signature');
      }
    }
    
    const { event, data } = req.body || {};
    
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
      case 'subscriber.updated':
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
        
      case 'subscriber.unsubscribed':
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
        
      case 'subscriber.added_to_group':
      case 'subscriber.removed_from_group':
        // Log group changes but don't update database (no column for this)
        logger.debug(`[MailerLite] Group change for ${email}: ${event}`);
        break;
        
      default:
        logger.debug(`[MailerLite] ℹ️ Ignored event: ${event}`);
    }
    
    return res.status(200).send('ok');
  } catch (error) {
    logger.error('[MailerLite] Webhook error:', error);
    return res.status(200).send('ok');
  }
}

