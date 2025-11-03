# Failed to Fetch Error - Comprehensive Diagnosis

**Date:** November 3, 2025  
**Status:** 🔍 **DIAGNOSING** | **SEPARATE FROM VOICE ISSUES**

---

## 🔍 **Error Details**

**Affected Features:**
- `useTierQuery` - Tier fetching fails
- `ConversationSync` - Conversation sync fails

**Error Message:**
```
TypeError: Failed to fetch
```

**Stack Trace Location:**
- `useTierQuery.ts:27` - `fetchTier()` function
- `conversationSyncService.ts:89` - `deltaSync()` function

---

## 🎯 **Root Cause Analysis**

### **1. What's Working ✅**
- ✅ Railway backend: `200 OK` (healthcheck successful)
- ✅ CORS configured: Backend allows Vercel origin
- ✅ Network connectivity: Backend reachable

### **2. What's Failing ❌**
- ❌ Supabase client initialization
- ❌ Supabase API calls (`profiles` table queries)
- ❌ Network-level fetch failures (browser blocking?)

---

## 🔧 **Potential Causes**

### **Cause 1: Supabase Environment Variables Missing**
**Symptoms:**
- `Failed to fetch` on all Supabase calls
- No CORS errors (fails before CORS check)

**Fix:**
```bash
# Check Vercel Environment Variables:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### **Cause 2: CORS Blocking Supabase**
**Symptoms:**
- Network tab shows CORS error
- Request reaches Supabase but browser blocks response

**Fix:**
- Supabase handles CORS automatically ✅
- Check browser console for CORS errors

### **Cause 3: Network/Ad Blocker**
**Symptoms:**
- Ad blockers blocking Supabase requests
- Corporate firewall blocking `.supabase.co`

**Fix:**
- Disable ad blocker
- Check network console for blocked requests

### **Cause 4: Supabase Service Down**
**Symptoms:**
- All Supabase calls fail
- Can't reach `*.supabase.co`

**Fix:**
- Check Supabase status page
- Test direct Supabase URL in browser

---

## 🚀 **Quick Fix Steps**

### **Step 1: Verify Environment Variables**
```bash
# Check Vercel → Settings → Environment Variables
# Ensure these are set:
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### **Step 2: Test Supabase Directly**
```javascript
// Open browser console on Vercel site:
const supabaseUrl = 'https://xxx.supabase.co';
const supabaseKey = 'eyJhbGc...';

fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  }
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

### **Step 3: Check Browser Network Tab**
1. Open DevTools → Network tab
2. Filter by "supabase"
3. Check if requests are:
   - ✅ Sent (status pending/failed)
   - ❌ Blocked (no request sent)

### **Step 4: Add Better Error Handling**
```typescript
// src/hooks/useTierQuery.ts
async function fetchTier(): Promise<TierData> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return { tier: 'free', userId: null };
    }

    const userId = session.user.id;
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single<{ subscription_tier: Tier }>();

    if (error) {
      // ✅ BETTER ERROR LOGGING
      logger.error('[useTierQuery] Supabase error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return { tier: 'free', userId };
    }

    return { tier: data?.subscription_tier || 'free', userId };
  } catch (fetchError) {
    // ✅ CATCH NETWORK ERRORS
    logger.error('[useTierQuery] Network error:', {
      message: fetchError instanceof Error ? fetchError.message : 'Unknown',
      type: fetchError instanceof TypeError ? 'TypeError' : 'Other',
      stack: fetchError instanceof Error ? fetchError.stack : undefined
    });
    return { tier: 'free', userId: null };
  }
}
```

---

## 📊 **Current Status**

| Component | Status | Notes |
|-----------|--------|-------|
| Railway Backend | ✅ **WORKING** | Healthcheck: 200 OK |
| Supabase Client | ❌ **FAILING** | Failed to fetch |
| Voice Calls | ⚠️ **CACHE** | Browser loading old bundle |
| CORS | ✅ **CONFIGURED** | Backend allows Vercel origin |

---

## 🎯 **Next Steps**

1. ✅ **Verify Vercel env vars** - Check Supabase URL/key are set
2. ✅ **Test Supabase directly** - Use browser console test
3. ✅ **Check Network tab** - See if requests are blocked
4. ✅ **Add better error logging** - Capture exact error details
5. ✅ **Fix browser cache** - Hard refresh for voice fixes

---

## 🔥 **Priority**

**P0 (Critical):**
- Fix Supabase connectivity (blocks tier fetching, sync)

**P1 (High):**
- Voice buffer size (browser cache issue)

---

**Status:** 🔍 **INVESTIGATING** - Need to verify Supabase env vars and test direct connectivity.

