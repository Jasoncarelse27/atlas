// backend/routes/paddle.mjs
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// Simple GET endpoint to verify Paddle env vars & return a test checkout config
router.get("/paddle-test", (req, res) => {
  const { VITE_PADDLE_ENVIRONMENT, VITE_PADDLE_CLIENT_TOKEN, VITE_PADDLE_CORE_PRICE_ID, VITE_PADDLE_STUDIO_PRICE_ID } = process.env;

  if (!VITE_PADDLE_ENVIRONMENT || !VITE_PADDLE_CLIENT_TOKEN || !VITE_PADDLE_CORE_PRICE_ID) {
    return res.status(500).json({
      ok: false,
      error: "Missing Paddle environment variables",
      details: {
        VITE_PADDLE_ENVIRONMENT: !!VITE_PADDLE_ENVIRONMENT,
        VITE_PADDLE_CLIENT_TOKEN: !!VITE_PADDLE_CLIENT_TOKEN,
        VITE_PADDLE_CORE_PRICE_ID: !!VITE_PADDLE_CORE_PRICE_ID,
        VITE_PADDLE_STUDIO_PRICE_ID: !!VITE_PADDLE_STUDIO_PRICE_ID,
      },
    });
  }

  return res.json({
    ok: true,
    message: "✅ Paddle sandbox config is active!",
    environment: VITE_PADDLE_ENVIRONMENT,
    clientToken: VITE_PADDLE_CLIENT_TOKEN.substring(0, 6) + "...",
    corePriceId: VITE_PADDLE_CORE_PRICE_ID,
    studioPriceId: VITE_PADDLE_STUDIO_PRICE_ID,
    testCheckoutSnippet: `
      <script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
      <script>
        Paddle.Environment.set('${VITE_PADDLE_ENVIRONMENT}');
        Paddle.Setup({ token: '${VITE_PADDLE_CLIENT_TOKEN}' });
        
        // Test Core checkout
        function testCoreCheckout() {
          Paddle.Checkout.open({
            items: [{ priceId: '${VITE_PADDLE_CORE_PRICE_ID}', quantity: 1 }],
            successCallback: function(data) {
              console.log("✅ Core Success:", data);
              alert("Core upgrade successful!");
            }
          });
        }
        
        // Test Studio checkout  
        function testStudioCheckout() {
          Paddle.Checkout.open({
            items: [{ priceId: '${VITE_PADDLE_STUDIO_PRICE_ID}', quantity: 1 }],
            successCallback: function(data) {
              console.log("✅ Studio Success:", data);
              alert("Studio upgrade successful!");
            }
          });
        }
      </script>
      
      <h1>Atlas Paddle Test</h1>
      <button onclick="testCoreCheckout()">Test Core Upgrade ($19.99)</button>
      <button onclick="testStudioCheckout()">Test Studio Upgrade ($179.99)</button>
    `,
  });
});

// Create Paddle checkout session
router.post("/create-checkout", async (req, res) => {
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
});

export default router;
