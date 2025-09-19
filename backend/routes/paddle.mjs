// backend/routes/paddle.mjs
import express from "express";

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

export default router;
