# 🚨 CRITICAL BUG FIXES - Oct 30, 2025

## Issues Fixed

### 1. ✅ Messages Disappearing on Page Refresh
**Cause**: `databaseMigration.ts` was **clearing all messages** on every page refresh!

**The Bug**:
```typescript
// ❌ OLD CODE (BROKEN):
await atlasDB.messages.clear();        // Deleting all messages!
await atlasDB.conversations.clear();   // Deleting all conversations!
```

**The Fix**:
```typescript
// ✅ NEW CODE (FIXED):
await atlasDB.open();  // Just open DB, don't clear data!
// Removed the clear() calls completely
```

**Location**: `src/services/databaseMigration.ts` lines 29-36

---

### 2. ✅ "View Insights" Button Goes to Wrong Page
**Cause**: `RitualRewardModal` was navigating to `/chat` instead of `/ritual-insights`

**The Bug**:
```typescript
// ❌ OLD CODE (BROKEN):
navigate('/chat'); // Wrong page!
```

**The Fix**:
```typescript
// ✅ NEW CODE (FIXED):
navigate('/ritual-insights'); // Correct page!
```

**Location**: `src/features/rituals/components/RitualRunView.tsx` lines 510-513 and 709-712

---

## Testing Instructions

### Test 1: Messages Persist on Refresh
1. Send a message in chat
2. **Refresh the page** (Cmd+R)
3. ✅ Message should still be there
4. ✅ All previous messages should still be visible

### Test 2: View Insights Navigation
1. Complete a ritual
2. Click "View Insights" in the reward modal
3. ✅ Should go to `/ritual-insights` page
4. ✅ NOT `/chat` page

---

## Why This Happened

The `databaseMigration.migrateDatabase()` function was originally meant for a **one-time migration** from an old schema to a new schema. However:

1. It was running on **every page refresh** (via sessionStorage check)
2. It was **clearing all data** as part of the "migration"
3. This caused messages to disappear after every refresh

The fix removes the data clearing entirely - the database now just opens without wiping data.

---

## Impact

- **Users affected**: Everyone using Atlas
- **Data loss**: None (messages are in Supabase, just not showing in UI)
- **Fix deployed**: Immediately
- **Requires**: Page refresh to apply fix

---

## Apology Note

Jason, I apologize for this regression. The database migration code was accidentally deleting your data on every page load. This should have been caught in testing. Both issues are now fixed:

1. ✅ Messages will persist on refresh
2. ✅ View Insights goes to the correct page

Please refresh your page and test again. Your messages should now stay after refresh.

