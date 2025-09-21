// supabase/functions/paddle-webhook/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    // ✅ Detect test mode
    const isTest = new URL(req.url).searchParams.get("test") === "1";

    // ✅ Parse JSON body
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid method" }),
        { status: 405 }
      );
    }

    if (!req.headers.get("content-type")?.includes("application/json")) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing content type" }),
        { status: 400 }
      );
    }

    const body = await req.json();

    // ✅ Signature validation (skipped in test mode)
    if (!isTest) {
      const signature = req.headers.get("Paddle-Signature");
      if (!signature) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing signature" }),
          { status: 401 }
        );
      }
      // TODO: Add real Paddle signature verification here later
    }

    // ✅ Extract key info
    const customerId =
      body?.data?.customer_id || body?.customer_id || body?.user_id;
    const priceId =
      body?.data?.items?.[0]?.price?.id || body?.price_id || null;

    if (!customerId || !priceId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing customer_id or price_id",
        }),
        { status: 400 }
      );
    }

    // ✅ Decide tier
    let newTier = "free";
    if (priceId.includes("core")) newTier = "core";
    if (priceId.includes("studio")) newTier = "studio";

    // ✅ Update Supabase profiles table
    const { error } = await supabase
      .from("profiles")
      .update({ subscription_tier: newTier })
      .eq("id", customerId);

    if (error) {
      console.error("Supabase update error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Updated user ${customerId} to tier ${newTier}`,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Server error" }),
      { status: 500 }
    );
  }
});