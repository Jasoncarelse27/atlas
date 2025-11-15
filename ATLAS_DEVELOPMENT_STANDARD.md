# ✅ ATLAS DEVELOPMENT STANDARD — Production-Ready for 10k Users

**Version:** 1.0  
**Date:** November 14, 2025  
**Core Principle:** Don't break what's working

---

## 🎯 **CORE PRINCIPLE**

Atlas must behave as **one synced app** across:
- Web (Chrome, Safari, Firefox)
- iOS PWA (Safari)
- Android PWA (Chrome)
- Mobile browsers

Every change must maintain **mobile/web parity** and **not break existing functionality**.

---

## ✅ **PRE-FLIGHT CHECKLIST** (Before Any Change)

Ask these 4 questions:

1. ✅ Is this feature currently **working on web**?
2. ✅ Is this feature currently **working on mobile**?
3. ✅ Does this touch **sync, storage, auth, or billing**?
4. ✅ Is this change **low-risk or high-risk**?

**If unclear → STOP → Diagnose first**

---

## 📊 **CHANGE CLASSIFICATION SYSTEM**

### **Tier 1: Simple Changes** (No Scan Required)
- CSS/styling updates
- Text/content changes
- UI component styling (non-functional)
- Documentation updates
- Non-functional improvements

**Action:** Make change → Test visually → Commit

---

### **Tier 2: Feature Changes** (1-Layer Scan)
- New UI components
- New features (non-critical)
- UX improvements
- Bug fixes (non-critical systems)

**Scan Required:** Code impact only
- Check: TypeScript types, props, imports
- Check: No breaking changes to existing APIs
- Test: Manual testing on web + mobile

**Action:** Scan → Make change → Test → Commit

---

### **Tier 3: Critical Changes** (3-Layer Scan Required)
- Auth/security changes
- Billing/payment changes
- Sync system changes
- Database schema changes
- Performance optimizations
- Protected system improvements

**Scan Required:** Code + Cross-device + Sync impact

**Layer 1: Code Scan**
- Types, props, Zustand store, React Query
- RLS policies, RPC functions, schema
- No breaking changes

**Layer 2: Cross-Device Impact**
- Does this affect offline mode?
- Does this affect web?
- Does this affect mobile?
- Does this affect background sync?

**Layer 3: Sync Stability**
- Could this cause duplicate messages?
- Could this break message ordering?
- Could this break sync metadata?
- Could this break message hydration?

**Action:** Full scan → Diagnosis → Plan → Test → Rollback plan → Commit

---

## 🔒 **PROTECTED SYSTEMS** (Can Be Improved, But Carefully)

These systems are **working** and must **not break**:

### **Critical (Never Break)**
1. **Auth system** (Supabase Auth, JWT validation)
2. **Billing system** (FastSpring integration, webhooks)
3. **Core sync** (delta sync, RLS policies, soft delete)
4. **Database schema** (Supabase migrations)

### **Important (Improve With Caution)**
5. **Tier enforcement** (`useTierAccess`, `useFeatureAccess`)
6. **Message storage** (IndexedDB/Dexie, Supabase)
7. **Real-time sync** (Supabase Realtime subscriptions)
8. **Voice calls** (V2 WebSocket, STT/TTS)

### **Standard (Can Evolve)**
9. **UI components** (can be refactored)
10. **Message rendering** (can be improved)
11. **State management** (Zustand stores)
12. **API endpoints** (non-auth, non-billing)

---

## 🚨 **EXCEPTION: Production Bugs**

If a **protected system is broken in production**:

1. ✅ **Fix immediately** (no "ask before touching" delay)
2. ✅ Still requires: **Diagnosis + Testing + Rollback plan**
3. ✅ Priority: **Production stability > Process**

---

## 📈 **10K USER REQUIREMENTS**

All changes must consider scale:

### **Database**
- ✅ All queries must be **paginated** (max 50 items per query)
- ✅ All sync operations must use **delta sync** (already implemented)
- ✅ Connection pooling must be configured
- ✅ No full table scans

### **Performance**
- ✅ All changes must be tested for **performance impact**
- ✅ Monitor: Query times, connection pool usage, memory usage
- ✅ Alert: When performance degrades >20%

### **Sync**
- ✅ Delta sync only (no full syncs)
- ✅ LastSyncedAt markers required
- ✅ Message ordering by created_at
- ✅ Soft delete timestamp propagation

