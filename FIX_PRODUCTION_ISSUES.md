# 🔧 Fix Production Issues

## **Issue 1: Budget Tracking - No Row for Today**

**Problem:** `UPDATE budget_tracking` returned "No rows returned" because there's no row for today's date.

**Fix:** Create the row first, then update:

```sql
-- Create budget tracking row for today (if doesn't exist)
INSERT INTO budget_tracking (date, tier, total_spend, request_count)
VALUES (CURRENT_DATE, 'free', 0, 0)
ON CONFLICT (date, tier) DO NOTHING;

-- Now update it
UPDATE budget_tracking 
SET total_spend = 20.00 
WHERE date = CURRENT_DATE AND tier = 'free';
```

**Or use the helper function (better):**
```sql
-- This auto-creates the row if it doesn't exist
SELECT increment_budget_tracking(CURRENT_DATE, 'free', 20.00, 0);
```

---

## **Issue 2: 401 Authentication Errors**

**Problem:** "Invalid or expired token" - Session expired or token refresh failing.

**Quick Fix:**
1. **Sign out and sign back in** on `https://atlas-xi-tawny.vercel.app`
2. This will refresh your session token

**Root Cause:** Supabase session tokens expire after 1 hour. The frontend should auto-refresh, but it's failing.

**Check:**
- Open browser console
- Look for `[AuthFetch]` logs
- If you see "Token refresh failed", the session is expired

---

## **Issue 3: 409 Message Sync Conflicts**

**Problem:** Repeated `409 Conflict` errors when syncing messages - message ID `773d825a-3c31-4308-8978-155b2b485a25` already exists.

**Fix:** The sync service should handle this, but it's stuck in a loop. 

**Quick Fix:**
1. **Clear browser storage:**
   - Open DevTools → Application → Storage
   - Clear IndexedDB (Dexie database)
   - Clear LocalStorage
   - Refresh page

2. **Or manually fix in Supabase:**
```sql
-- Check if message exists
SELECT * FROM messages WHERE id = '773d825a-3c31-4308-8978-155b2b485a25';

-- If it exists, the sync should mark it as synced
-- The frontend is trying to insert it again, causing conflicts
```

**Root Cause:** The message exists in Supabase but the local IndexedDB thinks it's unsynced, causing a retry loop.

---

## **Quick Test Fixes**

### **1. Fix Budget Tracking Test:**
```sql
-- Create rows for all tiers today
INSERT INTO budget_tracking (date, tier, total_spend, request_count)
VALUES 
  (CURRENT_DATE, 'free', 0, 0),
  (CURRENT_DATE, 'core', 0, 0),
  (CURRENT_DATE, 'studio', 0, 0)
ON CONFLICT (date, tier) DO NOTHING;

-- Now you can test
UPDATE budget_tracking 
SET total_spend = 20.00 
WHERE date = CURRENT_DATE AND tier = 'free';
```

### **2. Fix Auth:**
- Sign out → Sign back in
- Check browser console for auth errors

### **3. Fix Message Sync:**
- Clear IndexedDB and LocalStorage
- Refresh page
- Or wait for sync to complete (it will eventually stop retrying)

---

## **Priority Actions**

1. ✅ **Sign out/in** to fix auth token
2. ✅ **Create budget tracking rows** before testing
3. ✅ **Clear browser storage** to fix sync conflicts

---

**After fixes, retry your tier testing!** 🚀

