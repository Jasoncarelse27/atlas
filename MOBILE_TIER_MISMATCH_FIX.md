# 🔧 Mobile Tier Mismatch Fix

## 🐛 **Issue**: Mobile showing "free" tier while web shows "studio"

## ✅ **Root Cause**

**Stale localStorage cache on mobile:**
- Mobile cached "free" tier before upgrade
- Cache has 5-minute expiry, so it kept showing "free"
- Realtime updates weren't clearing the cache properly

## 🔧 **Fixes Applied**

### **1. Reduced Cache Stale Time**
- **Before**: 5 minutes stale time
- **After**: 1 minute stale time
- **Result**: Tier changes detected faster

### **2. Cache Age Verification**
- **Before**: Used cache if less than 5 minutes old
- **After**: Uses cache only if less than 1 minute old, otherwise verifies with database
- **Result**: Prevents stale cache from showing wrong tier

### **3. Realtime Cache Invalidation**
- **Before**: Realtime updates didn't clear old cache
- **After**: Realtime updates clear cache before updating
- **Result**: Instant tier sync across devices

### **4. Enhanced Logging**
- Added logging for cache age verification
- Added logging for realtime tier updates
- **Result**: Better debugging for tier sync issues

---

## 🚀 **Quick Fix for Mobile**

### **Option 1: Clear Cache and Reload** (Recommended)
1. Open mobile browser console (if available)
2. Run:
```javascript
localStorage.removeItem('atlas:tier_cache');
location.reload();
```

### **Option 2: Pull Down to Refresh**
1. Pull down on the chat page
2. This triggers `refetchOnWindowFocus`
3. Tier should refresh from database

### **Option 3: Sign Out and Sign In**
1. Sign out from mobile app
2. Sign in again
3. Tier should sync from database

---

## 🔍 **How to Verify**

### **Check Console Logs**
Look for:
```
[useTierQuery] ✅ Fetched tier from database: STUDIO for user ...
[useTierQuery] ✨ Tier updated via Realtime: FREE → STUDIO
[useTierQuery] ✅ Cache updated: STUDIO for user ...
```

### **Check localStorage Cache**
```javascript
const cached = localStorage.getItem('atlas:tier_cache');
console.log(JSON.parse(cached));
// Should show: { tier: 'studio', cachedUserId: '...', timestamp: ... }
```

### **Check Database**
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

## ✅ **Expected Behavior After Fix**

- ✅ Mobile shows correct tier on load
- ✅ Tier syncs instantly with web (via Realtime)
- ✅ Cache clears automatically on tier changes
- ✅ Cache verifies with database if older than 1 minute
- ✅ Better error messages in console

---

## 📝 **Code Changes**

### **File**: `src/hooks/useTierQuery.ts`

**Changes:**
- ✅ Reduced `staleTime` from 5 minutes to 1 minute
- ✅ Added cache age verification (1 minute threshold)
- ✅ Clear cache on realtime tier updates
- ✅ Enhanced logging for debugging

---

## 🎯 **Why This Happens**

1. **Mobile cached "free" tier** before upgrade
2. **Cache expiry** is 5 minutes, so it kept showing "free"
3. **Realtime updates** weren't clearing the cache
4. **Web had fresh cache** from recent upgrade

**After fix:**
- Cache expires faster (1 minute)
- Realtime updates clear cache
- Cache verifies with database if stale
- Mobile and web stay in sync

---

## 🆘 **Still Not Working?**

1. **Clear all cache**: `localStorage.clear(); location.reload();`
2. **Check console logs**: Look for `[useTierQuery]` messages
3. **Verify database**: Check `profiles.subscription_tier` in Supabase
4. **Sign out/in**: Force fresh session

---

**The fix is deployed - try clearing cache and reloading mobile!** 🚀

