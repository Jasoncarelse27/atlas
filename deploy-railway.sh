#!/bin/bash

# 🚀 Atlas Railway Deployment Script
# This script deploys the Edge Function to Railway

echo "🚀 Deploying Atlas to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "   npm install -g @railway/cli"
    exit 1
fi

# Check if we're logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway. Please run:"
    echo "   railway login"
    exit 1
fi

# Deploy to Railway
echo "📦 Deploying to Railway..."
railway up

if [ $? -eq 0 ]; then
    echo "✅ Railway deployment successful!"
    echo ""
    echo "🔗 Your app is available at:"
    echo "   https://your-app-name.railway.app"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Check Railway dashboard for the deployment URL"
    echo "   2. Test the Edge Function endpoint"
    echo "   3. Verify CORS is working"
    echo "   4. Update your frontend with the new URL"
else
    echo "❌ Railway deployment failed. Please check the error messages above."
    exit 1
fi
