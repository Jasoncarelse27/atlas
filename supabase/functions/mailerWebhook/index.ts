// supabase/functions/mailerWebhook/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

// --- Load secrets ---
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const mailerLiteSecret = Deno.env.get("MAILERLITE_SECRET")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// --- Signature Verification ---
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const signature = req.headers.get("x-mailerlite-signature");
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(mailerLiteSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  return signature === expected;
}

serve(async (req: Request) => {
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody || "{}");

    // ✅ Verify signature
    const valid = await verifySignature(req, rawBody);
    if (!valid) {
      console.warn("❌ Invalid MailerLite signature");
      return new Response("Invalid signature", { status: 401 });
    }

    console.log("📩 Verified webhook:", body);

    // ✅ Always ACK immediately
    const ack = new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    // Process in background
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
            console.log("ℹ️ Ignored event:", body.type);
        }
      } catch (err) {
        console.error("❌ Processing error:", err);
      }
    });

    return ack;
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return new Response("Webhook error", { status: 200 }); // still ack
  }
});

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

  if (error) console.error("❌ Update failed:", error);
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

  if (error) console.error("❌ Downgrade failed:", error);
  else console.log("✅ Subscriber downgraded:", data.email);
}
