#!/bin/bash

# Atlas GitHub Secrets Setup Script
# This script helps set up required GitHub secrets for CI/CD

set -euo pipefail

echo "🔐 Atlas GitHub Secrets Setup"
echo "============================"
echo ""
echo "This script will guide you through setting up GitHub secrets for Atlas CI/CD."
echo "You'll need the GitHub CLI (gh) installed and authenticated."
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Please install it first:"
    echo "   brew install gh"
    echo "   gh auth login"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub. Please run: gh auth login"
    exit 1
fi

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "📦 Repository: $REPO"
echo ""

# Function to set secret
set_secret() {
    local name=$1
    local prompt=$2
    local required=${3:-true}
    
    echo "🔑 $name"
    echo "   $prompt"
    
    if [ "$required" = "true" ]; then
        read -s -p "   Enter value: " value
        echo ""
        if [ -z "$value" ]; then
            echo "   ⚠️  Skipping (required for production)"
        else
            echo "$value" | gh secret set "$name" --repo="$REPO"
            echo "   ✅ Set successfully"
        fi
    else
        read -s -p "   Enter value (optional, press Enter to skip): " value
        echo ""
        if [ -z "$value" ]; then
            echo "   ⏭️  Skipped (optional)"
        else
            echo "$value" | gh secret set "$name" --repo="$REPO"
            echo "   ✅ Set successfully"
        fi
    fi
    echo ""
}

echo "🔐 Required Secrets"
echo "=================="
echo ""

# Supabase
set_secret "VITE_SUPABASE_URL" "Supabase project URL (e.g., https://xxx.supabase.co)"
set_secret "VITE_SUPABASE_ANON_KEY" "Supabase anonymous/public key"
set_secret "SUPABASE_URL" "Same as VITE_SUPABASE_URL"
set_secret "SUPABASE_SERVICE_ROLE_KEY" "Supabase service role key (keep secure!)"

# AI Services
set_secret "ANTHROPIC_API_KEY" "Anthropic/Claude API key"
set_secret "OPENAI_API_KEY" "OpenAI API key (for Whisper/TTS)"

# URLs
set_secret "VITE_API_URL" "Backend API URL (e.g., https://api.yourdomain.com)" false
set_secret "STAGING_URL" "Staging environment URL"
set_secret "PRODUCTION_URL" "Production environment URL"

# FastSpring
echo "💳 FastSpring Integration"
echo "========================"
echo ""
set_secret "FASTSPRING_API_USERNAME" "FastSpring API username"
set_secret "FASTSPRING_API_PASSWORD" "FastSpring API password"
set_secret "FASTSPRING_WEBHOOK_SECRET" "FastSpring webhook signing secret"

# Redis
echo "🗄️  Redis Configuration"
echo "====================="
echo ""
set_secret "REDIS_URL" "Redis connection URL (e.g., redis://user:pass@host:6379)"

# Sentry (Optional)
echo "📊 Sentry Monitoring (Optional)"
echo "=============================="
echo ""
set_secret "SENTRY_DSN" "Sentry DSN for error tracking" false
set_secret "SENTRY_AUTH_TOKEN" "Sentry auth token for releases" false
set_secret "SENTRY_ORG" "Sentry organization slug" false
set_secret "SENTRY_PROJECT" "Sentry project slug" false

# Additional Optional
echo "🔧 Additional Services (Optional)"
echo "================================"
echo ""
set_secret "CODECOV_TOKEN" "Codecov token for coverage reports" false

# Summary
echo ""
echo "📋 Setup Summary"
echo "==============="
echo ""
echo "Required secrets that should be set:"
echo "  - VITE_SUPABASE_URL"
echo "  - VITE_SUPABASE_ANON_KEY" 
echo "  - SUPABASE_URL"
echo "  - SUPABASE_SERVICE_ROLE_KEY"
echo "  - ANTHROPIC_API_KEY"
echo "  - OPENAI_API_KEY"
echo "  - STAGING_URL"
echo "  - PRODUCTION_URL"
echo "  - FASTSPRING_API_USERNAME"
echo "  - FASTSPRING_API_PASSWORD"
echo "  - FASTSPRING_WEBHOOK_SECRET"
echo "  - REDIS_URL"
echo ""
echo "Optional secrets for enhanced features:"
echo "  - VITE_API_URL"
echo "  - SENTRY_DSN"
echo "  - SENTRY_AUTH_TOKEN"
echo "  - SENTRY_ORG"
echo "  - SENTRY_PROJECT"
echo "  - CODECOV_TOKEN"
echo ""
echo "To view all secrets: gh secret list --repo=$REPO"
echo "To update a secret: gh secret set SECRET_NAME --repo=$REPO"
echo ""
echo "✅ GitHub secrets setup complete!"
