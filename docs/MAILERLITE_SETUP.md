# MailerLite Integration Setup

## Overview

Atlas integrates with MailerLite to send welcome emails and manage subscriber segments. This document explains the setup process.

## How It Works

1. When a user signs up, they are automatically:
   - Added to MailerLite as a subscriber
   - Added to the `atlas_free_users` group
   - This triggers the welcome email automation

2. The system has multiple fallback mechanisms:
   - Primary: Direct API call from frontend after signup
   - Backup: Database queue processed by cron job
   - Failsafe: Backend onboarding service

## Required Environment Variables

```bash
# MailerLite API Key (from MailerLite dashboard)
MAILERLITE_API_KEY=your_api_key_here

# Group IDs (optional - system will fetch if not provided)
MAILERLITE_GROUP_FREE_ID=123456789  # ID for atlas_free_users group
MAILERLITE_GROUP_CORE_ID=123456790  # ID for core_subscribers group
MAILERLITE_GROUP_STUDIO_ID=123456791 # ID for studio_subscribers group
```

## Setting Up Groups in MailerLite

1. Log in to MailerLite
2. Go to Audience → Groups
3. Create these groups:
   - `atlas_free_users` - For all free tier users
   - `core_subscribers` - For Core tier subscribers
   - `studio_subscribers` - For Studio tier subscribers
   - `atlas_upgrade_ready` - For users ready to upgrade

## Setting Up Welcome Email Automation

1. Go to Automations → Create New
2. Choose trigger: "Subscriber joins a group"
3. Select group: `atlas_free_users`
4. Design your welcome email
5. Activate the automation

## Database Setup

Run the migration to create the signup queue:
```bash
supabase db push
```

## Cron Job Setup (Optional)

To ensure no signups are missed, set up a cron job to process the queue:

### Option 1: Railway Cron (Recommended)
Add to your Railway service:
```
CRON_SCHEDULE="*/5 * * * *"  # Every 5 minutes
```

### Option 2: External Cron Service
Call this endpoint every 5 minutes:
```
POST https://your-backend.railway.app/internal/process-signup-queue
Authorization: Bearer YOUR_INTERNAL_SECRET
```

### Option 3: Supabase Edge Function
Create an edge function that runs on a schedule:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const response = await fetch('https://your-backend.railway.app/internal/process-signup-queue', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('INTERNAL_SECRET')}`
    }
  });
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

## Testing

1. Create a test user account
2. Check MailerLite dashboard for:
   - New subscriber created
   - Added to `atlas_free_users` group
   - Welcome email sent
3. Check database for:
   - Entry in `user_signup_queue` table
   - `processed` = true after successful sync

## Troubleshooting

### Welcome emails not sending
1. Check MailerLite automation is active
2. Check trigger is set to "joins group"
3. Verify group name matches exactly
4. Check API key is valid
5. Check backend logs for sync errors

### Users not added to group
1. Ensure group exists in MailerLite
2. Check group ID environment variables
3. Verify API has group management permissions
4. Check for rate limiting

### Queue not processing
1. Verify cron job is running
2. Check INTERNAL_SECRET is set
3. Look for errors in `user_signup_queue.last_error`
4. Check backend logs for processing errors
