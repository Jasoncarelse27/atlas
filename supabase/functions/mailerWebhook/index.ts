import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Load Supabase secrets
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const mailerLiteSecret = Deno.env.get("MAILERLITE_SECRET")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// --- Structured Logging ---
interface LogContext {
  event: string;
  email?: string;
  webhookType?: string;
  error?: string;
  retryAttempt?: number;
}

function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, context: LogContext) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...context
  };
  console.log(JSON.stringify(logEntry));
}

// --- Retry Logic with Exponential Backoff ---
async function withRetry<T>(
  operation: () => Promise<T>,
  context: LogContext,
  maxRetries: number = 3
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        log('INFO', `Operation succeeded on retry attempt ${attempt}`, {
          ...context,
          retryAttempt: attempt
        });
      }
      return result;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      
      log(isLastAttempt ? 'ERROR' : 'WARN', 
        `Operation failed on attempt ${attempt}${isLastAttempt ? ' (final attempt)' : ''}`, {
        ...context,
        retryAttempt: attempt,
        error: error instanceof Error ? error.message : String(error)
      });

      if (isLastAttempt) {
        return null;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return null;
}

serve(async (req: Request) => {
  try {
    const signature = req.headers.get("x-mailerlite-signature");
    const rawBody = await req.text();

    if (!signature || !(await verifySignature(rawBody, signature))) {
      log('WARN', 'Invalid or missing signature', { event: 'signature_verification_failed' });
      return new Response("Unauthorized", { status: 401 });
    }

    const body = JSON.parse(rawBody);
    log('INFO', 'Verified MailerLite webhook received', {
      event: 'webhook_received',
      webhookType: body.type,
      email: body.data?.email
    });

    // ✅ Acknowledge immediately
    const ack = new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    // Process in background
    queueMicrotask(async () => {
      try {
        await handleWebhookEvent(body);
      } catch (err) {
        log('ERROR', 'Error handling webhook event', {
          event: 'webhook_processing_error',
          webhookType: body.type,
          email: body.data?.email,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    });

    return ack;
  } catch (error) {
    log('ERROR', 'Webhook processing error', {
      event: 'webhook_error',
      error: error instanceof Error ? error.message : String(error)
    });
    return new Response("Webhook error", { status: 200 }); // Always return 200
  }
});

// --- Signature Verification ---
async function verifySignature(body: string, signature: string): Promise<boolean> {
  try {
    const key = new TextEncoder().encode(mailerLiteSecret);
    const msg = new TextEncoder().encode(body);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

    return await crypto.subtle.verify("HMAC", cryptoKey, signatureBytes, msg);
  } catch (error) {
    log('WARN', 'Signature verification error', {
      event: 'signature_verification_error',
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

// --- Main Event Handler ---
async function handleWebhookEvent(body: any) {
  const { type, data } = body;
  const email = data?.email;

  if (!email) {
    log('WARN', 'Webhook event missing email', {
      event: 'missing_email',
      webhookType: type
    });
    return;
  }

  const context: LogContext = {
    event: `handle_${type}`,
    email,
    webhookType: type
  };

  switch (type) {
    case "subscriber.created":
    case "subscriber.updated":
      await handleSubscriberUpdate(data, context);
      break;

    case "subscriber.deleted":
      await handleSubscriberDelete(data, context);
      break;

    case "subscriber.unsubscribed":
      await handleSubscriberUnsubscribed(data, context);
      break;

    case "subscriber.bounced":
      await handleSubscriberBounced(data, context);
      break;

    case "subscriber.added_to_group":
      await handleSubscriberAddedToGroup(data, context);
      break;

    // ✅ EMAIL EVENT LOGGING: Log email sends/deliveries/opens (using actual MailerLite event names)
    case "campaign.sent":
    case "campaign.open":
    case "campaign.click":
    case "subscriber.automation_triggered":
    case "subscriber.automation_completed":
      await handleEmailEvent(type, data, context);
      break;

    default:
      log('INFO', 'Ignored webhook type', {
        event: 'ignored_webhook_type',
        webhookType: type,
        email
      });
  }
}

// --- Event Handlers ---
async function handleSubscriberUpdate(data: any, context: LogContext) {
  log('INFO', 'Processing subscriber update', context);

  const result = await withRetry(async () => {
    // ✅ CRITICAL: Normalize tier to lowercase before storing (handles case variations)
    const rawTier = data.fields?.plan || "free";
    const normalizedTier = typeof rawTier === 'string' ? rawTier.toLowerCase().trim() : 'free';
    
    // ✅ VALIDATION: Ensure tier is one of the expected values (fail closed to 'free')
    const validTiers = ['free', 'core', 'studio'];
    const finalTier = validTiers.includes(normalizedTier) ? normalizedTier : 'free';
    
    const { error } = await supabase
      .from("profiles")
      .update({
        subscription_tier: finalTier,
        updated_at: new Date().toISOString(),
      })
      .eq("email", data.email);

    if (error) throw error;
    return { success: true };
  }, context);

  if (result) {
    log('INFO', 'Subscriber synced successfully', context);
  } else {
    log('ERROR', 'Failed to sync subscriber after retries', context);
  }
}

async function handleSubscriberDelete(data: any, context: LogContext) {
  log('INFO', 'Processing subscriber deletion', context);

  const result = await withRetry(async () => {
    const { error } = await supabase
      .from("profiles")
      .update({
        subscription_tier: "free", // Already normalized
        updated_at: new Date().toISOString(),
      })
      .eq("email", data.email);

    if (error) throw error;
    return { success: true };
  }, context);

  if (result) {
    log('INFO', 'Subscriber downgraded successfully', context);
  } else {
    log('ERROR', 'Failed to downgrade subscriber after retries', context);
  }
}

async function handleSubscriberUnsubscribed(data: any, context: LogContext) {
  log('INFO', 'Processing subscriber unsubscription', context);

  const result = await withRetry(async () => {
    const { error } = await supabase
      .from("profiles")
      .update({
        subscription_tier: "free", // Already normalized
        status: "unsubscribed",
        updated_at: new Date().toISOString(),
      })
      .eq("email", data.email);

    if (error) throw error;
    return { success: true };
  }, context);

  if (result) {
    log('INFO', 'Subscriber marked as unsubscribed', context);
  } else {
    log('ERROR', 'Failed to mark subscriber as unsubscribed after retries', context);
  }
}

async function handleSubscriberBounced(data: any, context: LogContext) {
  log('INFO', 'Processing subscriber bounce', context);

  const result = await withRetry(async () => {
    const { error } = await supabase
      .from("profiles")
      .update({
        status: "inactive",
        bounce_reason: data.reason || "email_bounced",
        updated_at: new Date().toISOString(),
      })
      .eq("email", data.email);

    if (error) throw error;
    return { success: true };
  }, context);

  if (result) {
    log('INFO', 'Subscriber marked as inactive due to bounce', context);
  } else {
    log('ERROR', 'Failed to mark subscriber as inactive after retries', context);
  }
}

async function handleSubscriberAddedToGroup(data: any, context: LogContext) {
  log('INFO', 'Processing subscriber group assignment', {
    ...context,
    groupId: data.group_id,
    groupName: data.group_name
  });

  // Log group assignment for future use
  // This could be extended to update user roles or permissions
  log('INFO', 'Subscriber added to group (logged for future use)', {
    event: 'group_assignment_logged',
    email: data.email,
    groupId: data.group_id,
    groupName: data.group_name
  });
}

// ✅ EMAIL EVENT LOGGING: Log email sends/deliveries/opens to email_logs
async function handleEmailEvent(eventType: string, data: any, context: LogContext) {
  log('INFO', 'Processing email event', {
    ...context,
    eventType,
    campaignId: data.campaign_id,
    automationId: data.automation_id
  });

  const result = await withRetry(async () => {
    // Find user by email
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", data.email)
      .maybeSingle();

    // Map MailerLite events to flow_type (using actual MailerLite event names)
    const flowTypeMap: Record<string, string> = {
      'campaign.sent': data.campaign_name || 'campaign',
      'campaign.open': data.campaign_name || 'campaign',
      'campaign.click': data.campaign_name || 'campaign',
      'subscriber.automation_triggered': data.automation_name || 'automation',
      'subscriber.automation_completed': data.automation_name || 'automation',
    };
    
    // Determine flow_type from campaign/automation name or event
    let flowType = flowTypeMap[eventType] || 'unknown';
    
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
    if (eventType === 'campaign.open') status = 'opened';
    else if (eventType === 'campaign.click') status = 'clicked';
    else if (eventType === 'subscriber.automation_triggered') status = 'triggered';
    else if (eventType === 'subscriber.automation_completed') status = 'sent';
    
    const { error } = await supabase
      .from("email_logs")
      .insert({
        flow_type: flowType,
        recipient_email: data.email,
        recipient_name: data.name || data.subscriber?.name || null,
        recipient_user_id: profile?.id || null,
        message_id: data.message_id || data.id || data.campaign_id || null,
        sent_at: data.sent_at || data.timestamp || new Date().toISOString(),
        status: status,
        metadata: {
          event: eventType,
          campaign_id: data.campaign_id,
          automation_id: data.automation_id,
          campaign_name: data.campaign_name,
          automation_name: data.automation_name,
        }
      });

    if (error) throw error;
    return { success: true };
  }, context);

  if (result) {
    log('INFO', 'Email event logged successfully', context);
  } else {
    log('ERROR', 'Failed to log email event after retries', context);
  }
}

