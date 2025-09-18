// Atlas Paddle Webhook Handler
// Processes subscription events, payment updates, and cancellations

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaddleWebhookEvent {
  alert_id: string;
  alert_name: string;
  subscription_id?: string;
  subscription_plan_id?: string;
  user_id?: string;
  email?: string;
  status?: string;
  cancel_url?: string;
  update_url?: string;
  next_bill_date?: string;
  unit_price?: string;
  currency?: string;
  marketing_consent?: boolean;
  checkout_id?: string;
  event_time?: string;
  p_signature?: string;
  passthrough?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse webhook data
    const formData = await req.formData()
    const webhookData: PaddleWebhookEvent = {}
    
    for (const [key, value] of formData.entries()) {
      webhookData[key as keyof PaddleWebhookEvent] = value as string
    }

    console.log('Paddle webhook received:', {
      alert_name: webhookData.alert_name,
      alert_id: webhookData.alert_id,
      subscription_id: webhookData.subscription_id
    })

    // Verify webhook signature (simplified for demo)
    // In production, implement proper Paddle signature verification
    if (!webhookData.p_signature) {
      console.error('Missing webhook signature')
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Log webhook event
    const { error: logError } = await supabase
      .from('paddle_webhook_events')
      .insert({
        alert_id: webhookData.alert_id,
        alert_name: webhookData.alert_name,
        subscription_id: webhookData.subscription_id,
        event_data: webhookData,
        processed: false
      })

    if (logError) {
      console.error('Failed to log webhook event:', logError)
    }

    // Process different event types
    let result = { success: false, message: 'Unknown event type' }

    switch (webhookData.alert_name) {
      case 'subscription_created':
        result = await handleSubscriptionCreated(supabase, webhookData)
        break
      
      case 'subscription_updated':
        result = await handleSubscriptionUpdated(supabase, webhookData)
        break
      
      case 'subscription_cancelled':
        result = await handleSubscriptionCancelled(supabase, webhookData)
        break
      
      case 'subscription_payment_succeeded':
        result = await handlePaymentSucceeded(supabase, webhookData)
        break
      
      case 'subscription_payment_failed':
        result = await handlePaymentFailed(supabase, webhookData)
        break
      
      default:
        console.log(`Unhandled webhook event: ${webhookData.alert_name}`)
        result = { success: true, message: 'Event acknowledged but not processed' }
    }

    // Update webhook event as processed
    if (result.success) {
      await supabase
        .from('paddle_webhook_events')
        .update({ processed: true })
        .eq('alert_id', webhookData.alert_id)
    } else {
      await supabase
        .from('paddle_webhook_events')
        .update({ 
          processed: false, 
          processing_error: result.message 
        })
        .eq('alert_id', webhookData.alert_id)
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Webhook processing failed',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Handler functions

async function handleSubscriptionCreated(supabase: any, event: PaddleWebhookEvent) {
  if (!event.subscription_id || !event.subscription_plan_id) {
    return { success: false, message: 'Missing subscription data' }
  }

  // Parse passthrough data to get user ID
  let passthrough: any = {}
  try {
    passthrough = event.passthrough ? JSON.parse(event.passthrough) : {}
  } catch (e) {
    console.error('Failed to parse passthrough data:', e)
    return { success: false, message: 'Invalid passthrough data' }
  }

  if (!passthrough.userId) {
    return { success: false, message: 'Missing user ID in passthrough data' }
  }

  // Determine tier from plan ID
  const tier = getTierFromPlanId(event.subscription_plan_id)
  
  const subscription = {
    user_id: passthrough.userId,
    paddle_subscription_id: event.subscription_id,
    paddle_plan_id: event.subscription_plan_id,
    tier,
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: event.next_bill_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    cancel_at_period_end: false,
    paddle_checkout_id: event.checkout_id,
    paddle_user_id: event.user_id
  }

  const { error } = await supabase
    .from('paddle_subscriptions')
    .insert(subscription)

  if (error) {
    console.error('Failed to create subscription:', error)
    return { success: false, message: 'Failed to create subscription record' }
  }

  console.log(`✅ Subscription created for user ${passthrough.userId}, tier: ${tier}`)
  return { success: true, message: 'Subscription created successfully' }
}

async function handleSubscriptionUpdated(supabase: any, event: PaddleWebhookEvent) {
  if (!event.subscription_id) {
    return { success: false, message: 'Missing subscription ID' }
  }

  const updates: any = {
    updated_at: new Date().toISOString()
  }

  if (event.status) {
    updates.status = event.status
  }

  if (event.next_bill_date) {
    updates.current_period_end = event.next_bill_date
  }

  const { error } = await supabase
    .from('paddle_subscriptions')
    .update(updates)
    .eq('paddle_subscription_id', event.subscription_id)

  if (error) {
    console.error('Failed to update subscription:', error)
    return { success: false, message: 'Failed to update subscription' }
  }

  console.log(`✅ Subscription updated: ${event.subscription_id}`)
  return { success: true, message: 'Subscription updated successfully' }
}

async function handleSubscriptionCancelled(supabase: any, event: PaddleWebhookEvent) {
  if (!event.subscription_id) {
    return { success: false, message: 'Missing subscription ID' }
  }

  const { error } = await supabase
    .from('paddle_subscriptions')
    .update({
      status: 'cancelled',
      cancel_at_period_end: true,
      updated_at: new Date().toISOString()
    })
    .eq('paddle_subscription_id', event.subscription_id)

  if (error) {
    console.error('Failed to cancel subscription:', error)
    return { success: false, message: 'Failed to cancel subscription' }
  }

  console.log(`✅ Subscription cancelled: ${event.subscription_id}`)
  return { success: true, message: 'Subscription cancelled successfully' }
}

async function handlePaymentSucceeded(supabase: any, event: PaddleWebhookEvent) {
  if (!event.subscription_id) {
    return { success: false, message: 'Missing subscription ID' }
  }

  // Clear any grace period and ensure subscription is active
  const { error } = await supabase
    .from('paddle_subscriptions')
    .update({
      status: 'active',
      grace_period_end: null,
      current_period_start: new Date().toISOString(),
      current_period_end: event.next_bill_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('paddle_subscription_id', event.subscription_id)

  if (error) {
    console.error('Failed to update subscription after payment:', error)
    return { success: false, message: 'Failed to update subscription' }
  }

  console.log(`✅ Payment succeeded for subscription: ${event.subscription_id}`)
  return { success: true, message: 'Payment processed successfully' }
}

async function handlePaymentFailed(supabase: any, event: PaddleWebhookEvent) {
  if (!event.subscription_id) {
    return { success: false, message: 'Missing subscription ID' }
  }

  // Set 7-day grace period
  const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const { error } = await supabase
    .from('paddle_subscriptions')
    .update({
      status: 'past_due',
      grace_period_end: gracePeriodEnd.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('paddle_subscription_id', event.subscription_id)

  if (error) {
    console.error('Failed to update subscription after payment failure:', error)
    return { success: false, message: 'Failed to update subscription' }
  }

  console.log(`⚠️ Payment failed, grace period activated: ${event.subscription_id}`)
  return { success: true, message: 'Grace period activated for failed payment' }
}

function getTierFromPlanId(planId: string): 'free' | 'core' | 'studio' {
  const corePlanId = Deno.env.get('PADDLE_CORE_PLAN_ID')
  const studioPlanId = Deno.env.get('PADDLE_STUDIO_PLAN_ID')
  
  if (planId === corePlanId) return 'core'
  if (planId === studioPlanId) return 'studio'
  return 'free'
}
