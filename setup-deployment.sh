#!/bin/bash

# Atlas App Deployment Setup Script
# This script helps prepare your Atlas app for deployment to otiumcreations.com

echo "🚀 Atlas App Deployment Setup"
echo "=============================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🔨 Building the application..."
npm run build

# Check if build was successful
if [ -d "dist" ]; then
    echo "✅ Build successful! dist/ directory created."
else
    echo "❌ Build failed! Please check the error messages above."
    exit 1
fi

# Check for required environment variables
echo "🔍 Checking environment variables..."

required_vars=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY" "ANTHROPIC_API_KEY")

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "⚠️  Warning: $var is not set"
    else
        echo "✅ $var is set"
    fi
done

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Set up your domain DNS records"
echo "2. Choose a deployment option:"
echo "   - Vercel (recommended): npm i -g vercel && vercel --prod"
echo "   - Railway: Connect your GitHub repo"
echo "   - Self-hosted: Follow the DEPLOYMENT.md guide"
echo ""
echo "3. Configure your domain: otiumcreations.com"
echo "4. Set environment variables in your hosting platform"
echo "5. Test your deployment"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions" 