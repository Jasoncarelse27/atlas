#!/bin/bash

# Deploy the monitoring edge function to Supabase
# This function bypasses RLS restrictions for usage_logs

echo "🚀 Deploying monitoring edge function..."

# Deploy the edge function
supabase functions deploy log-sync-metrics

if [ $? -eq 0 ]; then
    echo "✅ Monitoring edge function deployed successfully!"
    echo "📊 Sync metrics will now be logged properly"
    echo "🔧 No more 403 Forbidden errors in console"
else
    echo "❌ Failed to deploy monitoring function"
    echo "💡 The app will still work, but monitoring will be disabled"
    exit 1
fi
