// backend/routes/paddleWebhook.mjs
import { createClient } from '@supabase/supabase-js';
import express from 'express';

const router = express.Router();

// Create Supabase client for updating user profiles
let supabase = null;
function getSupabaseClient() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
  }
  return supabase;
}

// Paddle webhook handler for subscription events
router.post('/webhook', async (req, res) => {
  try {
    const { event_type, data } = req.body;
    
    
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      return res.status(500).json({ error: 'Database not available' });
    }

    switch (event_type) {
      case 'subscription.created':
      case 'subscription.updated':
        await handleSubscriptionUpdate(data, supabaseClient);
        break;
      
      case 'subscription.canceled':
        await handleSubscriptionCancel(data, supabaseClient);
        break;
      
      case 'subscription.past_due':
        await handleSubscriptionPastDue(data, supabaseClient);
        break;
      
      default:
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handleSubscriptionUpdate(data, supabaseClient) {
  const { customer_id, subscription_id, status, items } = data;
  
  // Map Paddle price IDs to Atlas tiers
  const tierMapping = {
    [process.env.VITE_PADDLE_CORE_PRICE_ID]: 'core',
    [process.env.VITE_PADDLE_STUDIO_PRICE_ID]: 'studio'
  };

  // Find the tier based on the subscription items
  let tier = 'free';
  if (items && items.length > 0) {
    const priceId = items[0].price_id;
    tier = tierMapping[priceId] || 'free';
  }

  // Update user profile
  const { error } = await supabaseClient
    .from('profiles')
    .update({
      subscription_tier: tier,
      subscription_status: status === 'active' ? 'active' : 'inactive',
      subscription_id: subscription_id,
      paddle_subscription_id: subscription_id,
      updated_at: new Date().toISOString()
    })
    .eq('email', customer_id); // Assuming customer_id is email

  if (error) {
    throw error;
  }

}

async function handleSubscriptionCancel(data, supabaseClient) {
  const { customer_id, subscription_id } = data;
  
  const { error } = await supabaseClient
    .from('profiles')
    .update({
      subscription_tier: 'free',
      subscription_status: 'cancelled',
      subscription_id: subscription_id,
      updated_at: new Date().toISOString()
    })
    .eq('email', customer_id);

  if (error) {
    throw error;
  }

}

async function handleSubscriptionPastDue(data, supabaseClient) {
  const { customer_id, subscription_id } = data;
  
  const { error } = await supabaseClient
    .from('profiles')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString()
    })
    .eq('email', customer_id);

  if (error) {
    throw error;
  }

}

export default router;
