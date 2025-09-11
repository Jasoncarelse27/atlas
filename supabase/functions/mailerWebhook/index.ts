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
  if (!signature || !MAILERLITE_SIGNING_SECRET) return false;
  const hmac = crypto.createHmac("sha256", MAILERLITE_SIGNING_SECRET);
  hmac.update(body, "utf8");
  const expected = hmac.digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Replay protection: validate timestamp is within ±5 minutes
function validateTimestamp(timestamp: string | null): boolean {
  if (!timestamp) return false;
  
  const requestTime = parseInt(timestamp) * 1000; // Convert to milliseconds
  const currentTime = Date.now();
  const timeDiff = Math.abs(currentTime - requestTime);
  const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  return timeDiff <= fiveMinutes;
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
    // Try to insert with flexible schema
    const logData: any = {
      event_type: eventType,
      email: email,
      payload: payload,
      status: status,
      received_at: new Date().toISOString(),
    };
    
    await supabase.from("webhook_logs").insert(logData);
  } catch (error) {
    console.error("❌ Failed to log webhook event:", error);
    // Don't fail the webhook if logging fails
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type, x-mailerlite-signature, x-mailerlite-timestamp",
      },
    });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-mailerlite-signature");
    const timestamp = req.headers.get("x-mailerlite-timestamp");

    // 🔒 Security validations
    if (!verifySignature(rawBody, signature)) {
      console.log("❌ Invalid signature");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!validateTimestamp(timestamp)) {
      console.log("❌ Invalid or expired timestamp");
      return new Response(JSON.stringify({ error: "Request expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    console.log("✅ Valid MailerLite webhook:", payload);

    const { type, data } = payload;
    const email = data?.email;

    // Log the webhook event
    await logWebhookEvent(type, email, payload, "received");

    if (!email) {
      await logWebhookEvent(type, null, payload, "failed");
      throw new Error("Missing email in webhook payload");
    }

    if (type === "subscriber.added_to_group") {
      const group = data.group?.name;
      const tier = tierMap[group] || "free";

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
        await logWebhookEvent(type, email, payload, "failed");
        throw error;
      }
      
      await logWebhookEvent(type, email, payload, "processed");
      console.log(`🔄 Upgraded ${email} → ${tier}`);
    }

    if (type === "subscriber.removed_from_group") {
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
        await logWebhookEvent(type, email, payload, "failed");
        throw error;
      }
      
      await logWebhookEvent(type, email, payload, "processed");
      console.log(`⬇️ Downgraded ${email} → free`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("❌ Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});