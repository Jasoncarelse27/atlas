import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

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

serve(async (req) => {
  try {
    const payload = await req.json();
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

    // Update user's subscription tier
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ 
        subscription_tier: newTier,
        subscription_status: eventType.includes('canceled') || eventType.includes('deactivated') ? 'cancelled' : 'active',
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[FastSpring Webhook] Update error:", updateError);
      throw updateError;
    }

    console.log(`[FastSpring Webhook] Successfully processed ${eventType} for user ${userId} -> ${newTier}`);
    
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
