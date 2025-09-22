import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  try {
    // Verify webhook signature (implement when real Paddle is configured)
    // const signature = req.headers.get('paddle-signature');
    // if (!verifyPaddleSignature(req.body, signature)) {
    //   return new Response("Invalid signature", { status: 401 });
    // }

    const body = await req.json();
    console.log('Paddle webhook received:', JSON.stringify(body, null, 2));

    const subscription = body?.data;
    if (!subscription) {
      console.error('Invalid payload: no subscription data');
      return new Response("Invalid payload", { status: 400 });
    }

    // Extract user ID from subscription metadata or custom data
    const userId = subscription.custom_data?.user_id || 
                   subscription.customer_id || 
                   subscription.subscription_id;
    
    if (!userId) {
      console.error('No user ID found in subscription data');
      return new Response("No user ID found", { status: 400 });
    }

    // Determine tier based on price_id
    const corePriceId = Deno.env.get("VITE_PADDLE_CORE_PRICE_ID");
    const studioPriceId = Deno.env.get("VITE_PADDLE_STUDIO_PRICE_ID");
    
    let tier: 'free' | 'core' | 'studio' = 'free';
    if (subscription.price_id === corePriceId) {
      tier = 'core';
    } else if (subscription.price_id === studioPriceId) {
      tier = 'studio';
    }

    // Update profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ 
        subscription_tier: tier,
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return new Response("Database error", { status: 500 });
    }

    // Update paddle_subscriptions table
    const { error: paddleError } = await supabase
      .from("paddle_subscriptions")
      .upsert({
        id: userId,
        price_id: subscription.price_id,
        status: subscription.status || 'active',
        subscription_tier: tier,
        updated_at: new Date().toISOString(),
      });

    if (paddleError) {
      console.error('Error updating paddle subscription:', paddleError);
      return new Response("Database error", { status: 500 });
    }

    console.log(`Successfully updated user ${userId} to tier ${tier}`);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Paddle webhook error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});