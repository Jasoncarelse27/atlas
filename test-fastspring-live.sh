#!/bin/bash
echo "🧪 Testing FastSpring Live Integration"
echo ""
echo "Testing with atlas-core product..."
curl -X POST http://localhost:8000/api/fastspring/create-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"test-user-123",
    "tier":"core",
    "email":"test@example.com",
    "productId":"atlas-core",
    "successUrl":"http://localhost:5174/subscription/success",
    "cancelUrl":"http://localhost:5174/subscription/cancel"
  }' \
  -s | jq '.'

echo ""
echo "✅ If you see a 'checkoutUrl' above, the integration is LIVE!"