### **Mobile**
- ✅ IndexedDB for offline storage (not localStorage)
- ✅ Stream large data (don't load all at once)
- ✅ Avoid synchronous blocking operations
- ✅ Test on real devices (iOS Safari, Android Chrome)

---

## 📱 **MOBILE + WEB SYNC REQUIREMENTS**

### **Data Flow** (Must Be Maintained)
```
Supabase (source of truth)
  ↓
Delta Sync → Dexie (IndexedDB offline cache)
  ↓
Zustand (UI state)
  ↓
React Components (UI)
```

### **Required Fields** (Every Message)
- `id` (UUID)
- `conversation_id` (UUID)
- `role` (user/assistant)
- `content` (text)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `deleted_at` (soft delete timestamp, nullable)
- `sync_status` (local-only, synced, failed)

### **Sync Rules**
- ✅ All deletions must be **soft delete** (already implemented)
- ✅ All updates must be **deterministic** (no random IDs)
- ✅ No race conditions (use timestamps for ordering)
- ✅ Sync loop must be unbreakable (delta sync + real-time)

---

## 🧪 **TESTING REQUIREMENTS**

### **Manual Testing** (Required for Tier 2+)
- ✅ Web: Chrome desktop
- ✅ Mobile: iOS Safari PWA
- ✅ Mobile: Android Chrome PWA
- ✅ Offline mode: Test without internet
- ✅ Poor network: Test with throttled connection

### **Performance Testing** (Required for Tier 3)
- ✅ Simulate 10k concurrent users
- ✅ Monitor database query times
- ✅ Monitor connection pool usage
- ✅ Monitor memory usage
- ✅ Alert on performance degradation

### **Cross-Device Sync Testing** (Required for Tier 3)
- ✅ Create conversation on Device A
- ✅ Verify appears on Device B
- ✅ Delete on Device A
- ✅ Verify disappears on Device B
- ✅ Test offline → online sync

---

## 💾 **CHECKPOINT SYSTEM**

Before major changes (Tier 3):

```bash
git add .
git commit -m "checkpoint: before [change description]"
```

This prevents **"lost working version"** disasters.

---

## 💰 **BUDGET-CONSCIOUS RULE**

Before any refactor:

**Ask:**
1. Is this required for **V1 launch**?
2. Is this tied to **revenue, stability, or security**?
3. Is there a **cheaper/simpler alternative**?

**If yes → Do it**  
**If no → Park it for V2**

---

## 🔍 **RESEARCH-FIRST REQUIREMENT**

Every feature request must include:

### **Best Practice Scan**
- How do other PWAs do it?
- How do WhatsApp, Telegram, Signal handle it?
- How does React Query + Dexie + Supabase behave?
- Any race conditions?
- Any sync conflicts?

### **Scalability Research** (For 10k Users)
- Will this work at 10k concurrent users?
- Database query impact?
- Memory impact?
- Network impact?

**Nothing is built without research + safety assessment.**

---

## 📊 **MONITORING & ALERTING**

### **Required Monitoring**
- ✅ Database query performance (Supabase Dashboard)
- ✅ Connection pool usage (alert at >80%)
- ✅ Sync latency (alert if >5 seconds)
- ✅ Error rates (alert if >1% of requests)
- ✅ Memory leaks (alert if memory grows >10% per hour)

### **Required Alerts**
- ✅ Production errors (immediate)
- ✅ Sync failures (within 5 minutes)
- ✅ Database errors (within 5 minutes)
- ✅ Performance degradation (within 15 minutes)

---

## 🎯 **ONE-PROMPT COMMAND**

Use this when requesting changes:

```
Cece, apply the ATLAS DEVELOPMENT STANDARD to [feature/file].

Before making changes:
1. Classify change (Tier 1/2/3)
2. Perform required scan (if Tier 2/3)
3. Confirm it won't break mobile/web parity
4. Confirm it won't break protected systems
5. Provide best practice research
6. Provide testing plan
7. Ask for approval before touching anything working
```

---

## 📋 **QUICK REFERENCE**

| Change Type | Scan Required | Testing Required | Approval Required |
|------------|---------------|------------------|-------------------|
| **Tier 1 (Simple)** | ❌ No | Visual | ❌ No |
| **Tier 2 (Feature)** | ✅ 1-layer | Manual (web + mobile) | ✅ Yes |
| **Tier 3 (Critical)** | ✅ 3-layer | Manual + Performance | ✅ Yes |

---

## 🎯 **FINAL RULE**

**If you're unsure → Ask**  
**If it's working → Don't break it**  
**If it's broken → Fix it (with diagnosis)**  
**If it's production → Fix it immediately**

---

**This standard is now our operating system. Every change, fix, and recommendation will follow this standard.**

