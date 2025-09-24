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
    console.log("[FastSpring Webhook] Received payload:", payload);
    
    const { eventType, accountId, oldTier, newTier } = payload;

    if (!accountId || !newTier) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Missing required fields: accountId, newTier" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const mappedEvent = mapEventType(eventType, oldTier, newTier);
    
    if (mappedEvent) {
      console.log(`[FastSpring Webhook] Logging ${mappedEvent} for user ${accountId}`);
      
      const { error: auditError } = await supabase.from("subscription_audit").insert({
        user_id: accountId,
        event_type: mappedEvent,
        old_tier: oldTier,
        new_tier: newTier,
        source: "fastspring"
      });
      
      if (auditError) {
        console.error("[FastSpring Webhook] Audit error:", auditError);
        throw auditError;
      }
    }

    // Update user's subscription tier
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ 
        subscription_tier: newTier,
        updated_at: new Date().toISOString()
      })
      .eq("id", accountId);

    if (updateError) {
      console.error("[FastSpring Webhook] Update error:", updateError);
      throw updateError;
    }

    console.log(`[FastSpring Webhook] Successfully processed ${eventType} for user ${accountId}`);
    
    return new Response(JSON.stringify({ 
      success: true,
      eventType: mappedEvent,
      userId: accountId,
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
