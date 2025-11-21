import crypto from 'crypto';
import { supabase } from '../config/supabaseClient.mjs';
import { logger } from '../lib/simpleLogger.mjs';

const WEBHOOK_SECRET = process.env.FASTSPRING_WEBHOOK_SECRET;

export async function handleFastSpringWebhook(req, res) {
  try {
    // ✅ CRITICAL FIX: FastSpring uses X-FS-Signature header (Express lowercases to x-fs-signature)
    const signature = req.headers['x-fs-signature'];
    const rawBody = req.body.toString('utf8');
    
    if (!WEBHOOK_SECRET) {
      logger.error('[FastSpring] Webhook secret not configured');
      return res.status(500).send('webhook not configured');
    }
    
    // ✅ DEBUG: Log secret info (first/last 5 chars only for security)
    logger.debug('[FastSpring] Secret check:', {
      exists: !!WEBHOOK_SECRET,
      length: WEBHOOK_SECRET?.length,
      first5: WEBHOOK_SECRET?.substring(0, 5),
      last5: WEBHOOK_SECRET?.substring(WEBHOOK_SECRET.length - 5)
    });
    
    if (!signature) {
      logger.error('[FastSpring] ❌ Missing X-FS-Signature header');
      logger.debug('[FastSpring] Available headers:', Object.keys(req.headers).filter(h => h.toLowerCase().includes('signature') || h.toLowerCase().includes('fs')));
      return res.status(401).send('missing signature');
    }
    
    // ✅ DEBUG: Log body info
    logger.debug('[FastSpring] Body check:', {
      bodyType: typeof req.body,
      bodyIsBuffer: Buffer.isBuffer(req.body),
      rawBodyLength: rawBody.length,
      rawBodyFirst100: rawBody.substring(0, 100)
    });
    
    const computed = crypto
      .createHmac('sha256', WEBHOOK_SECRET.trim()) // ✅ Trim secret to remove any whitespace
      .update(rawBody)
      .digest('base64');
    
    if (signature !== computed) {
      logger.error('[FastSpring] ❌ Invalid signature', {
        received: signature?.substring(0, 20) + '...',
        computed: computed?.substring(0, 20) + '...',
        headerName: 'x-fs-signature',
        secretLength: WEBHOOK_SECRET?.length,
        secretFirst5: WEBHOOK_SECRET?.substring(0, 5),
        bodyLength: rawBody.length
      });
      return res.status(401).send('invalid signature');
    }
    
    // Parse event
    const payload = JSON.parse(rawBody);
    const event = payload?.events?.[0];
    
    if (!event) {
      logger.error('[FastSpring] ❌ No event in payload');
      return res.status(400).send('no event');
    }
    
    logger.info(`[FastSpring] 🔔 Webhook received: ${event.type}`);
    
    // FastSpring account ID (not userId directly)
    const fastspringAccountId = event?.data?.account;
    const subscriptionId = event?.data?.subscription;
    
    if (!subscriptionId) {
      logger.warn('[FastSpring] ⚠️ No subscription ID in event data');
      return res.status(200).send('ok');
    }
    
    // Find userId from fastspring_subscriptions table
    const { data: subscription, error: subError } = await supabase
      .from('fastspring_subscriptions')
      .select('user_id')
      .eq('fastspring_subscription_id', subscriptionId)
      .maybeSingle();
    
    if (subError || !subscription) {
      logger.warn(`[FastSpring] ⚠️ Subscription ${subscriptionId} not found in database - may be new subscription`);
      // For new subscriptions, try to find user by FastSpring account ID or tags
      const userIdFromTags = event?.data?.tags?.user_id;
      if (userIdFromTags) {
        logger.info(`[FastSpring] Found userId in tags: ${userIdFromTags}`);
        // Handle new subscription creation
        await handleNewSubscription(event, userIdFromTags, subscriptionId, fastspringAccountId);
        return res.status(200).send('ok');
      }
      // Still return 200 to prevent FastSpring retries
      return res.status(200).send('ok');
    }
    
    const userId = subscription.user_id;
    
    switch (event.type) {
      case 'subscription.activated':
      case 'subscription.updated':
      case 'subscription.charge.completed': {
        // Update fastspring_subscriptions table
        const { error: upsertError } = await supabase
          .from('fastspring_subscriptions')
          .upsert({
            user_id: userId,
            fastspring_subscription_id: subscriptionId,
            fastspring_account_id: fastspringAccountId,
            status: event.data?.state || 'active',
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'fastspring_subscription_id'
          });
        
        if (upsertError) {
          logger.error('[FastSpring] Failed to upsert subscription:', upsertError);
        }
        
        // Update profiles table tier based on subscription
        // Extract tier from product/plan if available
        // FastSpring sends product as either a string ("atlas-core") or object ({path: "atlas-core"})
        const productValue = event.data?.product;
        const productPath = typeof productValue === 'string' 
          ? productValue 
          : productValue?.path || event.data?.items?.[0]?.product?.path || event.data?.product || '';
        const tier = productPath.includes('studio') ? 'studio' 
                   : productPath.includes('core') ? 'core' 
                   : 'core'; // Default to core for paid subscriptions
        
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            subscription_tier: tier,
            subscription_status: 'active',
            fastspring_subscription_id: subscriptionId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        
        if (profileError) {
          logger.error('[FastSpring] Failed to update profile:', profileError);
        } else {
          logger.info(`[FastSpring] ✅ Updated user ${userId} to tier ${tier}`);
        }
        
        break;
      }
        
      case 'subscription.deactivated':
      case 'subscription.canceled': {
        await supabase
          .from('fastspring_subscriptions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('fastspring_subscription_id', subscriptionId);
        
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        
        logger.info(`[FastSpring] ✅ Cancelled subscription for user ${userId}`);
        break;
      }
        
      case 'subscription.charge.failed': {
        // Handle failed payment - could downgrade or mark as past_due
        await supabase
          .from('fastspring_subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('fastspring_subscription_id', subscriptionId);
        
        logger.warn(`[FastSpring] ⚠️ Charge failed for user ${userId}`);
        break;
      }
        
      default:
        logger.debug(`[FastSpring] ℹ️ Ignored event: ${event.type}`);
    }
    
    return res.status(200).send('ok');
  } catch (error) {
    logger.error('[FastSpring] Webhook error:', error);
    // Return 200 to prevent FastSpring retries on our errors
    return res.status(200).send('ok');
  }
}

async function handleNewSubscription(event, userId, subscriptionId, accountId) {
  try {
    // FastSpring sends product as either a string ("atlas-core") or object ({path: "atlas-core"})
    const productValue = event.data?.product;
    const productPath = typeof productValue === 'string' 
      ? productValue 
      : productValue?.path || event.data?.items?.[0]?.product?.path || event.data?.product || '';
    const tier = productPath.includes('studio') ? 'studio' 
               : productPath.includes('core') ? 'core' 
               : 'core';
    
    // Create subscription record
    await supabase
      .from('fastspring_subscriptions')
      .insert({
        user_id: userId,
        fastspring_subscription_id: subscriptionId,
        fastspring_account_id: accountId,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    
    // Update profile
    await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        subscription_status: 'active',
        fastspring_subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    
    logger.info(`[FastSpring] ✅ Created new subscription for user ${userId}`);
  } catch (error) {
    logger.error('[FastSpring] Failed to handle new subscription:', error);
  }
}

