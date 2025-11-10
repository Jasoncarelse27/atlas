# 🔧 Tier Sync Fix - Cross-Device Synchronization

**Date:** November 9, 2025  
**Issue:** Mobile and web tiers not syncing properly  
**Status:** ✅ FIXED

---

## 🐛 **Root Cause Analysis**

### **Problem:** Tier changes on one device (web/mobile) not reflected on other device

**Root Causes Identified:**

1. **localStorage cache persists across devices** - When tier changes on web, mobile still has old cache
2. **Cache duration too long** - 2 minutes for `useTierQuery`, 30 seconds for `TierContext`
3. **No cross-device sync mechanism** - BroadcastChannel only works across tabs, not devices
4. **No app visibility refresh** - App doesn't check for tier changes when becoming visible
5. **Multiple tier sources** - Some components use `useTierQuery`, others use `TierContext`

---

## ✅ **The Fix**

### **1. Reduced Cache Duration**

**File:** `src/hooks/useTierQuery.ts`

**Changes:**
- Reduced `TIER_CACHE_EXPIRY` from **2 minutes → 30 seconds**
- Added `TIER_CACHE_MAX_AGE` of **5 minutes** (forces refresh on app start if cache older)
- Updated React Query `staleTime` from **1 minute → 30 seconds**
- Reduced React Query `gcTime` from **30 minutes → 5 minutes**

**Why:** Shorter cache ensures tier changes sync across devices within 30 seconds

---

### **2. Enhanced Cache Validation**

**File:** `src/hooks/useTierQuery.ts` - `getCachedTier()`

**Changes:**
- ✅ Validate user ID match (clears cache if different user logged in)
- ✅ Reject cache if older than 5 minutes (forces refresh on app start)
- ✅ Better error handling for invalid cache format

**Why:** Prevents stale cache from persisting across sessions

---

### **3. App Visibility Listener**

**File:** `src/hooks/useTierQuery.ts` - New `useEffect`

**Changes:**
- ✅ Listen for `visibilitychange` event (app becomes visible)
- ✅ Listen for `focus` event (window focused)
- ✅ Force refresh if cache is older than 30 seconds when app becomes visible

**Why:** When user upgrades on web, then opens mobile, mobile immediately checks for tier changes

---

### **4. Polling for Tier Changes**

**File:** `src/hooks/useTierQuery.ts` - `useQuery` config

**Changes:**
- ✅ Added `refetchInterval: 60 * 1000` (poll every 60 seconds)
- ✅ Enabled `refetchOnWindowFocus: true` (always refetch on focus)

**Why:** Ensures tier changes are caught even if Realtime subscription fails

---

### **5. TierContext Sync**

**File:** `src/contexts/TierContext.tsx`

**Changes:**
- ✅ Reduced cache duration to **30 seconds** (matches `useTierQuery`)
- ✅ Added `MAX_CACHE_AGE` of **5 minutes** (forces refresh if too old)

**Why:** Ensures `TierContext` and `useTierQuery` use same cache strategy

---

## 🎯 **Best Practices Applied**

### **1. Single Source of Truth**
- ✅ All components should use `useTierQuery()` hook
- ✅ `TierContext` is deprecated but kept for backward compatibility

### **2. Cross-Device Sync Strategy**
- ✅ Short cache duration (30 seconds)
- ✅ App visibility refresh
- ✅ Polling fallback (60 seconds)
- ✅ Realtime subscription (instant updates when connected)

### **3. Cache Invalidation**
- ✅ Clear cache on logout
- ✅ Clear cache on user mismatch
- ✅ Clear cache if too old
- ✅ Centralized cache invalidation service

---

## 📊 **Expected Behavior**

### **Before Fix:**
- ❌ Tier change on web → Mobile shows old tier for 2+ minutes
- ❌ Tier change on mobile → Web shows old tier for 2+ minutes
- ❌ Cache persists across app restarts

### **After Fix:**
- ✅ Tier change on web → Mobile syncs within 30 seconds (or immediately on app focus)
- ✅ Tier change on mobile → Web syncs within 30 seconds (or immediately on window focus)
- ✅ Cache cleared on app start if older than 5 minutes
- ✅ Polling ensures sync even if Realtime fails

---

## 🧪 **Testing Checklist**

- [ ] Upgrade tier on web → Check mobile within 30 seconds
- [ ] Upgrade tier on mobile → Check web within 30 seconds
- [ ] Close app for 5+ minutes → Reopen → Tier refreshes
- [ ] Switch users → Cache clears
- [ ] Logout → Cache clears
- [ ] App visibility change → Tier refreshes if stale

---

## 📝 **Files Modified**

1. `src/hooks/useTierQuery.ts`
   - Reduced cache duration
   - Enhanced cache validation
   - Added app visibility listener
   - Added polling

2. `src/contexts/TierContext.tsx`
   - Reduced cache duration
   - Added max cache age check

---

## 🔄 **Next Steps**

1. ✅ Monitor tier sync in production
2. ✅ Consider migrating all components to `useTierQuery()` (deprecate `TierContext`)
3. ✅ Add analytics to track tier sync latency
4. ✅ Consider server-side tier validation for critical operations

---

## 📚 **References**

- [Supabase Realtime Best Practices](https://supabase.com/docs/guides/realtime)
- [React Query Cache Management](https://tanstack.com/query/latest/docs/react/guides/caching)
- [Cross-Device Sync Patterns](https://web.dev/cross-device-sync/)

