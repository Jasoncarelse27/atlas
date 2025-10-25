# Mobile Conversation History Debug Guide

## 🔍 **Quick Diagnostic**

### **Step 1: Check Console Logs on Mobile**

1. Open mobile Safari/Chrome
2. Connect to desktop for remote debugging:
   - **iOS Safari**: Settings → Safari → Advanced → Web Inspector (then connect to Mac)
   - **Android Chrome**: chrome://inspect on desktop
3. Open Atlas on mobile
4. Open hamburger menu → Tap "View History"
5. **Look for these logs:**

```javascript
[QuickActions] Loading conversations for user: <user-id>
[QuickActions] 📡 Force refresh - syncing from Supabase...
[QuickActions] ✅ Force sync completed
[QuickActions] 📊 Found X conversations in IndexedDB
[QuickActions] ✅ Conversation list refreshed and cached
```

**Expected:** Should show `Found 4 conversations`
**If showing:** `Found 1 conversation` → IndexedDB sync issue

---

## 🔧 **Quick Fixes (Try in Order)**

### **Fix #1: Hard Refresh on Mobile** ⚡ (30 seconds)

**iOS Safari:**
1. Hold down the refresh button (⟳) for 2 seconds
2. Select "Request Desktop Website"
3. Then refresh again
4. Switch back to "Request Mobile Website"

**OR**

1. Close tab completely
2. Clear Safari cache: Settings → Safari → Clear History and Website Data
3. Open Atlas fresh
4. Log in
5. Try conversation history again

**Android Chrome:**
1. Menu (⋮) → Settings → Site Settings → Storage
2. Find your Atlas URL → Clear & Reset
3. OR: Long-press reload button → "Hard Reload"

---

### **Fix #2: Clear IndexedDB Manually** 🔧 (1 minute)

If hard refresh doesn't work, clear IndexedDB:

**On Mobile (using DevTools):**
1. Open DevTools console on mobile
2. Paste and run:
```javascript
// Clear IndexedDB
indexedDB.deleteDatabase('AtlasDB');
// Clear localStorage
localStorage.clear();
// Reload
location.reload();
```

**OR on Desktop (if mobile DevTools is hard):**
1. Open your Atlas URL on desktop
2. Open DevTools (F12)
3. Go to **Application** tab
4. Left sidebar: **IndexedDB** → Right-click **AtlasDB** → Delete
5. Left sidebar: **Local Storage** → Right-click your domain → Clear
6. Now test on mobile (it will sync fresh)

---

### **Fix #3: Force Sync via Console** 🚀 (If showing 1 conversation)

If mobile still shows 1 conversation, manually trigger sync:

**Open mobile DevTools console and run:**
```javascript
// Get user ID
const { data: { user } } = await supabase.auth.getUser();
console.log('User ID:', user.id);

// Force sync
const { conversationSyncService } = await import('./services/conversationSyncService');
await conversationSyncService.deltaSync(user.id);
console.log('✅ Sync complete');

// Check IndexedDB
const conversations = await atlasDB.conversations
  .where('userId')
  .equals(user.id)
  .toArray();
console.log(`📊 Found ${conversations.length} conversations in IndexedDB:`, conversations);
```

**Expected output:**
```
User ID: abc-123-xyz
✅ Sync complete
📊 Found 4 conversations in IndexedDB: [...]
```

---

## 🐛 **Debugging: What's Actually in IndexedDB?**

Run this in mobile console to see what's stored:

```javascript
// Check what's in IndexedDB
const allConversations = await atlasDB.conversations.toArray();
console.log('All conversations:', allConversations.length);
console.table(allConversations.map(c => ({
  id: c.id.slice(0, 8),
  title: c.title,
  userId: c.userId.slice(0, 8),
  updated: new Date(c.updatedAt).toLocaleString()
})));

// Check if sync is working
console.log('Last sync time:', localStorage.getItem('atlas:lastSyncTime'));
```

---

## 📊 **Common Issues**

| Issue | Symptom | Fix |
|-------|---------|-----|
| **Stale Service Worker** | Old code still running | Hard refresh + clear cache |
| **IndexedDB quota** | Sync fails silently | Clear IndexedDB |
| **Multiple user accounts** | Wrong userId filter | Check `user.id` in console |
| **Supabase RLS** | Can't fetch conversations | Check auth token is valid |

---

## ✅ **Verification Steps**

After clearing cache:

1. **Open mobile browser fresh**
2. **Navigate to Atlas**
3. **Log in**
4. **Open conversation history**
5. **Should see all 4 conversations** ✅

**If still showing 1:**
- Check console logs (see diagnostic above)
- Verify user ID matches between mobile and web
- Check Supabase directly: Does your account have 4 conversations?

---

## 🎯 **Most Likely Solution**

**95% chance:** Just need a hard refresh on mobile to load the new code.

**Steps:**
1. Close Atlas tab on mobile
2. Clear Safari/Chrome cache
3. Reopen Atlas
4. Should work ✅

**If that doesn't work**, run the diagnostic console commands above and share the output!

---

## 💡 **Why This Happens**

- Mobile browsers **aggressively cache** JavaScript
- Service Workers can cache old code
- IndexedDB persists between refreshes
- Need to force clear cache to get new sync logic

**Once cleared, the new code will:**
1. Force sync from Supabase every time you open history
2. Show all 4 conversations
3. Keep mobile and web in sync

---

**Try the hard refresh first - should work!** 🚀

