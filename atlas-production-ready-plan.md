# Real-Time Deletion Sync - Enterprise Implementation (Updated)

## Phase 1: Safety Cleanup (Remove Conflicts)

### 1.1 Fix TypeScript Build Errors (REQUIRED)

**Files to modify:**
- `src/services/cachedDatabaseService.ts` (fix import and type assertions)

**Changes:**
1. Fix Supabase import: `../lib/supabase` → `../lib/supabaseClient`
2. Add safe type assertions for database operations (lines 158, 193, 227)
3. Fix `profile.tier` property access with proper typing (line 63)

### 1.2 Remove Soft Delete Database Queries

**Files to modify:**
- `src/services/conversationSyncService.ts` (lines 70, 274)
- `src/services/cachedDatabaseService.ts` (line 92)

**Change:** Remove `.is('deleted_at', null)` filters since we use hard delete
- Keep the columns in Supabase (backward compatible)
- Stop querying them (forward compatible with hard delete)

### 1.3 Clear Test Data for Fresh Start

**Action:** Run browser console command to clear IndexedDB
```javascript
// In browser console
await indexedDB.deleteDatabase('AtlasDB_v4');
await indexedDB.deleteDatabase('AtlasDB_v5');
await indexedDB.deleteDatabase('AtlasDB_v6');
location.reload();
```

## Phase 2: Real-Time Deletion Sync (Enterprise-Grade)

### 2.1 Add Global Conversation Deletion Listener

**File:** `src/pages/ChatPage.tsx`
**Location:** After existing real-time message listener (around line 366)

**Implementation:**
```typescript
// Real-time conversation deletion listener (global)
useEffect(() => {
  if (!userId) return;

  const conversationChannel = supabase
    .channel(`user_conversations_${userId}`)
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'conversations',
      filter: `user_id=eq.${userId}`,
    }, async (payload) => {
      logger.debug('[ChatPage] Real-time deletion received:', payload.old.id);
      
      // Remove from local Dexie
      await atlasDB.conversations.delete(payload.old.id);
      await atlasDB.messages.where('conversationId').equals(payload.old.id).delete();
      
      // If user is viewing the deleted conversation, redirect to new chat
      if (conversationId === payload.old.id) {
        window.location.href = '/chat';
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(conversationChannel);
  };
}, [userId, conversationId]);
```

### 2.2 Verify Auto Title Generation

**File:** `src/services/titleGenerationService.ts`
**Status:** Already working correctly
- Free tier: First 40 chars (instant)
- Core tier: Smart extraction
- Studio tier: AI-generated titles
- Fallbacks at every level

**Action:** Replace `console.log/error` with `logger.debug/error` (lines 50, 194, 209, 213, 217)

## Phase 3: Production Polish

### 3.1 Add Professional Error Handling

**File:** `src/components/sidebar/QuickActions.tsx`
**Current:** Simple `alert()` for errors
**Upgrade:** Use toast notifications or inline error messages

### 3.2 Add Loading States to UI

**File:** `src/components/ConversationHistoryDrawer.tsx`
**Current:** Opacity change only
**Verify:** Loading spinner is visible and smooth

## Testing Checklist

- [ ] TypeScript build passes without errors
- [ ] Delete conversation on web → appears deleted on mobile instantly (< 1 second)
- [ ] Delete conversation on mobile → appears deleted on web instantly
- [ ] Auto title generation works for new conversations
- [ ] Deleting current conversation redirects to new chat
- [ ] No console errors in production build
- [ ] Loading states are smooth and professional
- [ ] Conversation history starts empty after reset

## Safety Verification

Before implementing:
- ✅ No breaking changes to Supabase schema
- ✅ No data loss for existing users (you're resetting anyway)
- ✅ Backward compatible with existing code
- ✅ Single source of truth for deletions maintained
- ✅ All changes are additive, not destructive
- ✅ TypeScript errors fixed before real-time sync implementation

### To-dos

- [ ] Fix cachedDatabaseService.ts TypeScript errors (import + type assertions)
- [ ] Remove .is('deleted_at', null) filters from sync services
- [ ] Clear IndexedDB databases for fresh start
- [ ] Add real-time DELETE listener to ChatPage for cross-device sync
- [ ] Replace console statements with logger in titleGenerationService
- [ ] Test deletion syncs instantly between web and mobile
- [ ] Verify auto title generation works for new conversations
