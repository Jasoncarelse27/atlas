# 🚀 Next Session Action Plan
**Generated:** November 5, 2025  
**Priority:** Start with cache fix, then critical issues

---

## 🎯 SESSION GOAL
Fix Vercel edge cache issue first, then tackle critical pre-launch fixes.

---

## ⚡ STEP 1: Fix Vercel Edge Cache (15 minutes)

### Current Status
- ✅ Code is correct (wrapper exists, imports correct)
- ✅ Local build produces: `index-sQpkAN-l.js`
- ❌ Vercel serving: `index-BmS-PnKa.js` (old bundle)
- ❌ Browser console shows: `Uncaught SyntaxError: Export 'create' is not defined`

### Action Plan

#### Option A: Manual Cache Purge (Fastest - 2 minutes)
1. Go to Vercel Dashboard → Your Project → Settings
2. Find "Data Cache" or "Cache" section
3. Click "Purge Cache" or "Clear All Caches"
4. Wait 1-2 minutes
5. Hard refresh browser (Cmd+Shift+R)
6. Verify: Check console for `[Atlas] ✅ Zustand wrapper initialized`

#### Option B: Force New Deployment (5 minutes)
```bash
# Create a new commit to trigger deployment
echo "// Cache bust $(date +%s)" >> src/lib/zustand-wrapper.ts
git add src/lib/zustand-wrapper.ts
git commit -m "chore: force Vercel rebuild - cache bust"
git push
```

#### Option C: Add Cache-Busting Query Param (10 minutes)
Update `index.html` to append version query param:
```html
<script type="module" src="/src/main.tsx?v=2"></script>
```

### Verification Commands
```bash
# Check what Vercel is serving
curl -s "https://atlas-xi-tawny.vercel.app/" | grep -o 'index-[^"]*\.js'

# Should show: index-sQpkAN-l.js (or newer)
# Currently shows: index-BmS-PnKa.js (old)
```

### Expected Result
- ✅ Console shows: `[Atlas] ✅ Zustand wrapper initialized - create() preserved`
- ✅ No `Export 'create' is not defined` error
- ✅ Application loads normally

---

## 🔴 STEP 2: Fix Critical Security Issue (1-2 hours)

### Issue: Backend Accepts Client-Sent Tier
**Files to Fix:**
- `backend/middleware/dailyLimitMiddleware.mjs:16`
- `backend/middleware/promptCacheMiddleware.mjs:8`
- `backend/server.mjs:469`

### Action Plan
1. **Search for vulnerable code:**
```bash
grep -r "req.body.*tier\|tier.*req.body" backend/
```

2. **Replace with secure pattern:**
```javascript
// ❌ REMOVE:
const { tier } = req.body;

// ✅ REPLACE WITH:
const userId = req.user?.id;
const { data: profile } = await supabase
  .from('profiles')
  .select('subscription_tier')
  .eq('id', userId)
  .single();
const tier = profile?.subscription_tier || 'free';
```

3. **Test the fix:**
```bash
# Try to send fake tier
curl -X POST /api/message \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tier": "studio", "message": "test"}'

# Should ignore client tier, fetch from DB instead
```

### Verification
- [ ] All tier checks fetch from database
- [ ] No `req.body.tier` usage remains
- [ ] Test with fake tier value (should be ignored)

---

## 🔴 STEP 3: Fix Sync Architecture (3-4 hours)

### Issue: Full Sync Will Fail at Scale
**File:** `src/services/conversationSyncService.ts`

### Action Plan

1. **Read current implementation:**
```bash
# Review the problematic code
cat src/services/conversationSyncService.ts | grep -A 20 "fullSync\|deltaSync"
```

2. **Implement delta sync:**
```typescript
// Replace fullSync with deltaSync
async deltaSync(userId: string): Promise<void> {
  // Get last sync timestamp
  const lastSyncKey = `lastSync_${userId}`;
  const lastSyncTimestamp = localStorage.getItem(lastSyncKey) || 
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
  
  // Only fetch conversations updated since last sync
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .gte('updated_at', lastSyncTimestamp)
    .order('updated_at', { ascending: false })
    .limit(50); // ✅ PAGINATION
  
  // Only sync messages for changed conversations
  for (const conv of conversations) {
    await this.syncMessagesFromRemote(conv.id, userId, lastSyncTimestamp);
  }
  
  // Store new sync timestamp
  localStorage.setItem(lastSyncKey, new Date().toISOString());
}
```

3. **Update sync calls:**
```typescript
// Replace all fullSync() calls with deltaSync()
// Search for: fullSync
// Replace with: deltaSync(userId)
```

### Verification
- [ ] Only changed conversations are synced
- [ ] Pagination limits queries
- [ ] Last sync timestamp stored
- [ ] Test with multiple syncs (should be faster)

---

## 🔴 STEP 4: Add Database Partitioning (2-3 hours)

### Issue: No Partitioning for Large Tables
**Tables:** `messages`, `usage_logs`

### Action Plan

