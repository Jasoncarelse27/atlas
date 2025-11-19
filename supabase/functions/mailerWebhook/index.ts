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

