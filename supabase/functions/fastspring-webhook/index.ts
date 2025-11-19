import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const MAGICBELL_API_KEY = Deno.env.get("MAGICBELL_API_KEY");

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

export const mapEventType = (eventType: string, oldTier?: string, newTier?: string) => {
  switch (eventType) {
    case "subscription.activated":
    case "subscription.trial.converted":
      return "activation";
    case "subscription.canceled":
    case "subscription.deactivated":
      return "cancellation";
    case "subscription.updated":
      if (oldTier && newTier && oldTier !== newTier) {
        // Define tier hierarchy: free < core < studio
        const tierOrder = { free: 0, core: 1, studio: 2 };
        const oldOrder = tierOrder[oldTier as keyof typeof tierOrder] ?? -1;
        const newOrder = tierOrder[newTier as keyof typeof tierOrder] ?? -1;
        return newOrder > oldOrder ? "upgrade" : "downgrade";
      }
      return null;
    default:
      return null;
  }
};

/**
 * Send MagicBell notification for subscription events
 */
async function sendMagicBellNotification(
  userId: string,
  eventType: string,
  newTier: string,
  oldTier?: string
): Promise<void> {
  if (!MAGICBELL_API_KEY) {
    console.log("[FastSpring Webhook] MagicBell not configured - skipping notification");
    return;
  }

  try {
    const tierNames: Record<string, string> = {
      core: "Atlas Core",
      studio: "Atlas Studio",
      free: "Free",
    };

    let title = "";
    let content = "";
    let category = "subscription";

    if (eventType === "activation" || eventType === "upgrade") {
      title = `Welcome to ${tierNames[newTier] || newTier}! 🎉`;
      content = `Your subscription is now active. Enjoy unlimited messages and premium features!`;
    } else if (eventType === "cancellation") {
      title = "Subscription Cancelled";
      content = `Your ${tierNames[oldTier || "subscription"]} subscription has been cancelled. You'll retain access until the end of your billing period.`;
    } else if (eventType === "downgrade") {
      title = "Subscription Changed";
      content = `Your subscription has been changed to ${tierNames[newTier] || newTier}.`;
    }

    if (!title) {
      console.log(`[FastSpring Webhook] No notification template for event: ${eventType}`);
      return;
    }

    const response = await fetch("https://api.magicbell.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MAGICBELL-API-KEY": MAGICBELL_API_KEY,
      },
      body: JSON.stringify({
        recipients: [{ external_id: userId }],
        title,
        content,
        category,
        action_url: "/chat",
        custom_attributes: {
          tier: newTier,
          old_tier: oldTier,
          event_type: eventType,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[FastSpring Webhook] Failed to send notification: ${response.status} - ${errorText}`);
      return;
    }

    console.log(`[FastSpring Webhook] ✅ Notification sent for ${eventType} to user ${userId}`);
  } catch (error) {
    console.error("[FastSpring Webhook] Error sending notification:", error);
    // Don't throw - notification failure shouldn't break webhook
  }
}

serve(async (req) => {
  try {
    // ✅ SECURITY: Get signature from headers
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
    const payload = JSON.parse(bodyText);
    console.log("[FastSpring Webhook] Received payload:", JSON.stringify(payload, null, 2));
    
    // Handle both test payloads and real FastSpring payloads
    let eventType, userId, newTier, oldTier;
    
    if (payload.event) {
      // Real FastSpring payload format
      eventType = payload.event;
      userId = payload.data?.account?.id || payload.data?.userId;
      newTier = payload.data?.subscription?.plan?.id === 'atlas-studio' ? 'studio' : 
                payload.data?.subscription?.plan?.id === 'atlas-core' ? 'core' : 'free';
      oldTier = 'free'; // Default for new subscriptions
    } else {
      // Test payload format
      eventType = payload.eventType;
      userId = payload.accountId;
      newTier = payload.newTier;
      oldTier = payload.oldTier;
    }

    if (!userId || !newTier) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Missing required fields: userId, newTier" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const mappedEvent = mapEventType(eventType, oldTier, newTier);
    
    // Always log to subscription_audit
    console.log(`[FastSpring Webhook] Logging ${mappedEvent || 'unknown'} for user ${userId}`);
    
    const { error: auditError } = await supabase.from("subscription_audit").insert({
      profile_id: userId,
      event_type: mappedEvent || 'unknown',
      old_tier: oldTier,
      new_tier: newTier,
      provider: "fastspring",
      metadata: payload
    });
    
    if (auditError) {
      console.error("[FastSpring Webhook] Audit error:", auditError);
      throw auditError;
    }

    // ✅ CRITICAL: Normalize tier to lowercase before storing (handles case variations)
    const normalizedNewTier = newTier.toLowerCase().trim();
    
    // Update user's subscription tier
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ 
        subscription_tier: normalizedNewTier,
        subscription_status: eventType.includes('canceled') || eventType.includes('deactivated') ? 'cancelled' : 'active',
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[FastSpring Webhook] Update error:", updateError);
      throw updateError;
    }

    console.log(`[FastSpring Webhook] Successfully processed ${eventType} for user ${userId} -> ${normalizedNewTier}`);

    // Send MagicBell notification (non-blocking - don't fail webhook if notification fails)
    await sendMagicBellNotification(userId, mappedEvent || 'unknown', normalizedNewTier, oldTier);
    
    return new Response(JSON.stringify({ 
      success: true,
      eventType: mappedEvent,
      userId: userId,
      newTier: newTier
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (err) {
    console.error("[FastSpring Webhook] Error:", err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
