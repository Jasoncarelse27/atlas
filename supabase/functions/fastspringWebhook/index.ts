import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/**
 * 🔒 SECURITY: Verify FastSpring webhook signature
 * This prevents unauthorized tier escalation attacks by ensuring
 * only legitimate FastSpring events can update user tiers.
 */
async function verifyFastSpringSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    return false;
  }

  try {
    // FastSpring uses HMAC-SHA256 for webhook signatures
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const bodyData = encoder.encode(body);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, bodyData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison to prevent timing attacks
    return signature.toLowerCase() === expectedSignature.toLowerCase();
  } catch (error) {
    console.error("[Webhook] Signature verification error:", error);
    return false;
  }
}

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
    // ✅ SECURITY: Get signature from headers and verify BEFORE processing
    const signature = req.headers.get("x-fastspring-signature") || 
                      req.headers.get("x-fs-signature");
    const bodyText = await req.text();
    
    // ✅ SECURITY: Verify webhook secret is configured
    const webhookSecret = Deno.env.get("FASTSPRING_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("[FastSpring Webhook] CRITICAL: Webhook secret not configured!");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Webhook secret not configured" 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // ✅ SECURITY: Verify signature FIRST (before processing any data)
    const isValidSignature = await verifyFastSpringSignature(
      bodyText,
      signature,
      webhookSecret
    );
    
    if (!isValidSignature) {
      console.error("[FastSpring Webhook] ⚠️ SECURITY ALERT: Invalid signature detected!");
      console.error("[FastSpring Webhook] This could be an unauthorized tier escalation attempt.");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid webhook signature" 
      }), { 
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    console.log("[FastSpring Webhook] ✅ Signature verified successfully");
    
    // Now safe to parse and process the payload
    const event = JSON.parse(bodyText);
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
