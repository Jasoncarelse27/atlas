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
    
    // FastSpring account ID (not userId directly) - extract early for security log
    const fastspringAccountId = event?.data?.account;
    const subscriptionId = event?.data?.subscription;

    // ✅ SECURITY LOG: Webhook received with all critical fields
    logger.info('[FastSpring][SECURITY] Webhook received', {
      eventType: event.type,
      rawEventType: event?.event,
      timestamp: new Date().toISOString(),
      fullEventId: event?.id,
      subscriptionId: subscriptionId || null,
      accountId: fastspringAccountId || null
    });
    
    // ✅ DEBUG: Full payload logging for tag discovery (INFO level so it shows in Railway logs)
    logger.info('[FastSpring] Raw Body Length:', rawBody.length);
    logger.info('[FastSpring] Payload Keys:', Object.keys(payload || {}));
    logger.info('[FastSpring] Event structure:', JSON.stringify(event, null, 2));
    logger.info('[FastSpring] Tag Locations:', {
      'event.data.tags': event?.data?.tags,
      'event.tags': event?.tags,
      'payload.tags': payload?.tags,
      'event.data.account.tags': event?.data?.account?.tags,
      'event.data.customer': event?.data?.customer,
      'event.data.account': event?.data?.account,
      'event.data.account.email': event?.data?.account?.email,
      'event.data.contact': event?.data?.contact
    });
    
    if (!subscriptionId) {
      logger.warn('[FastSpring] ⚠️ No subscription ID in event data');
      return res.status(200).send('ok');
    }
    
    // ✅ TAG FALLBACK: Search all possible locations for user_id
    const userIdFromTags = event?.data?.tags?.user_id 
                        || event?.tags?.user_id 
                        || payload?.tags?.user_id
                        || event?.data?.account?.tags?.user_id
                        || null;
    
    logger.info(`[FastSpring] Tag search result: userIdFromTags = ${userIdFromTags || 'null'}`);
    
    // ✅ SECURITY LOG: Subscription parsed with all extracted fields
    const customerEmail = event?.data?.account?.email
                       || event?.data?.customer?.email
                       || event?.data?.contact?.email
                       || null;
    const productId = event?.data?.product
                   || event?.data?.items?.[0]?.product
                   || null;

    logger.info('[FastSpring][SECURITY] Subscription parsed', {
      subscriptionId,
      accountId: fastspringAccountId,
      productId: productId,
      customerEmail: customerEmail,
      userIdFromTags: userIdFromTags || null
    });
    
    // Helper function to extract tier from product (matches existing production logic)
    const extractTierFromProduct = (productValue) => {
      // FastSpring sends product as either a string ("atlas-core") or object ({path: "atlas-core"})
      const productPath = typeof productValue === 'string' 
        ? productValue 
        : productValue?.path || event?.data?.items?.[0]?.product?.path || event?.data?.product || '';
      return productPath.includes('studio') ? 'studio' 
           : productPath.includes('core') ? 'core' 
           : 'core'; // Default to core for paid subscriptions
    };
    
    // Find userId from fastspring_subscriptions table
    const { data: subscription, error: subError } = await supabase
      .from('fastspring_subscriptions')
      .select('user_id')
      .eq('fastspring_subscription_id', subscriptionId)
      .maybeSingle();
    
    if (subError || !subscription) {
      logger.warn(`[FastSpring] ⚠️ Subscription ${subscriptionId} not found — linking new subscription...`);
      
      // 1️⃣ TAG METHOD: Use user_id from checkout tags
      if (userIdFromTags) {
        logger.info(`[FastSpring] 🟢 Linked user from tags: ${userIdFromTags}`);
        
        const tier = extractTierFromProduct(event?.data?.product);
        
        // Extract period dates from FastSpring event
        const periodEnd = event?.data?.next 
          || event?.data?.nextValue 
          || event?.data?.end 
          || event?.data?.endValue 
          || null;
        
        const periodStart = event?.data?.begin 
          || event?.data?.beginValue 
          || null;
        
        // Create subscription record
        const { error: upsertError } = await supabase.from('fastspring_subscriptions').upsert({
          user_id: userIdFromTags,
          fastspring_subscription_id: subscriptionId,
          fastspring_account_id: fastspringAccountId,
          status: event?.data?.state || 'active',
          current_period_start: periodStart ? new Date(periodStart).toISOString() : new Date().toISOString(),
          current_period_end: periodEnd ? new Date(periodEnd).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'fastspring_subscription_id'
        });
        
        if (upsertError) {
          logger.error('[FastSpring] Failed to upsert subscription:', upsertError);
        }
        
        // Update profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            subscription_tier: tier,
            subscription_status: 'active',
            subscription_id: subscriptionId,
            updated_at: new Date().toISOString()
          })
          .eq('id', userIdFromTags);
        
        if (profileError) {
          logger.error('[FastSpring] Failed to update profile:', profileError);
        } else {
          // ✅ SECURITY LOG: User linked and updated via tags
          const productPath = typeof event?.data?.product === 'string'
            ? event?.data?.product
            : event?.data?.product?.path || event?.data?.items?.[0]?.product?.path || event?.data?.product || '';

          logger.info('[FastSpring][SECURITY] User linked and updated', {
            userId: userIdFromTags,
            accountId: fastspringAccountId,
            email: customerEmail || event?.data?.account?.email || null,
            subscriptionId,
            productId: productPath,
            tier,
            timestamp: new Date().toISOString(),
            linkMethod: 'tags'
          });
        }
        
        return res.status(200).send('ok');
      }
      
      // 2️⃣ EMAIL FALLBACK: link via customer email
      const customerEmail = event?.data?.account?.email 
                         || event?.data?.customer?.email
                         || event?.data?.contact?.email
                         || null;
      
      logger.info(`[FastSpring] Email fallback check: customerEmail = ${customerEmail || 'null'}`);
      
      // ✅ DEBUG: Log account ID check for API fallback
      logger.info(`[FastSpring] API fallback condition check:`, {
        customerEmail: customerEmail,
        fastspringAccountId: fastspringAccountId,
        accountIdType: typeof fastspringAccountId,
        accountIdIsString: typeof fastspringAccountId === 'string',
        shouldRunAPI: !customerEmail && fastspringAccountId && typeof fastspringAccountId === 'string'
      });
      
      // 3️⃣ FASTSPRING API FALLBACK: Fetch account details from FastSpring API
      if (!customerEmail && fastspringAccountId && typeof fastspringAccountId === 'string') {
        logger.info(`[FastSpring] Attempting to fetch account details from FastSpring API: ${fastspringAccountId}`);
        
        try {
          const FASTSPRING_API_USERNAME = process.env.FASTSPRING_API_USERNAME;
          const FASTSPRING_API_PASSWORD = process.env.FASTSPRING_API_PASSWORD;
          
          if (FASTSPRING_API_USERNAME && FASTSPRING_API_PASSWORD) {
            const authString = Buffer.from(`${FASTSPRING_API_USERNAME}:${FASTSPRING_API_PASSWORD}`).toString('base64');
            
            const accountResponse = await fetch(`https://api.fastspring.com/accounts/${fastspringAccountId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (accountResponse.ok) {
              const accountData = await accountResponse.json();
              logger.info(`[FastSpring] Account API response:`, JSON.stringify(accountData, null, 2));
              
              // FastSpring account object has contact.email or email field
              const fetchedEmail = accountData?.contact?.email || accountData?.email || null;
              
              if (fetchedEmail) {
                logger.info(`[FastSpring] 🟢 Fetched email from FastSpring API: ${fetchedEmail}`);
                // Use the fetched email for linking
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('email', fetchedEmail)
                  .maybeSingle();
                
                if (profile?.id) {
                  logger.info(`[FastSpring] 🟢 API email match success → user: ${profile.id}`);
                  
                  const tier = extractTierFromProduct(event?.data?.product);
                  
                  // Extract period dates from FastSpring event
                  const periodEnd = event?.data?.next 
                    || event?.data?.nextValue 
                    || event?.data?.end 
                    || event?.data?.endValue 
                    || null;
                  
                  const periodStart = event?.data?.begin 
                    || event?.data?.beginValue 
                    || null;
                  
                  // Create subscription record
                  const { error: upsertError } = await supabase.from('fastspring_subscriptions').upsert({
                    user_id: profile.id,
                    fastspring_subscription_id: subscriptionId,
                    fastspring_account_id: fastspringAccountId,
                    status: event?.data?.state || 'active',
                    current_period_start: periodStart ? new Date(periodStart).toISOString() : new Date().toISOString(),
                    current_period_end: periodEnd ? new Date(periodEnd).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'fastspring_subscription_id'
                  });
                  
                  if (upsertError) {
                    logger.error('[FastSpring] Failed to upsert subscription:', upsertError);
                  }
                  
                  // Update profile
                  const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                      subscription_tier: tier,
                      subscription_status: 'active',
                      subscription_id: subscriptionId,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', profile.id);
                  
                  if (profileError) {
                    logger.error('[FastSpring] Failed to update profile:', profileError);
                  } else {
                    // ✅ SECURITY LOG: User linked and updated via API email fetch
                    const productPath = typeof event?.data?.product === 'string'
                      ? event?.data?.product
                      : event?.data?.product?.path || event?.data?.items?.[0]?.product?.path || event?.data?.product || '';

                    logger.info('[FastSpring][SECURITY] User linked and updated', {
                      userId: profile.id,
                      accountId: fastspringAccountId,
                      email: fetchedEmail,
                      subscriptionId,
                      productId: productPath,
                      tier,
                      timestamp: new Date().toISOString(),
                      linkMethod: 'api'
                    });
                  }
                  
                  return res.status(200).send('ok');
                } else {
                  logger.warn(`[FastSpring] No profile found for API-fetched email: ${fetchedEmail}`);
                }
              } else {
                logger.warn(`[FastSpring] FastSpring API account data has no email field`);
              }
            } else {
              const errorText = await accountResponse.text().catch(() => 'Unknown error');
              logger.warn(`[FastSpring] FastSpring API account fetch failed (${accountResponse.status}): ${errorText}`);
            }
          } else {
            logger.warn('[FastSpring] FastSpring API credentials not configured - cannot fetch account details');
          }
        } catch (apiError) {
          logger.error('[FastSpring] Error fetching account from FastSpring API:', apiError);
          // Continue to final fallback
        }
      }
      
      if (customerEmail) {
        logger.info(`[FastSpring] Attempting fallback email match: ${customerEmail}`);
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', customerEmail)
          .maybeSingle();
        
        if (profile?.id) {
          logger.info(`[FastSpring] 🟢 Fallback email match success → user: ${profile.id}`);
          
          const tier = extractTierFromProduct(event?.data?.product);
          
          // Extract period dates from FastSpring event
          const periodEnd = event?.data?.next 
            || event?.data?.nextValue 
            || event?.data?.end 
            || event?.data?.endValue 
            || null;
          
          const periodStart = event?.data?.begin 
            || event?.data?.beginValue 
            || null;
          
          // Create subscription record
          const { error: upsertError } = await supabase.from('fastspring_subscriptions').upsert({
            user_id: profile.id,
            fastspring_subscription_id: subscriptionId,
            fastspring_account_id: fastspringAccountId,
            status: event?.data?.state || 'active',
            current_period_start: periodStart ? new Date(periodStart).toISOString() : new Date().toISOString(),
            current_period_end: periodEnd ? new Date(periodEnd).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'fastspring_subscription_id'
          });
          
          if (upsertError) {
            logger.error('[FastSpring] Failed to upsert subscription:', upsertError);
          }
          
          // Update profile
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              subscription_tier: tier,
              subscription_status: 'active',
              subscription_id: subscriptionId,
              updated_at: new Date().toISOString()
            })
            .eq('id', profile.id);
          
          if (profileError) {
            logger.error('[FastSpring] Failed to update profile:', profileError);
          } else {
            // ✅ SECURITY LOG: User linked and updated via email fallback
            const productPath = typeof event?.data?.product === 'string'
              ? event?.data?.product
              : event?.data?.product?.path || event?.data?.items?.[0]?.product?.path || event?.data?.product || '';

            logger.info('[FastSpring][SECURITY] User linked and updated', {
              userId: profile.id,
              accountId: fastspringAccountId,
              email: customerEmail,
              subscriptionId,
              productId: productPath,
              tier,
              timestamp: new Date().toISOString(),
              linkMethod: 'email'
            });
          }
          
          return res.status(200).send('ok');
        } else {
          logger.warn(`[FastSpring] No profile found for email: ${customerEmail}`);
        }
      }
      
      logger.error('[FastSpring] 🔴 Could not resolve user — no tags + no email match');
      return res.status(200).send('ok');
    }
    
    const userId = subscription.user_id;
    
    switch (event.type) {
      case 'subscription.activated':
      case 'subscription.updated':
      case 'subscription.charge.completed': {
        // Extract period dates from FastSpring event
        const periodEnd = event?.data?.next 
          || event?.data?.nextValue 
          || event?.data?.end 
          || event?.data?.endValue 
          || null;
        
        const periodStart = event?.data?.begin 
          || event?.data?.beginValue 
          || null;
        
        // Update fastspring_subscriptions table
        const { error: upsertError } = await supabase
          .from('fastspring_subscriptions')
          .upsert({
            user_id: userId,
            fastspring_subscription_id: subscriptionId,
            fastspring_account_id: fastspringAccountId,
            status: event.data?.state || 'active',
            current_period_start: periodStart ? new Date(periodStart).toISOString() : new Date().toISOString(),
            current_period_end: periodEnd ? new Date(periodEnd).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            grace_period_end: null, // Clear any grace period on successful payment
            cancel_at_period_end: false, // Clear cancellation flag if reactivated
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
            subscription_id: subscriptionId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
        
        if (profileError) {
          logger.error('[FastSpring] Failed to update profile:', profileError);
        } else {
          // ✅ SECURITY LOG: User updated (existing subscription)
          const productPath = typeof event.data?.product === 'string'
            ? event.data?.product
            : event.data?.product?.path || event.data?.items?.[0]?.product?.path || event.data?.product || '';

          logger.info('[FastSpring][SECURITY] User linked and updated', {
            userId,
            accountId: fastspringAccountId,
            email: customerEmail || event?.data?.account?.email || null,
            subscriptionId,
            productId: productPath,
            tier,
            timestamp: new Date().toISOString(),
            linkMethod: 'existing'
          });
        }
        
        break;
      }
        
      case 'subscription.deactivated':
      case 'subscription.canceled': {
        // Extract period end from FastSpring event (user keeps access until period ends)
        const periodEnd = event?.data?.end 
          || event?.data?.endValue 
          || event?.data?.next 
          || event?.data?.nextValue 
          || null;
        
        // Mark as cancelled but DON'T downgrade tier yet - user keeps access until period_end
        await supabase
          .from('fastspring_subscriptions')
          .update({
            status: 'cancelled',
            cancel_at_period_end: true,
            current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('fastspring_subscription_id', subscriptionId);
        
        // ✅ DON'T update profiles table - keep tier active until period ends
        // Tier will be downgraded when period_end is reached (handled by scheduled job)
        
        logger.info(`[FastSpring] ✅ Cancelled subscription for user ${userId} - tier remains active until period end ${periodEnd ? new Date(periodEnd).toISOString() : '(unknown)'}`);
        break;
      }
        
      case 'subscription.charge.failed': {
        // Set 24-hour grace period (not 7 days)
        const gracePeriodEnd = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        await supabase
          .from('fastspring_subscriptions')
          .update({
            status: 'past_due',
            grace_period_end: gracePeriodEnd.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('fastspring_subscription_id', subscriptionId);
        
        // ✅ DON'T downgrade tier - user keeps access during 24-hour grace period
        // Tier will be downgraded if payment fails after grace period expires (handled by scheduled job)
        
        logger.warn(`[FastSpring] ⚠️ Charge failed for user ${userId} - 24-hour grace period until ${gracePeriodEnd.toISOString()}`);
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
    
    // Extract period dates from FastSpring event
    const periodEnd = event?.data?.next 
      || event?.data?.nextValue 
      || event?.data?.end 
      || event?.data?.endValue 
      || null;
    
    const periodStart = event?.data?.begin 
      || event?.data?.beginValue 
      || null;
    
    // Create subscription record
    await supabase
      .from('fastspring_subscriptions')
      .insert({
        user_id: userId,
        fastspring_subscription_id: subscriptionId,
        fastspring_account_id: accountId,
        status: 'active',
        current_period_start: periodStart ? new Date(periodStart).toISOString() : new Date().toISOString(),
        current_period_end: periodEnd ? new Date(periodEnd).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    
    // Update profile
    await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        subscription_status: 'active',
        subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    
    logger.info(`[FastSpring] ✅ Created new subscription for user ${userId}`);
  } catch (error) {
    logger.error('[FastSpring] Failed to handle new subscription:', error);
  }
}

