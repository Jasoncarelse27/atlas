import crypto from 'crypto';
import { supabase } from '../config/supabaseClient.mjs';
import { logger } from '../lib/simpleLogger.mjs';

const MAILERLITE_WEBHOOK_SECRET = process.env.MAILERLITE_WEBHOOK_SECRET;

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
        
      default:
        logger.debug(`[MailerLite] ℹ️ Ignored event: ${event}`);
    }
    
    return res.status(200).send('ok');
  } catch (error) {
    logger.error('[MailerLite] Webhook error:', error);
    return res.status(200).send('ok');
  }
}

