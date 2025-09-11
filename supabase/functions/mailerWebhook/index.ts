import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import crypto from "https://deno.land/std@0.177.0/node/crypto.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase client (service role key is automatically injected in Edge Functions)
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const MAILERLITE_SIGNING_SECRET = Deno.env.get("MAILERLITE_SIGNING_SECRET")!;

// Verify MailerLite signature
function verifySignature(body: string, signature: string | null): boolean {
  if (!signature || !MAILERLITE_SIGNING_SECRET) {
    console.log("❌ Missing signature or secret");
    return false;
  }
  
  try {
    const hmac = crypto.createHmac("sha256", MAILERLITE_SIGNING_SECRET);
    hmac.update(body, "utf8");
    const expected = hmac.digest("hex");
    const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    console.log(`🔐 Signature validation: ${isValid ? 'valid' : 'invalid'}`);
    return isValid;
  } catch (error) {
    console.error("❌ Signature verification error:", error);
    return false;
  }
}

// Replay protection: validate timestamp is within ±5 minutes
function validateTimestamp(timestamp: string | null): boolean {
  if (!timestamp) {
    console.log("❌ Missing timestamp");
    return false;
  }
  
  try {
    const requestTime = parseInt(timestamp) * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const timeDiff = Math.abs(currentTime - requestTime);
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    const isValid = timeDiff <= fiveMinutes;
    console.log(`⏰ Timestamp validation: ${isValid ? 'valid' : 'expired'} (diff: ${timeDiff}ms)`);
    return isValid;
  } catch (error) {
    console.error("❌ Timestamp validation error:", error);
    return false;
  }
}

// Group → tier mapping
const tierMap: Record<string, string> = {
  premium_monthly: "core",
  premium_yearly: "studio",
  complete_bundle: "complete",
  free_users: "free",
};

// Log webhook event to database (flexible schema)
async function logWebhookEvent(eventType: string, email: string | null, payload: any, status: string) {
  try {
    console.log(`📝 Logging webhook event: ${eventType} - ${status}`);
    
    const logData = {
      event_type: eventType,
      email: email,
      payload: payload,
      status: status,
      received_at: new Date().toISOString(),
    };
    
    const { error } = await supabase.from("webhook_logs").insert(logData);
    if (error) {
      console.error("❌ Failed to log webhook event:", error);
    } else {
      console.log("✅ Webhook event logged successfully");
    }
  } catch (error) {
    console.error("❌ Failed to log webhook event:", error);
    // Don't fail the webhook if logging fails
  }
}

serve(async (req) => {
  console.log("🚀 Webhook function started");
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("📋 Handling CORS preflight");
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, x-mailerlite-signature, x-mailerlite-timestamp, authorization",
      },
    });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-mailerlite-signature");
    const timestamp = req.headers.get("x-mailerlite-timestamp");

    console.log("📥 Webhook received:", {
      method: req.method,
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
      bodyLength: rawBody.length,
      signature: signature?.substring(0, 10) + "...",
      timestamp: timestamp
    });

    // 🔒 Security validations
    if (!verifySignature(rawBody, signature)) {
      console.log("❌ Invalid signature - returning 401");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!validateTimestamp(timestamp)) {
      console.log("❌ Invalid timestamp - returning 401");
      return new Response(JSON.stringify({ error: "Request expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    console.log("✅ Valid MailerLite webhook payload:", JSON.stringify(payload, null, 2));

    const { type, data } = payload;
    const email = data?.email;

    // Log the webhook event
    await logWebhookEvent(type, email, payload, "received");

    if (!email) {
      console.log("❌ Missing email in payload");
      await logWebhookEvent(type, null, payload, "failed");
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (type === "subscriber.added_to_group") {
      const group = data.group?.name;
      const tier = tierMap[group] || "free";
      
      console.log(`🔄 Processing subscription upgrade: ${email} → ${tier} (group: ${group})`);

      // 🔄 Use upsert for idempotency
      const { error } = await supabase
        .from("subscriptions")
        .upsert({
          user_email: email,
          tier,
          status: "active",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_email" });

      if (error) {
        console.error("❌ Failed to update subscription:", error);
        await logWebhookEvent(type, email, payload, "failed");
        return new Response(JSON.stringify({ error: "Database error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      await logWebhookEvent(type, email, payload, "processed");
      console.log(`✅ Successfully upgraded ${email} → ${tier}`);
    }

    if (type === "subscriber.removed_from_group") {
      console.log(`⬇️ Processing subscription downgrade: ${email} → free`);
      
      // 🔄 Use upsert for idempotency
      const { error } = await supabase
        .from("subscriptions")
        .upsert({
          user_email: email,
          tier: "free",
          status: "inactive",
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_email" });

      if (error) {
        console.error("❌ Failed to update subscription:", error);
        await logWebhookEvent(type, email, payload, "failed");
        return new Response(JSON.stringify({ error: "Database error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      await logWebhookEvent(type, email, payload, "processed");
      console.log(`✅ Successfully downgraded ${email} → free`);
    }

    console.log("🎉 Webhook processing completed successfully");
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (err) {
    console.error("❌ Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: err.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});