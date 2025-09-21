// Paddle Checkout API Route
// Creates Paddle checkout sessions using live API key

import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, tier, email, priceId, successUrl, cancelUrl } = req.body;

    if (!userId || !tier || !email || !priceId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const PADDLE_API_KEY = process.env.PADDLE_API_KEY;
    if (!PADDLE_API_KEY) {
      return res.status(500).json({ error: 'Paddle API key not configured' });
    }

    // Create Paddle checkout session
    const paddleResponse = await fetch('https://api.paddle.com/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PADDLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            price_id: priceId,
            quantity: 1
          }
        ],
        customer_email: email,
        custom_data: {
          user_id: userId,
          tier: tier
        },
        checkout: {
          url: successUrl,
          cancel_url: cancelUrl
        }
      })
    });

    if (!paddleResponse.ok) {
      const error = await paddleResponse.text();
      console.error('Paddle API error:', error);
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }

    const checkoutData = await paddleResponse.json();
    
    return res.status(200).json({
      checkoutUrl: checkoutData.data.checkout.url,
      transactionId: checkoutData.data.id
    });

  } catch (error) {
    console.error('Checkout creation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
