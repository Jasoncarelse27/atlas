# 🔍 Conversation Sync Diagnostic - Run This NOW

## ✅ Quick Browser Console Check

**Open browser console and run this:**

```javascript
// Get your user ID
const { data: { user } } = await supabase.auth.getUser();
const userId = user?.id;
console.log('User ID:', userId);

// Check conversations in Supabase directly
const { data: conversations, error } = await supabase
  .from('conversations')
  .select('id, title, updated_at, deleted_at')
  .eq('user_id', userId)
  .order('updated_at', { ascending: false })
  .limit(10);

console.log('📊 Conversations in Supabase:', {
  total: conversations?.length || 0,
  active: conversations?.filter(c => !c.deleted_at).length || 0,
  deleted: conversations?.filter(c => c.deleted_at).length || 0,
  conversations: conversations
});

// Check IndexedDB
const atlasDB = await import('./src/database/atlasDB').then(m => m.atlasDB);
const localCount = await atlasDB.conversations
  .where('userId')
  .equals(userId)
  .count();
console.log('📦 Conversations in IndexedDB:', localCount);

// Check syncMetadata
const syncMeta = await atlasDB.syncMetadata.get(userId);
console.log('🔄 Sync Metadata:', syncMeta);
```

**This will tell us:**
1. ✅ Do conversations exist in Supabase?
2. ✅ Are they marked as deleted?
3. ✅ How many are in IndexedDB?
4. ✅ What's the syncMetadata timestamp?

---

## 🎯 Expected Results

### **Scenario 1: Conversations exist in Supabase**
- **Fix**: The sync query might be wrong - we'll fix it
- **Action**: Share the console output

### **Scenario 2: No conversations in Supabase**
- **Fix**: Conversations were never created or were deleted
- **Action**: Start a new conversation - it should create one

### **Scenario 3: Conversations exist but syncMetadata has old timestamp**
- **Fix**: Clear syncMetadata - already implemented in Delta Sync button
- **Action**: Click Delta Sync button (should clear it automatically)

---

## 🚀 One-Shot Fix (If Conversations Exist)

If conversations exist in Supabase but aren't syncing, run this in console:

```javascript
// Force full sync by clearing syncMetadata
const atlasDB = await import('./src/database/atlasDB').then(m => m.atlasDB);
const { data: { user } } = await supabase.auth.getUser();
await atlasDB.syncMetadata.delete(user.id);
console.log('✅ Cleared syncMetadata - next sync will fetch all conversations');

// Trigger sync
const { conversationSyncService } = await import('./src/services/conversationSyncService');
await conversationSyncService.deltaSync(user.id);
console.log('✅ Sync triggered');
```

---

**Run the diagnostic command above and share the output.**

