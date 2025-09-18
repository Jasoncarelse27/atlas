#!/bin/bash

# =====================================================
# Atlas V1 Tier Enforcement Migration Script
# Applies server-side tier enforcement to Supabase
# =====================================================

set -e

echo "🚀 Starting Atlas V1 Tier Enforcement Migration..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   curl -L https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz && sudo mv supabase /usr/local/bin/supabase"
    exit 1
fi

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Not in a Supabase project directory. Please run this from the project root."
    exit 1
fi

echo "📋 Migration Steps:"
echo "1. ✅ Add subscription_tier field to profiles table"
echo "2. ✅ Create message_usage table for monthly tracking"
echo "3. ✅ Create feature_attempts table for analytics"
echo "4. ✅ Create enforce_message_limit() function"
echo "5. ✅ Create check_feature_access() function"
echo "6. ✅ Create get_user_tier_info() function"
echo "7. ✅ Set up RLS policies for security"
echo "8. ✅ Create analytics view for monitoring"

# Apply the migration
echo "🔄 Applying migration to Supabase..."
supabase db push

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
    echo ""
    echo "🎯 Server-side tier enforcement is now active:"
    echo "   • Free tier: 15 messages/month limit enforced"
    echo "   • Core/Studio: Unlimited messages"
    echo "   • Feature access: Audio/Image locked for Free tier"
    echo "   • Analytics: All attempts logged for monitoring"
    echo ""
    echo "🧪 Test the enforcement:"
    echo "   • Send 15 messages as Free tier user → should be blocked"
    echo "   • Try audio/image features as Free tier → should be blocked"
    echo "   • Check /api/admin/tier-analytics for usage stats"
    echo ""
    echo "🔒 Security: Even if frontend is bypassed, server enforces limits!"
else
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi

echo "🎉 Atlas V1 Tier Enforcement Migration Complete!"
