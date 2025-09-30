#!/bin/bash

# Atlas Memory Test Script
URL="http://localhost:3000/message"
TOKEN="mock-token-for-development"
USER_ID="65fcb50a-d67d-453e-a405-50c6aef959be"

echo "🧪 Testing Atlas memory system..."

# Step 1: Tell Atlas your name
echo "👤 Step 1: Telling Atlas my name..."
RESPONSE1=$(curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"userId\":\"$USER_ID\",\"tier\":\"free\",\"message\":\"My name is Jason, please remember this\"}")

echo "📥 Response 1:"
echo $RESPONSE1 | jq .response
echo ""

# Extract conversationId from response
CONV_ID=$(echo $RESPONSE1 | jq -r .conversationId)
echo "🧠 Captured conversationId: $CONV_ID"
echo ""

# Step 2: Ask Atlas to recall your name
echo "❓ Step 2: Asking Atlas to recall my name..."
RESPONSE2=$(curl -s -X POST $URL \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"userId\":\"$USER_ID\",\"tier\":\"free\",\"message\":\"What is my name?\",\"conversationId\":\"$CONV_ID\"}")

echo "📥 Response 2:"
echo $RESPONSE2 | jq .response
echo ""

# Check if memory worked
if echo $RESPONSE2 | jq .response | grep -i "jason"; then
    echo "🎉 ✅ MEMORY WORKS! Atlas remembered the name Jason!"
else
    echo "❌ 💔 Memory failed - Atlas didn't remember the name"
fi