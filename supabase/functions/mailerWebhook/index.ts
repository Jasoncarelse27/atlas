// supabase/functions/mailerWebhook/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Load Supabase secrets
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

serve(async (req: Request) => {
  try {
    const body = await req.json().catch(() => null);

    console.log("📩 Incoming MailerLite Webhook:", body);

    // ✅ Always acknowledge quickly (prevents MailerLite from disabling)
    // Respond immediately before doing heavy processing
    const ack = new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    // Process in background
    queueMicrotask(async () => {
      if (!body || !body.type) {
        console.warn("⚠️ Invalid webhook payload");
        return;
      }

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
    return new Response("Webhook error", { status: 200 }); // still return 200
  }
});

// --- Handlers ---
async function handleSubscriberUpdate(data: any) {
  if (!data?.email) return;

  console.log("🔄 Syncing subscriber:", data.email);

  // Example: update Supabase profile with MailerLite subscription tier
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
