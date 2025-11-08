# 🔧 Fix: Paddle Trigger Error

## **The Problem**

You're seeing this error in Supabase:
```
ERROR: 42P01: relation "paddle_subscriptions" does not exist
CONTEXT: PL/pgSQL function sync_paddle_subscriptions() line 3 at SQL statement
```

## **Root Cause**

When Atlas migrated from Paddle to FastSpring, the `paddle_subscriptions` table was renamed to `fastspring_subscriptions`, but the trigger function `sync_paddle_subscriptions()` was **not removed**. 

This function still tries to insert into the old `paddle_subscriptions` table whenever a profile is created or updated, causing the error.

---

## **Quick Fix (Run in Supabase SQL Editor)**

```sql
-- Drop the orphaned trigger
DROP TRIGGER IF EXISTS trigger_sync_paddle_subscriptions ON public.profiles;

-- Drop the orphaned function
DROP FUNCTION IF EXISTS public.sync_paddle_subscriptions() CASCADE;
```

---

## **Permanent Fix (Migration)**

I've created a migration file: `supabase/migrations/20250108_fix_paddle_trigger_cleanup.sql`

**To apply it:**

1. **Via Supabase Dashboard:**
   - Copy the contents of `20250108_fix_paddle_trigger_cleanup.sql`
   - Paste into Supabase SQL Editor
   - Run it

2. **Via Supabase CLI:**
   ```bash
   supabase db push
   ```

---

## **Why This Happened**

The migration `20251019_rename_paddle_to_fastspring.sql` renamed the table but didn't clean up:
- ❌ The trigger `trigger_sync_paddle_subscriptions` 
- ❌ The function `sync_paddle_subscriptions()`

These were left behind from the old Paddle integration.

---

## **Verification**

After running the fix, verify:

```sql
-- Should return 0 rows (trigger should be gone)
SELECT * FROM pg_trigger 
WHERE tgname = 'trigger_sync_paddle_subscriptions';

-- Should return 0 rows (function should be gone)
SELECT * FROM pg_proc 
WHERE proname = 'sync_paddle_subscriptions';
```

---

**Status:** ✅ Fix ready to apply  
**Impact:** Stops errors when creating/updating profiles  
**Risk:** Low - removes unused legacy code

