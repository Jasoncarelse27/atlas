import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PADDLE_WEBHOOK_SECRET = Deno.env.get("PADDLE_WEBHOOK_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const method = req.method;
    const url = new URL(req.url);
    
    console.log(`Webhook received: ${method} ${url.pathname}`);
    
    // Handle GET requests for webhook verification/testing
    if (method === "GET") {
      return new Response(JSON.stringify({
        success: true,
        message: "Paddle webhook endpoint is active",
        timestamp: new Date().toISOString(),
        environment: "production",
        method: "GET"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Handle POST requests (actual webhook events)
    if (method !== "POST") {
      return new Response(JSON.stringify({
        success: false,
        error: "Method not allowed",
        message: "Only POST and GET requests are allowed"
      }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Get content type and body for POST requests
    const contentType = req.headers.get("content-type") || "";
    console.log(`Content-Type: ${contentType}`);
    
    // Check content type for POST requests
    if (!contentType.includes("application/json")) {
      console.error(`Invalid content type: ${contentType}`);
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid content type",
        message: `Expected application/json, got ${contentType}`
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature");
    
    console.log(`Raw body length: ${rawBody.length}`);
    console.log(`Signature present: ${!!signature}`);
    
    if (!signature) {
      console.error("Missing Paddle signature");
      return new Response(JSON.stringify({
        success: false,
        error: "Missing signature",
        message: "Paddle signature header is required"
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ✅ Verify Paddle webhook signature
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(PADDLE_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      Uint8Array.from(atob(signature), c => c.charCodeAt(0)),
      new TextEncoder().encode(rawBody)
    );

    if (!valid) {
      console.error("Invalid Paddle signature");
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid signature",
        message: "Webhook signature verification failed"
      }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const event = JSON.parse(rawBody);
    console.log("Paddle webhook event:", event.event_type, event.data);

    // 🎯 Handle subscription confirmation
    if (event.event_type === "transaction.completed") {
      const { customer_id, items } = event.data;

      // Detect plan from Paddle price ID
      const priceId = items?.[0]?.price?.id;
      let newTier = "free";
      
      if (priceId === "pri_core_plan") newTier = "core";
      if (priceId === "pri_studio_plan") newTier = "studio";

      console.log(`Upgrading customer ${customer_id} to tier: ${newTier}`);

      // Update user profile with new tier
      const { error } = await supabase
        .from("profiles")
        .update({
          subscription_tier: newTier,
          subscription_status: "active",
          subscription_id: event.data.id,
          first_payment_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("paddle_customer_id", customer_id);

      if (error) {
        console.error("Failed to update profile:", error);
        throw error;
      }

      console.log(`✅ Successfully upgraded customer ${customer_id} to ${newTier}`);
      return new Response(JSON.stringify({
        success: true,
        message: "Profile updated successfully",
        customer_id,
        new_tier: newTier
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Handle subscription cancellations
    if (event.event_type === "subscription.canceled") {
      const { customer_id } = event.data;
      
      console.log(`Downgrading customer ${customer_id} to free tier`);

      const { error } = await supabase
        .from("profiles")
        .update({
          subscription_tier: "free",
          subscription_status: "canceled",
          updated_at: new Date().toISOString()
        })
        .eq("paddle_customer_id", customer_id);

      if (error) {
        console.error("Failed to downgrade profile:", error);
        throw error;
      }

      console.log(`✅ Successfully downgraded customer ${customer_id} to free`);
      return new Response(JSON.stringify({
        success: true,
        message: "Profile downgraded successfully",
        customer_id,
        new_tier: "free"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`Event type ${event.event_type} ignored`);
    return new Response(JSON.stringify({
      success: true,
      message: "Event ignored",
      event_type: event.event_type
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response(JSON.stringify({
      success: false,
      error: "Webhook processing failed",
      message: e.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});