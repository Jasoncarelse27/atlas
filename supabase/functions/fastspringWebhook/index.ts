import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Map FastSpring status → Atlas tier
function mapSubscriptionToTier(status: string): "free" | "core" | "studio" {
  switch (status) {
    case "active":
      return "core";
    case "trial":
      return "studio";
    default:
      return "free";
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const event = await req.json();
    console.log("[FastSpring Webhook] Event received:", JSON.stringify(event, null, 2));

    const customerId = event?.data?.account?.id;
    const subscriptionStatus = event?.data?.subscription?.status;
    const userEmail = event?.data?.account?.email;

    if (!customerId || !subscriptionStatus) {
      console.error("[FastSpring Webhook] Missing required fields:", { customerId, subscriptionStatus });
      return new Response("Missing required fields: customerId or subscriptionStatus", { status: 400 });
    }

    const subscriptionTier = mapSubscriptionToTier(subscriptionStatus);
    console.log(`[FastSpring Webhook] Mapping ${subscriptionStatus} → ${subscriptionTier}`);

    // Update profile by email (fastspring_account_id column not yet added)
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_tier: subscriptionTier,
        updated_at: new Date().toISOString(),
      })
      .eq("email", userEmail);

    if (error) {
      console.error("[FastSpring Webhook] Database update error:", error);
      return new Response(`Database error: ${error.message}`, { status: 500 });
    }

    console.log(`[FastSpring Webhook] ✅ Successfully updated ${userEmail} → ${subscriptionTier}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      customerId, 
      subscriptionTier,
      message: `Updated ${userEmail} to ${subscriptionTier} tier`
    }), { 
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[FastSpring Webhook] Exception:", err);
    return new Response(`Server error: ${err.message}`, { status: 500 });
  }
});
