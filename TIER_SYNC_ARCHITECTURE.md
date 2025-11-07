# 🎯 Atlas Unified Tier Sync Architecture

## 📋 Executive Summary

**Problem**: Mobile and web tier logic were not syncing due to multiple independent caching layers with inconsistent invalidation.

**Solution**: Centralized cache invalidation service that ensures all caches (mobile, web, services) are cleared simultaneously when tier changes.

**Status**: ✅ **IMPLEMENTED** - All tier-related caches now sync via unified invalidation system.

---

## 🏗️ Architecture Overview

### **Single Source of Truth**
```
┌─────────────────────────────────────────┐
│  Supabase Database (profiles table)     │
│  subscription_tier column                │
│  ← Single Source of Truth               │
└───────────────┬─────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐   ┌──────────────┐
│   Backend    │   │   Frontend   │
│  (Always     │   │  (Cached +   │
│   fetches    │   │   Realtime)  │
│   from DB)   │   │              │
└──────────────┘   └──────────────┘
```

### **Cache Layers**

1. **Backend Cache** (Redis)
   - Cleared via `invalidateTierCache()` middleware
   - Always fetches from database (security)

2. **Frontend Caches** (Multiple layers)
   - `useTierQuery`: localStorage (5 min) + React Query (1 min stale)
   - `TierContext`: In-memory (30 sec)
   - `fastspringService`: In-memory Map (5 min)
   - `subscriptionApi`: In-memory Map (30 min)

---

## 🔄 Unified Cache Invalidation Flow

### **When Tier Changes:**

```
Tier Change Event (Webhook/Realtime/Manual)
         │
         ▼
┌────────────────────────────┐
│ cacheInvalidationService   │
│ .onTierChange()            │
└────────────┬───────────────┘
             │
             ├─► Clear FastSpring cache
             ├─► Clear SubscriptionAPI cache
             ├─► Clear localStorage (including useTierQuery)
             ├─► Clear Dexie offline cache
             ├─► Broadcast to other tabs (BroadcastChannel)
             └─► Dispatch 'tier-changed' event
                     │
                     ├─► useTierQuery listens → Updates React Query cache
                     ├─► TierContext listens → Refreshes global state
                     └─► All components re-render with new tier
```

---

## 📁 Key Files

### **1. Centralized Invalidation Service**
**File**: `src/services/cacheInvalidationService.ts`

**Responsibilities**:
- Clears ALL tier-related caches simultaneously
- Broadcasts tier changes across browser tabs
- Dispatches custom events for React components

**Key Methods**:
```typescript
// Clear all caches for a user
invalidateUserTier(userId: string): Promise<void>

// Handle tier change (clears caches + broadcasts)
onTierChange(userId: string, newTier: Tier, source: string): Promise<void>

// Force refresh from server
forceRefresh(userId: string): Promise<Tier>
```

### **2. Primary Tier Hook**
**File**: `src/hooks/useTierQuery.ts`

**Features**:
- React Query for automatic caching/refetching
- Supabase Realtime for instant updates
- localStorage cache for instant loading
- Listens for centralized invalidation events

**Cache Strategy**:
- localStorage: 5 minutes (instant loading)
- React Query: 1 minute stale, 30 minutes cache
- Realtime: Instant updates via WebSocket

**Integration**:
- Triggers `cacheInvalidationService.onTierChange()` on Realtime updates
- Listens for `tier-cache-invalidated` and `tier-changed` events
- Uses centralized invalidation in `forceRefresh()`

### **3. Tier Context**
**File**: `src/contexts/TierContext.tsx`

**Features**:
- Global tier state (prevents duplicate fetches)
- 30-second cache duration
- Listens for centralized invalidation events

**Integration**:
- Listens for `tier-changed` and `tier-cache-invalidated` events
- Forces refresh when cache is invalidated

---

## 🔧 How It Works

### **Scenario 1: Webhook Updates Tier**

```
1. FastSpring webhook → Supabase Edge Function
2. Edge Function updates profiles.subscription_tier
3. Supabase Realtime triggers UPDATE event
4. useTierQuery Realtime listener receives event
5. useTierQuery triggers cacheInvalidationService.onTierChange()
6. All caches cleared (mobile + web)
7. React Query cache updated with new tier
8. All components re-render with new tier
```

### **Scenario 2: Manual Tier Change (Admin)**

```
1. Admin updates tier in database
2. Supabase Realtime triggers UPDATE event
3. Same flow as Scenario 1
```

### **Scenario 3: Cross-Tab Sync**