1. **Create migration file:**
```bash
# Create new migration
touch supabase/migrations/$(date +%Y%m%d)_add_partitioning.sql
```

2. **Add partitioning SQL:**
```sql
-- Partition messages table by month
CREATE TABLE messages_partitioned (
  LIKE messages INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create current month partition
CREATE TABLE messages_2025_11 PARTITION OF messages_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

-- Migrate existing data
INSERT INTO messages_partitioned SELECT * FROM messages;
DROP TABLE messages;
ALTER TABLE messages_partitioned RENAME TO messages;
```

3. **Apply migration:**
- Go to Supabase Dashboard → SQL Editor
- Run the migration
- Verify partitions created

### Verification
- [ ] Partitions created successfully
- [ ] Data migrated correctly
- [ ] Queries still work
- [ ] Performance improved

---

## 📋 QUICK START COMMANDS

### Start Session Checklist
```bash
# 1. Pull latest code
git pull origin main

# 2. Check current status
git status

# 3. Verify Zustand wrapper exists
ls -la src/lib/zustand-wrapper.ts

# 4. Check what Vercel is serving
curl -s "https://atlas-xi-tawny.vercel.app/" | grep -o 'index-[^"]*\.js'

# 5. Build locally to verify
npm run build
cat dist/index.html | grep -o 'index-[^"]*\.js'
```

### After Cache Fix
```bash
# 1. Verify fix worked
# Open browser console, should see:
# [Atlas] ✅ Zustand wrapper initialized

# 2. Check bundle hash
curl -s "https://atlas-xi-tawny.vercel.app/" | grep -o 'index-[^"]*\.js'
# Should match local build hash

# 3. Commit if needed
git add .
git commit -m "fix: Vercel cache cleared - Zustand wrapper verified"
git push
```

---

## 🎯 PRIORITY ORDER

### Must Do First (Blocking)
1. ⚡ **Fix Vercel cache** (15 min) - App is broken without this
2. 🔴 **Fix tier security** (1-2 hours) - Revenue protection
3. 🔴 **Fix sync architecture** (3-4 hours) - Scalability blocker

### Should Do Next (Important)
4. 🔴 **Add database partitioning** (2-3 hours) - Performance
5. 🟡 **Update dependencies** (30 min) - Security
6. 🟡 **Add critical tests** (4-6 hours) - Quality

### Can Defer (Post-Launch)
7. 🟢 **Accessibility audit** (2-3 hours)
8. 🟢 **Performance optimization** (3-4 hours)
9. 🟢 **Documentation** (2-3 hours)

---

## 💡 RECOMMENDED SESSION FLOW

### Session 1 (2-3 hours)
1. ⚡ Fix Vercel cache (15 min)
2. 🔴 Fix tier security (1-2 hours)
3. ✅ Test and verify (30 min)

### Session 2 (4-5 hours)
1. 🔴 Fix sync architecture (3-4 hours)
2. ✅ Test sync performance (30 min)
3. 🟡 Update dependencies (30 min)

### Session 3 (3-4 hours)
1. 🔴 Add database partitioning (2-3 hours)
2. ✅ Test and verify (30 min)
3. 🟡 Add critical tests (1 hour)

---

## 🔍 VERIFICATION CHECKLIST

After each fix, verify:

### Cache Fix
- [ ] Browser console shows wrapper init log
- [ ] No `Export 'create' is not defined` error
- [ ] Bundle hash matches local build
- [ ] App loads and functions normally

### Security Fix
- [ ] No `req.body.tier` usage found
- [ ] All tier checks fetch from database
- [ ] Test with fake tier (should be ignored)
- [ ] Revenue protection verified

### Sync Fix
- [ ] Only changed data synced
- [ ] Pagination limits queries
- [ ] Last sync timestamp stored
- [ ] Performance improved (faster syncs)

### Partitioning Fix
- [ ] Partitions created
- [ ] Data migrated correctly
- [ ] Queries still work
- [ ] Performance improved

---

## 📚 REFERENCE DOCUMENTS

- **Full Audit:** `ATLAS_COMPREHENSIVE_AUDIT_REPORT.md`
- **Best Practices:** `ATLAS_CODING_BEST_PRACTICES.md`
- **Cache Issue:** `EDGE_CACHE_FIX.md`
- **Security:** `SECURITY_DEPLOYMENT_CHECKLIST.md`

---

## 🚨 IF STUCK

### Cache Still Not Fixed?
1. Check Vercel build logs - is new code deployed?
2. Check browser cache - try Incognito mode
3. Try manual purge in Vercel dashboard
4. Add version query param to force refresh

### Security Fix Not Working?
1. Check backend logs for tier values
2. Test with curl to send fake tier
3. Verify Supabase query returns correct tier
4. Check RLS policies are active

### Sync Fix Issues?
1. Check localStorage for sync timestamps
2. Monitor network tab for query counts
3. Test with small dataset first
4. Add logging to verify delta sync working

---

**Next Session Goal:** Fix cache + security issues (2-3 hours)

