// Atlas FastSpring Overage Invoice Service
// Cursor-Style Billing System - FastSpring Integration for Overage Charges
// Creates one-time orders in FastSpring for overage billing

import { logger } from '../lib/simpleLogger.mjs';
import { supabase } from '../config/supabaseClient.mjs';

/**
 * Create a one-time overage invoice in FastSpring
 * 
 * FastSpring supports one-time orders via their Orders API.
 * This creates an order linked to the user's FastSpring account.
 * 
 * @param {Object} params - Invoice parameters
 * @param {string} params.userId - User ID
 * @param {number} params.amountUsd - Amount to charge in USD
 * @param {string} params.description - Invoice description (e.g. "Atlas Usage for November 2025 (Mid-Month Invoice)")
 * @param {string} params.billingPeriodId - Billing period ID (for tracking)
 * @returns {Promise<Object>} { orderId, receiptUrl } or null on failure
 */
export async function createOverageInvoice({ userId, amountUsd, description, billingPeriodId }) {
  if (!userId || !amountUsd || !description) {
    throw new Error('Missing required parameters for overage invoice');
  }

  // Get FastSpring credentials from environment
  const FASTSPRING_API_USERNAME = process.env.FASTSPRING_API_USERNAME;
  const FASTSPRING_API_PASSWORD = process.env.FASTSPRING_API_PASSWORD;
  const FASTSPRING_STORE_ID = process.env.FASTSPRING_STORE_ID;

  if (!FASTSPRING_API_USERNAME || !FASTSPRING_API_PASSWORD || !FASTSPRING_STORE_ID) {
    logger.error('[FastSpringOverage] FastSpring credentials not configured');
    throw new Error('FastSpring API credentials not configured');
  }

  try {
    // Get user's email and FastSpring account ID from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.email) {
      logger.error('[FastSpringOverage] Failed to fetch user email:', profileError);
      throw new Error(`Failed to fetch user email: ${profileError?.message || 'Not found'}`);
    }

    // Get user's FastSpring subscription to link the order
    const { data: subscription, error: subError } = await supabase
      .from('fastspring_subscriptions')
      .select('fastspring_subscription_id, fastspring_account_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    // FastSpring account ID is optional - if not found, we'll use email
    const fastspringAccountId = subscription?.fastspring_account_id || null;

    // FastSpring API base URL
    const apiBaseUrl = 'https://api.fastspring.com';

    // Create Basic Auth header
    const authString = Buffer.from(`${FASTSPRING_API_USERNAME}:${FASTSPRING_API_PASSWORD}`).toString('base64');

    // Create one-time order via FastSpring Orders API
    // FastSpring Orders API: POST /orders
    // Documentation: https://docs.fastspring.com/integrating-with-fastspring/orders-api
    
    const orderPayload = {
      account: fastspringAccountId ? { id: fastspringAccountId } : { email: profile.email },
      items: [
        {
          product: 'atlas-usage-overage', // One-time product for overages (must be created in FastSpring dashboard)
          quantity: 1,
          display: {
            unitPrice: {
              amount: amountUsd.toFixed(2),
              currency: 'USD'
            },
            description: description
          }
        }
      ],
      tags: {
        user_id: userId,
        billing_period_id: billingPeriodId,
        type: 'overage'
      }
    };

    logger.info(`[FastSpringOverage] Creating one-time order for user ${userId}: $${amountUsd.toFixed(2)} - ${description}`);

    const fastspringResponse = await fetch(`${apiBaseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload)
    });

    if (!fastspringResponse.ok) {
      const errorText = await fastspringResponse.text();
      logger.error(`[FastSpringOverage] FastSpring API Error (${fastspringResponse.status}):`, errorText);
      
      // Don't throw - return null so caller can handle gracefully
      return null;
    }

    const orderData = await fastspringResponse.json();
    
    // Extract order ID and receipt URL from response
    const orderId = orderData.id || orderData.order || null;
    const receiptUrl = orderData.receiptUrl || orderData.receipt_url || null;

    if (!orderId) {
      logger.error('[FastSpringOverage] FastSpring response missing order ID:', JSON.stringify(orderData));
      return null;
    }

    logger.info(`[FastSpringOverage] ✅ Created FastSpring order: ${orderId} for user ${userId}`);

    return {
      orderId,
      receiptUrl: receiptUrl || `https://${FASTSPRING_STORE_ID.replace(/_/g, '-')}.fastspring.com/receipt/${orderId}`
    };

  } catch (error) {
    logger.error('[FastSpringOverage] Unexpected error creating overage invoice:', error);
    // Don't throw - return null so caller can handle gracefully
    return null;
  }
}

/**
 * Get FastSpring order details (for receipt URL if not returned in creation)
 * 
 * @param {string} orderId - FastSpring order ID
 * @returns {Promise<string|null>} Receipt URL or null
 */
export async function getFastSpringOrderReceiptUrl(orderId) {
  if (!orderId) {
    return null;
  }

  const FASTSPRING_API_USERNAME = process.env.FASTSPRING_API_USERNAME;
  const FASTSPRING_API_PASSWORD = process.env.FASTSPRING_API_PASSWORD;
  const FASTSPRING_STORE_ID = process.env.FASTSPRING_STORE_ID;

  if (!FASTSPRING_API_USERNAME || !FASTSPRING_API_PASSWORD || !FASTSPRING_STORE_ID) {
    return null;
  }

  try {
    const apiBaseUrl = 'https://api.fastspring.com';
    const authString = Buffer.from(`${FASTSPRING_API_USERNAME}:${FASTSPRING_API_PASSWORD}`).toString('base64');

    const response = await fetch(`${apiBaseUrl}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      logger.warn(`[FastSpringOverage] Failed to fetch order ${orderId}: ${response.status}`);
      return null;
    }

    const orderData = await response.json();
    return orderData.receiptUrl || orderData.receipt_url || null;

  } catch (error) {
    logger.warn('[FastSpringOverage] Error fetching order receipt URL:', error.message);
    return null;
  }
}