```
1. User upgrades tier in Tab A
2. cacheInvalidationService broadcasts via BroadcastChannel
3. Tab B receives broadcast
4. Tab B triggers cache invalidation
5. Tab B refreshes tier from database
6. Both tabs show same tier
```

---

## ✅ Best Practices Implemented

### **1. Single Source of Truth**
- ✅ Database (`profiles.subscription_tier`) is the only source
- ✅ Backend always fetches from database (never trusts client)
- ✅ Frontend caches are for performance only

### **2. Unified Invalidation**
- ✅ All caches cleared simultaneously
- ✅ No stale cache issues
- ✅ Consistent tier across mobile/web

### **3. Real-Time Sync**
- ✅ Supabase Realtime for instant updates
- ✅ BroadcastChannel for cross-tab sync
- ✅ Custom events for React components

### **4. Fail-Safe Mechanisms**
- ✅ Fallback cache clearing if service unavailable
- ✅ Cache age verification (1 minute threshold)
- ✅ Force refresh option for manual sync

### **5. Security**
- ✅ Backend never trusts client-sent tier
- ✅ Cache cleared on logout
- ✅ Fail-closed (defaults to 'free' tier on error)

---

## 🧪 Testing Tier Sync

### **Test 1: Webhook Update**
```sql
-- Update tier in database
UPDATE profiles
SET subscription_tier = 'studio'
WHERE id = '<user-id>';
```

**Expected**:
- ✅ Mobile app shows 'studio' tier (via Realtime)
- ✅ Web app shows 'studio' tier (via Realtime)
- ✅ All caches cleared and refreshed

### **Test 2: Cross-Tab Sync**
1. Open app in two browser tabs
2. Upgrade tier in Tab A
3. Check Tab B

**Expected**:
- ✅ Tab B automatically updates (via BroadcastChannel)
- ✅ Both tabs show same tier

### **Test 3: Cache Invalidation**
```javascript
// In browser console
import { cacheInvalidationService } from './src/services/cacheInvalidationService';
await cacheInvalidationService.invalidateUserTier('<user-id>');
```

**Expected**:
- ✅ All caches cleared
- ✅ Tier refreshed from database
- ✅ UI updates with new tier

---

## 📊 Cache Expiry Times

| Cache Layer | Expiry | Purpose |
|------------|--------|---------|
| localStorage (useTierQuery) | 5 minutes | Instant loading |
| React Query (useTierQuery) | 1 min stale, 30 min cache | Automatic refetching |
| TierContext | 30 seconds | Global state |
| fastspringService | 5 minutes | Service-level cache |
| subscriptionApi | 30 minutes | API response cache |
| Backend Redis | Varies | Server-side cache |

**Note**: All caches are invalidated immediately on tier change via centralized service.

---

## 🚨 Troubleshooting

### **Issue: Mobile shows wrong tier**

**Solution**:
1. Check database: `SELECT subscription_tier FROM profiles WHERE id = '<user-id>'`
2. Clear cache: `localStorage.removeItem('atlas:tier_cache')`
3. Force refresh: Call `forceRefresh()` from `useTierQuery`
4. Check Realtime connection: Look for `[useTierQuery] ✅ Realtime ready` in console

### **Issue: Web and mobile out of sync**

**Solution**:
1. Verify both use same user account (same `user.id`)
2. Check Realtime subscription is active
3. Manually trigger invalidation: `cacheInvalidationService.invalidateUserTier(userId)`
4. Check for network errors preventing Realtime updates

### **Issue: Cache not clearing**

**Solution**:
1. Check `cacheInvalidationService` is imported correctly
2. Verify custom events are dispatched: `window.dispatchEvent(new CustomEvent('tier-changed', { detail: { userId, newTier } }))`
3. Check browser console for errors
4. Verify BroadcastChannel is supported (modern browsers)

---

## 📝 Migration Notes

### **Before (Problem)**:
- Multiple independent caches
- Inconsistent invalidation
- Mobile/web out of sync
- Stale cache issues

### **After (Solution)**:
- ✅ Centralized invalidation service
- ✅ All caches cleared simultaneously
- ✅ Real-time sync via Realtime + BroadcastChannel
- ✅ Consistent tier across platforms

---

## 🎯 Key Takeaways

1. **Single Source of Truth**: Database is the only source
2. **Unified Invalidation**: One service clears all caches
3. **Real-Time Sync**: Realtime + BroadcastChannel for instant updates
4. **Fail-Safe**: Fallbacks and error handling throughout
5. **Security**: Backend never trusts client, always fetches from DB

---

**Last Updated**: December 2025
**Status**: ✅ Production Ready

