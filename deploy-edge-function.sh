#!/bin/bash

# 🚀 Atlas Edge Function Deployment Script
# This script deploys the messages Edge Function to Supabase

echo "🚀 Deploying Atlas Edge Function..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "supabase/functions/messages/index.ts" ]; then
    echo "❌ Edge Function not found. Please run this script from the project root."
    exit 1
fi

# Deploy the Edge Function
echo "📦 Deploying messages Edge Function..."
supabase functions deploy messages

if [ $? -eq 0 ]; then
    echo "✅ Edge Function deployed successfully!"
    echo ""
    echo "🔗 Your Edge Function is available at:"
    echo "   https://your-project.supabase.co/functions/v1/messages"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Update your .env.local with the correct Supabase URL"
    echo "   2. Test the function with a POST request"
    echo "   3. Verify CORS is working in your browser"
else
    echo "❌ Deployment failed. Please check the error messages above."
    exit 1
fi
