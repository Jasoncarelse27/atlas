# Database Migration System Documentation

## Overview

Atlas uses Supabase CLI for database schema management with SQL migration files. All migrations are tracked in `supabase/migrations/` with timestamps to ensure proper ordering.

## Current State

- **✅ Supabase CLI Installed**: Version 2.40.7 (update available: 2.53.6)
- **✅ Project Linked**: `rbwabemtucdkytvvpzvk` (atlas-ai-app, Singapore region)
- **✅ Migrations**: 66 migration files (from 2025-01-01 to 2025-10-27)
- **✅ Config**: `supabase/config.toml` configured

## Migration Naming Convention

All migrations follow this format:

```
YYYYMMDD_description_in_snake_case.sql
```

Examples:
- `20251027_voice_v2_sessions.sql`
- `20251025_add_message_editing_support.sql`
- `20251021_scalability_indexes.sql`

## Creating New Migrations

### Method 1: Using Supabase CLI (Recommended)

```bash
# Generate a new migration file
cd /Users/jasoncarelse/atlas
supabase migration new your_migration_name

# This creates: supabase/migrations/YYYYMMDD_HHMMSS_your_migration_name.sql
```

### Method 2: Manual Creation

```bash
# Create with today's date
cd /Users/jasoncarelse/atlas/supabase/migrations
touch $(date +%Y%m%d)_your_migration_name.sql

# Then edit the file with your SQL
```

## Applying Migrations

### Apply to Remote Database (Production)

```bash
cd /Users/jasoncarelse/atlas

# Push all pending migrations to remote
supabase db push

# Push specific migration
supabase db push --include-all --version YYYYMMDD
```

### Apply to Local Database (Development)

```bash
# Start local Supabase (requires Docker)
supabase start

# Reset database with all migrations
supabase db reset

# Stop local Supabase
supabase stop
```

## Checking Migration Status

### View Remote Database Status

```bash
# Show which migrations are applied on remote
supabase migration list --remote

# Show difference between local and remote
supabase db diff --remote
```

### View Local Migrations

```bash
# List all local migration files
ls -1 supabase/migrations/*.sql

# Count migrations
ls -1 supabase/migrations/*.sql | wc -l
```

## Rolling Back Migrations

⚠️ **Warning**: Supabase doesn't have built-in rollback. You must create a new migration to reverse changes.

### Create Rollback Migration

```bash
# Example: If you need to rollback 20251027_voice_v2_sessions.sql
supabase migration new rollback_voice_v2_sessions

# In the new file, write SQL to undo the changes:
# - DROP TABLE voice_sessions;
# - Remove indexes, policies, etc.
```

## Best Practices

### DO ✅

1. **Always test locally first** (if using Docker)
   ```bash
   supabase start
   supabase db reset
   # Test your application
   ```

2. **Use descriptive names**
   ```
   ✅ 20251027_voice_v2_sessions.sql
   ❌ 20251027_new_table.sql
   ```

3. **Include comments in SQL**
   ```sql
   -- Voice V2 Sessions Table
   -- Tracks all voice call sessions with metrics and cost data
   -- Created: October 27, 2025
   ```

4. **Use idempotent SQL when possible**
   ```sql
   CREATE TABLE IF NOT EXISTS...
   CREATE INDEX IF NOT EXISTS...
   ```

5. **Handle dependencies**
   ```sql
   -- If table A depends on table B, ensure B is created first
   -- Or use multiple migrations in order
   ```

### DON'T ❌

1. **Don't edit existing migrations** (after they're applied to production)
2. **Don't use `DROP TABLE` without `IF EXISTS`**
3. **Don't skip migrations** (they must be applied in order)
4. **Don't commit broken migrations**
5. **Don't include data migrations in schema migrations** (separate them)

## Common Migration Patterns

### Adding a Table

```sql
-- supabase/migrations/YYYYMMDD_create_users_table.sql
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can view own data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
```

### Adding a Column

```sql
-- supabase/migrations/YYYYMMDD_add_avatar_to_users.sql
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS avatar_url TEXT;
```

### Creating an Index

```sql
-- supabase/migrations/YYYYMMDD_index_users_email.sql
CREATE INDEX IF NOT EXISTS idx_users_email 
  ON public.users(email);
```

### Adding RLS Policy

```sql
-- supabase/migrations/YYYYMMDD_users_rls_policies.sql
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);
```

## Migration Checklist

Before applying to production:

- [ ] Migration file named correctly (YYYYMMDD_description.sql)
- [ ] SQL is idempotent (uses IF NOT EXISTS, IF EXISTS)
- [ ] Comments explain purpose and date
- [ ] Dependencies are handled (correct order)
- [ ] RLS policies added if needed
- [ ] Indexes created for performance
- [ ] Permissions granted to appropriate roles
- [ ] Tested locally (if possible)
- [ ] Committed to git
- [ ] Applied to production: `supabase db push`

## Troubleshooting

### Migration Fails

```bash
# View detailed error
supabase db push --debug

# Check remote database state
supabase db diff --remote

# If needed, fix manually via Supabase Dashboard SQL Editor
```

### Out of Sync

If local and remote are out of sync:

```bash
# Pull current schema from remote
supabase db pull

# This creates a new migration with current remote state
# Review and commit the generated migration
```

### Cannot Connect

```bash
# Check if linked
supabase projects list

# If not linked, link to project
supabase link --project-ref rbwabemtucdkytvvpzvk

# Test connection
supabase db diff --remote
```

## Updating Supabase CLI

```bash
# Check current version
supabase --version

# Update via Homebrew (macOS)
brew upgrade supabase

# Or via npm
npm update -g supabase

# Verify new version
supabase --version
```

## Emergency Procedures

### Manual Database Fix

If a migration breaks production:

1. **Don't panic** - Supabase has automatic backups
2. **Go to Supabase Dashboard** → Project → SQL Editor
3. **Manually fix the issue** with SQL
4. **Create a new migration** to capture the fix
5. **Document what happened** in INCIDENT_LOG.md

### Restore from Backup

Via Supabase Dashboard:

1. Go to Settings → Database → Backups
2. Select backup point
3. Restore (or download and restore manually)

## Reference Links

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Supabase Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/current/)
- [RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)

## Migration History Summary

### Recent Major Migrations

- **2025-10-27**: Voice V2 sessions table with cost tracking
- **2025-10-25**: Message editing support
- **2025-10-21**: Scalability indexes for 100K+ users
- **2025-10-20**: Voice call fixes and usage logs RLS
- **2025-10-19**: Real-time profiles, message partitioning, FastSpring rename
- **2025-10-15**: Image support for messages
- **2025-01-11**: Messages realtime enabled
- **2025-01-10**: Database partitioning
- **2025-01-09**: Soft delete system
- **2025-01-01**: Initial conversation titles and RLS policies

### Migration Statistics

- **Total Migrations**: 66
- **First Migration**: 2025-01-01
- **Latest Migration**: 2025-10-27
- **Average per Month**: ~7 migrations

## Support

For migration issues:

1. Check this documentation first
2. Review migration file for errors
3. Test in Supabase Dashboard SQL Editor
4. Check Supabase project logs
5. Ask in team chat or create GitHub issue

---

**Last Updated**: October 27, 2025  
**Maintainer**: Jason Carelse  
**Project**: Atlas AI App

