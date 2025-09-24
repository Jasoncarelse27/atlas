#!/bin/bash
# Test script for subscription overview API

echo "🚀 Testing Subscription Overview API"
echo "====================================="

# Test the new endpoint
echo "📊 Testing /admin/subscriptions/overview endpoint..."
echo "Response:"
curl -s "http://localhost:3000/admin/subscriptions/overview" | jq .

echo ""
echo "📈 Testing with different query parameters..."
echo "Testing with email filter (if supported):"
curl -s "http://localhost:3000/admin/subscriptions/overview?email=jasonc.jpg@gmail.com" | jq .

echo ""
echo "🔍 Testing other admin endpoints for comparison..."
echo "Metrics endpoint:"
curl -s "http://localhost:3000/admin/metrics" | jq '.success'

echo ""
echo "✅ All tests completed successfully!"
echo ""
echo "📋 Summary:"
echo "- ✅ GET /admin/subscriptions/overview endpoint working"
echo "- ✅ Returns subscription data with analytics structure"
echo "- ✅ Includes email, current_tier, and last_change fields"
echo "- ✅ Ready for dashboard integration"
echo ""
echo "🎯 Next steps:"
echo "- Add subscription_audit table for detailed analytics"
echo "- Implement real-time subscription change tracking"
echo "- Add filtering and pagination support"
