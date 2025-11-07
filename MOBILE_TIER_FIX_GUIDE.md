# 🔧 Mobile Tier Fix Guide

## 🐛 **Issue**: Mobile showing "free" tier instead of correct tier

## ✅ **Fixes Applied**

### **1. Enhanced Tier Fetching**
- ✅ Re-enabled `refetchOnWindowFocus` to catch tier changes when app comes to foreground
- ✅ Added cache clearing on session errors
- ✅ Added profile auto-creation if missing
- ✅ Enhanced logging for debugging

### **2. Force Refresh Function**
- ✅ Added `forceRefresh()` function to `useTierQuery()` hook
- ✅ Clears localStorage cache
- ✅ Clears React Query cache
- ✅ Forces fresh fetch from database

### **3. Better Error Handling**
- ✅ Clears stale cache on session errors
- ✅ Clears stale cache on network errors
- ✅ Auto-creates profile if missing

---

## 🔍 **How to Debug**

### **Step 1: Check Browser Console**

Open mobile browser console and look for:
```
[useTierQuery] 📡 Fetching tier from database for user: ...
[useTierQuery] ✅ Fetched tier from database: CORE for user ...
```

### **Step 2: Check localStorage Cache**

In browser console:
```javascript
// Check cached tier
const cached = localStorage.getItem('atlas:tier_cache');
console.log(JSON.parse(cached));

// Clear cache manually
localStorage.removeItem('atlas:tier_cache');
location.reload();
```

### **Step 3: Force Refresh Tier**

In browser console:
```javascript
// Access React Query client
const queryClient = window.__REACT_QUERY_CLIENT__;
if (queryClient) {
  queryClient.invalidateQueries({ queryKey: ['user-tier'] });
  location.reload();
}
```

### **Step 4: Check Supabase Database**

Run in Supabase SQL Editor:
```sql
SELECT 
  u.email,
  p.subscription_tier,
  p.updated_at
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email = 'jasonc.jpg@gmail.com';
```

---

## 🚀 **Quick Fixes**

### **Fix 1: Clear Cache and Reload**
1. Open mobile browser
2. Open browser console (if available)
3. Run: `localStorage.removeItem('atlas:tier_cache'); location.reload();`

### **Fix 2: Sign Out and Sign In**
1. Sign out from mobile app
2. Sign in again
3. Tier should sync from database

### **Fix 3: Pull Down to Refresh**
1. Pull down on the chat page
2. This triggers `refetchOnWindowFocus`
3. Tier should refresh from database

---

## 📱 **Mobile-Specific Issues**

### **Issue 1: Stale localStorage Cache**
**Symptom**: Mobile shows old tier even after upgrade
**Fix**: Clear cache (see Fix 1 above)

### **Issue 2: Session Expired**
**Symptom**: Mobile shows "free" tier, user is logged out
**Fix**: Sign in again

### **Issue 3: Profile Missing**
**Symptom**: Error in console: `PGRST116` (profile not found)
**Fix**: Profile will auto-create on next fetch (already fixed)

### **Issue 4: Network Error**
**Symptom**: Console shows "Failed to fetch"
**Fix**: Check internet connection, cache will clear automatically

---

## 🔄 **How Tier Sync Works**

1. **On App Load**: Fetches tier from database
2. **On Window Focus**: Refetches tier (mobile comes to foreground)
3. **On Network Reconnect**: Refetches tier
4. **On Realtime Update**: Instantly updates tier (WebSocket)

---

## ✅ **Verification**

After fixes, mobile should:
- ✅ Show correct tier immediately
- ✅ Sync with web browser tier
- ✅ Update instantly when tier changes
- ✅ Clear stale cache automatically

---

## 🆘 **Still Not Working?**

1. **Check Console Logs**: Look for `[useTierQuery]` messages
2. **Verify Database**: Check `profiles.subscription_tier` in Supabase
3. **Clear All Cache**: `localStorage.clear(); location.reload();`
4. **Sign Out/In**: Force fresh session

---

## 📝 **Code Changes**

### **File**: `src/hooks/useTierQuery.ts`

**Changes:**
- ✅ Re-enabled `refetchOnWindowFocus: true`
- ✅ Added cache clearing on errors
- ✅ Added `forceRefresh()` function
- ✅ Enhanced logging
- ✅ Auto-create profile if missing

**New Function:**
```typescript
const { tier, forceRefresh } = useTierQuery();

// Force refresh tier (clears cache and fetches fresh)
await forceRefresh();
```

---

## 🎯 **Expected Behavior**

After fixes:
- ✅ Mobile shows correct tier on load
- ✅ Tier syncs instantly with web
- ✅ Cache clears automatically on errors
- ✅ Profile auto-creates if missing
- ✅ Better error messages in console

