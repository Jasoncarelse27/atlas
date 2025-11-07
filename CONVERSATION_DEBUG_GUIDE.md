# 🔍 Conversation Sync Debugging Guide

## ✅ **Best Practice Approach**

### **1. Check Conversations via Backend API**

After Railway deploys (~2 min), run this in browser console:

```javascript
// Get auth token
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

if (!token) {
  console.error('❌ Not authenticated');
} else {
  // Call diagnostic endpoint
  const response = await fetch('/api/debug/conversations', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  console.log('📊 Conversations in Supabase:', data);
}
```

**Expected Response:**
```json
{
  "userId": "abc123...",
  "total": 5,
  "active": 3,
  "deleted": 2,
  "conversations": [
    { "id": "...", "title": "...", "updated_at": "...", "created_at": "..." }
  ]
}
```

### **2. Check Railway Logs for Structured Logs**

The `logger.info()` statements go to Railway logs, not browser console:

1. Go to Railway dashboard
2. Click on your backend service
3. View "Logs" tab
4. Look for: `[ConversationSync] Sync state` and `[ConversationSync] Sync results`

### **3. Check IndexedDB Directly**

```javascript
// Check local IndexedDB
const atlasDB = await import('./src/database/atlasDB').then(m => m.atlasDB);
const { data: { user } } = await supabase.auth.getUser();
const conversations = await atlasDB.conversations
  .where('userId')
  .equals(user.id)
  .toArray();
console.log('📦 Conversations in IndexedDB:', conversations.length, conversations);
```

### **4. Check Sync Metadata**

```javascript
const syncMeta = await atlasDB.syncMetadata.get(user.id);
console.log('🔄 Sync Metadata:', syncMeta);
```

---

## 🎯 **Diagnosis Flow**

1. **If `/api/debug/conversations` shows conversations exist:**
   - ✅ Conversations exist in Supabase
   - ❌ Sync isn't working → Check Railway logs for sync errors

2. **If `/api/debug/conversations` shows 0 conversations:**
   - ❌ No conversations exist for this user
   - ✅ Sync is working correctly (nothing to sync)
   - 💡 Create a new conversation to test

3. **If IndexedDB is empty but Supabase has conversations:**
   - ❌ Sync query might be wrong
   - Check Railway logs for `[ConversationSync] Sync results` to see `found: 0`

---

## 🚀 **Next Steps**

1. Wait for Railway to deploy (~2 min)
2. Run the diagnostic API call above
3. Share the results
4. We'll fix based on the data

