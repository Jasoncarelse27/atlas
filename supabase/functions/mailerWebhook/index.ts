import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

// Load Supabase secrets
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const mailerLiteSecret = Deno.env.get("MAILERLITE_SECRET")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req: Request) => {
  try {
    const signature = req.headers.get("x-mailerlite-signature");
    const rawBody = await req.text();

    if (!signature || !(await verifySignature(rawBody, signature))) {
      console.warn("❌ Invalid or missing signature");
      return new Response("Unauthorized", { status: 401 });
    }

    const body = JSON.parse(rawBody);
    console.log("📩 Verified MailerLite Webhook:", body);

    // ✅ Acknowledge immediately
    const ack = new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    queueMicrotask(async () => {
      try {
        switch (body.type) {
          case "subscriber.created":
          case "subscriber.updated":
            await handleSubscriberUpdate(body.data);
            break;

          case "subscriber.deleted":
            await handleSubscriberDelete(body.data);
            break;

          default:
            console.log("ℹ️ Ignored webhook type:", body.type);
        }
      } catch (err) {
        console.error("❌ Error handling webhook:", err);
      }
    });

    return ack;
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return new Response("Webhook error", { status: 500 });
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
    console.warn("❌ Signature verification error:", error);
    return false;
  }
}

// --- Handlers ---
async function handleSubscriberUpdate(data: any) {
  if (!data?.email) return;

  console.log("🔄 Syncing subscriber:", data.email);

  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_tier: data.fields?.plan || "free",
      updated_at: new Date().toISOString(),
    })
    .eq("email", data.email);

  if (error) console.error("❌ Supabase update failed:", error);
  else console.log("✅ Subscriber synced:", data.email);
}

async function handleSubscriberDelete(data: any) {
  if (!data?.email) return;

  console.log("🗑️ Removing subscriber:", data.email);

  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_tier: "free",
      updated_at: new Date().toISOString(),
    })
    .eq("email", data.email);

  if (error) console.error("❌ Failed to downgrade subscriber:", error);
  else console.log("✅ Subscriber downgraded:", data.email);
}