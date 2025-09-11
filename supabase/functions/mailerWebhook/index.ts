// supabase/functions/mailerWebhook/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    const payload = await req.json();
    console.log("📩 Incoming MailerLite Webhook:", payload);

    const event = payload.type || payload.event;
    const email = payload.data?.email;

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: "No email provided" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Connect to Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Map MailerLite group events to subscription tiers
    let newTier = null;
    if (event === "subscriber.added_to_group") {
      if (payload.data.group?.name?.includes("premium_monthly")) newTier = "core";
      if (payload.data.group?.name?.includes("premium_yearly")) newTier = "studio";
      if (payload.data.group?.name?.includes("complete_bundle")) newTier = "complete";
      if (payload.data.group?.name?.includes("free_users")) newTier = "free";
    } else if (event === "subscriber.removed_from_group") {
      newTier = "free"; // downgrade on removal
    }

    if (newTier) {
      const { error } = await supabase
        .from("subscriptions")
        .update({ tier: newTier, status: "active", updated_at: new Date().toISOString() })
        .eq("user_email", email);

      if (error) {
        console.error("❌ Failed to update subscription:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          headers: { "Content-Type": "application/json" },
          status: 500,
        });
      }

      console.log(`✅ Subscription for ${email} updated to ${newTier}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
