# 🧪 Tier-Based Deletion Testing Guide

## Quick Testing Steps

### Prerequisites
- Frontend running on http://localhost:5176
- Backend running on http://localhost:8000
- User authenticated in the app

### Test 1: Free Tier Deletion (Local-Only)

1. **Set your tier to Free** (if needed):
   ```sql
   -- In Supabase SQL Editor
   UPDATE profiles 
   SET subscription_tier = 'free' 
   WHERE id = 'YOUR_USER_ID';
   ```

2. **Delete a conversation**:
   - Open Atlas app
   - Click "View History" in sidebar
   - Delete any conversation
   - Check console logs

3. **Expected Results**:
   - ✅ Console shows: `[ConversationDelete] 📴 Free tier - Local-only hard delete`
   - ✅ Upgrade prompt appears: "Upgrade to Core ($19.99/mo) to sync deletions..."
   - ✅ Conversation removed from local Dexie
   - ✅ Conversation still exists in Supabase (check database)

4. **Verify in Supabase**:
   ```sql
   SELECT id, title, deleted_at 
   FROM conversations 
   WHERE id = 'CONVERSATION_ID';
   -- Should return the conversation with deleted_at = NULL
   ```

### Test 2: Core Tier Deletion (Hard Delete)

1. **Set your tier to Core**:
   ```sql
   UPDATE profiles 
   SET subscription_tier = 'core' 
   WHERE id = 'YOUR_USER_ID';
   ```

2. **Delete a conversation**:
   - Refresh the app (to reload tier)
   - Click "View History"
   - Delete any conversation
   - Check console logs

3. **Expected Results**:
   - ✅ Console shows: `[ConversationDelete] ⚙️ Core tier - Hard delete (server + local)`
   - ✅ Upgrade prompt appears: "Upgrade to Studio ($149.99/mo) to restore..."
   - ✅ Conversation removed from local Dexie
   - ✅ Conversation permanently deleted from Supabase

4. **Verify in Supabase**:
   ```sql
   SELECT id, title, deleted_at 
   FROM conversations 
   WHERE id = 'CONVERSATION_ID';
   -- Should return NO rows (permanently deleted)
   ```

### Test 3: Studio Tier Deletion (Soft Delete)

1. **Set your tier to Studio**:
   ```sql
   UPDATE profiles 
   SET subscription_tier = 'studio' 
   WHERE id = 'YOUR_USER_ID';
   ```

2. **Delete a conversation**:
   - Refresh the app (to reload tier)
   - Click "View History"
   - Delete any conversation
   - Check console logs

3. **Expected Results**:
   - ✅ Console shows: `[ConversationDelete] 🩵 Studio tier - Soft delete (recoverable)`
   - ✅ NO upgrade prompt (already on highest tier)
   - ✅ Conversation marked as deleted in local Dexie (deletedAt timestamp)
   - ✅ Conversation marked as deleted in Supabase (deleted_at timestamp)

4. **Verify in Supabase**:
   ```sql
   SELECT id, title, deleted_at 
   FROM conversations 
   WHERE id = 'CONVERSATION_ID';
   -- Should return the conversation with deleted_at = timestamp
   ```

5. **Test Restore (Console)**:
   ```javascript
   // In browser console
   import { restoreConversation } from './src/services/conversationDeleteService';
   
   // Get your user ID
   const { data: { user } } = await supabase.auth.getUser();
   
   // Restore the conversation
   const result = await restoreConversation('CONVERSATION_ID', user.id);
   console.log(result);
   ```

## 🔍 Console Logging Reference

### Free Tier Logs
```
[ConversationDelete] Deleting conversation XXX for free tier user
[ConversationDelete] 📴 Free tier - Local-only hard delete
[ConversationDelete] ✅ Deleted from local Dexie only
[QuickActions] ✅ Conversation deleted locally. Upgrade to Core to sync deletions across devices.
```

### Core Tier Logs
```
[ConversationDelete] Deleting conversation XXX for core tier user
[ConversationDelete] ⚙️ Core tier - Hard delete (server + local)
[ConversationDelete] ✅ Hard deleted from Supabase
[ConversationDelete] ✅ Hard deleted from local Dexie
[QuickActions] ✅ Conversation permanently deleted. Upgrade to Studio to restore deleted conversations.
```

### Studio Tier Logs
```
[ConversationDelete] Deleting conversation XXX for studio tier user
[ConversationDelete] 🩵 Studio tier - Soft delete (recoverable)
[ConversationDelete] ✅ Soft deleted from Supabase
[ConversationDelete] ✅ Soft deleted from local Dexie
[QuickActions] ✅ Conversation deleted. You can restore it anytime from your deleted items.
```

## 🎯 Multi-Device Testing

### Free Tier (Device-Specific)
1. Delete conversation on Device A
2. Check Device B - conversation should still be visible
3. ✅ Confirms local-only deletion

### Core Tier (Syncs Everywhere)
1. Delete conversation on Device A
2. Wait 2 minutes for delta sync
3. Check Device B - conversation should be gone
4. ✅ Confirms hard delete syncs

### Studio Tier (Syncs Everywhere)
1. Delete conversation on Device A
2. Wait 2 minutes for delta sync
3. Check Device B - conversation should be hidden
4. Restore on Device A
5. Wait 2 minutes for delta sync
6. Check Device B - conversation should reappear
7. ✅ Confirms soft delete syncs

## 🐛 Troubleshooting

### Issue: Upgrade prompt doesn't appear
**Solution**: Check that `useUpgradeFlow` hook is imported correctly

### Issue: Tier not detected correctly
**Solution**: 
1. Check Supabase profile: `SELECT subscription_tier FROM profiles WHERE id = 'USER_ID'`
2. Clear browser cache and refresh
3. Check console for tier detection logs

### Issue: Deletion fails
**Solution**:
1. Check console for error messages
2. Verify user is authenticated
3. Check Supabase RLS policies
4. Verify backend is running

### Issue: Conversation reappears after deletion
**Solution**:
- **Free tier**: Expected on other devices (local-only)
- **Core tier**: Check if hard delete succeeded in Supabase
- **Studio tier**: Check if `deleted_at` timestamp is set

## ✅ Success Criteria

### All Tests Pass When:
- [ ] Free tier deletes locally only
- [ ] Free tier shows upgrade prompt
- [ ] Core tier deletes from Supabase + local
- [ ] Core tier shows Studio upgrade prompt
- [ ] Studio tier soft deletes with timestamp
- [ ] Studio tier does NOT show upgrade prompt
- [ ] Multi-device sync works per tier
- [ ] Console logs match expected patterns

## 📊 Quick SQL Queries for Testing

### Check conversation status
```sql
SELECT 
  id, 
  title, 
  deleted_at,
  created_at,
  updated_at
FROM conversations 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY updated_at DESC
LIMIT 10;
```

### Check user tier
```sql
SELECT 
  id,
  email,
  subscription_tier,
  subscription_status
FROM profiles
WHERE id = 'YOUR_USER_ID';
```

### Find soft-deleted conversations
```sql
SELECT 
  id, 
  title, 
  deleted_at
FROM conversations 
WHERE user_id = 'YOUR_USER_ID'
  AND deleted_at IS NOT NULL
ORDER BY deleted_at DESC;
```

### Manually restore a conversation (Studio tier)
```sql
UPDATE conversations 
SET deleted_at = NULL 
WHERE id = 'CONVERSATION_ID';

UPDATE messages 
SET deleted_at = NULL 
WHERE conversation_id = 'CONVERSATION_ID';
```

---

**Ready to test?** Start with Test 1 (Free Tier) and work your way up! 🚀

