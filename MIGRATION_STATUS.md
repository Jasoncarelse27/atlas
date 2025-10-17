# Atlas Database Migration Status

## Overview
This document tracks the status of database migrations for the Atlas application.

## Applied Migrations

### ✅ Usage Tracking Tables (20250918_create_usage_tracking_tables.sql)
**Status**: Ready to apply  
**Tables Created**:
- `daily_usage` - Tracks daily conversation counts and usage per user
- `usage_logs` - Event logs for billing analysis
- `error_logs` - Error monitoring logs
- `response_cache` - Caches common emotional intelligence queries

**Verification Query**:
```sql
-- Check if daily_usage table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'daily_usage'
);

-- View table structure
\d daily_usage

-- Check sample data
SELECT * FROM daily_usage LIMIT 5;
```

## How to Apply Migrations

### Production (Supabase Dashboard)
1. Go to Supabase Dashboard > SQL Editor
2. Copy the contents of `supabase/migrations/20250918_create_usage_tracking_tables.sql`
3. Paste and run the migration
4. Verify with the queries above

### Local Development
```bash
# If using Supabase CLI
supabase db push

# Or manually via psql
psql $DATABASE_URL < supabase/migrations/20250918_create_usage_tracking_tables.sql
```

## Migration Notes

### Daily Usage Table
- Enforces unique constraint on (user_id, date) to prevent duplicate entries
- Includes tier tracking (note: uses 'free', 'basic', 'premium' - may need update for 'core', 'studio')
- Automatically tracks API cost estimates
- RLS policies ensure users can only see their own data

### Response Cache Table
- Improves performance by caching common emotional intelligence queries
- Expires automatically based on `expires_at` timestamp
- Public read access for performance
- Tier-specific caching to ensure appropriate responses

## TODO for Production
- [ ] Update tier enum values in daily_usage table from ('free', 'basic', 'premium') to ('free', 'core', 'studio')
- [ ] Apply migration to production Supabase instance
- [ ] Verify RLS policies are working correctly
- [ ] Set up scheduled job for `cleanup_expired_cache()` function

## Rollback Instructions
If needed, use: `supabase/migrations/20250918_create_usage_tracking_tables.down.sql`
