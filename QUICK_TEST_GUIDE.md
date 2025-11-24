# 🧪 Quick Testing Guide - Atlas Tier-Based Deletion

## 🚀 Quick Start (5 Minutes)

### 1. Check Your Current Tier

Open browser console on Atlas (http://localhost:5176) and run:

```javascript
// Check your current tier
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from('profiles')
  .select('subscription_tier')
  .eq('id', user.id)
  .single();
console.log('Current tier:', profile.subscription_tier);
```

---

## 🧪 Test Free Tier (Local-Only Deletion)

### Step 1: Set to Free Tier

```javascript
// In browser console
const { data: { user } } = await supabase.auth.getUser();
await supabase
  .from('profiles')
  .update({ subscription_tier: 'free' })
  .eq('id', user.id);
console.log('✅ Set to Free tier - refresh the page');
```

### Step 2: Test Deletion

1. Refresh the page (to load new tier)
2. Click "View History" in sidebar
3. Delete a conversation
4. Watch the console for: `[ConversationDelete] 📴 Free tier - Local-only hard delete`
5. You should see upgrade prompt: "Upgrade to Core ($19.99/mo)..."

### Step 3: Verify

```javascript
// Check if conversation still exists in Supabase
const { data: { user } } = await supabase.auth.getUser();
const { data: conversations } = await supabase
  .from('conversations')
  .select('id, title')
  .eq('user_id', user.id);
console.log('Conversations in Supabase:', conversations);
// ✅ Should still see the deleted conversation
```

---

## 🧪 Test Core Tier (Hard Delete with Sync)

### Step 1: Set to Core Tier

```javascript
// In browser console
const { data: { user } } = await supabase.auth.getUser();
await supabase
  .from('profiles')
  .update({ subscription_tier: 'core' })
  .eq('id', user.id);
console.log('✅ Set to Core tier - refresh the page');
```

### Step 2: Test Deletion

1. Refresh the page
2. Click "View History"
3. Delete a conversation
4. Watch the console for: `[ConversationDelete] ⚙️ Core tier - Hard delete (server + local)`
5. You should see upgrade prompt: "Upgrade to Studio ($149.99/mo)..."

### Step 3: Verify

```javascript
// Check if conversation was deleted from Supabase
const { data: { user } } = await supabase.auth.getUser();
const { data: conversations } = await supabase
  .from('conversations')
  .select('id, title')
  .eq('user_id', user.id);
console.log('Conversations in Supabase:', conversations);
// ✅ Should NOT see the deleted conversation
```

---

## 🧪 Test Studio Tier (Soft Delete with Restore)

### Step 1: Set to Studio Tier

```javascript
// In browser console
const { data: { user } } = await supabase.auth.getUser();
await supabase
  .from('profiles')
  .update({ subscription_tier: 'studio' })
  .eq('id', user.id);
console.log('✅ Set to Studio tier - refresh the page');
```

### Step 2: Test Deletion

1. Refresh the page
2. Click "View History"
3. Delete a conversation
4. Watch the console for: `[ConversationDelete] 🩵 Studio tier - Soft delete (recoverable)`
5. No upgrade prompt (you're already at highest tier)

### Step 3: Verify

```javascript
// Check if conversation was soft-deleted (deleted_at set)
const { data: { user } } = await supabase.auth.getUser();
const { data: conversations } = await supabase
  .from('conversations')
  .select('id, title, deleted_at')
  .eq('user_id', user.id);
console.log('Conversations in Supabase:', conversations);
// ✅ Should see the conversation with deleted_at timestamp
```

---

## 🧪 Test Auto-Title Generation

### Test New Conversation Title

1. Click "Start New Chat"
2. Send your first message (e.g., "Hello, can you help me learn Python?")
3. Watch the console for: `✅ [MessageService] Updated conversation title: "Learning Python"`
4. Check the conversation title in "View History"
5. Should show AI-generated title (Core/Studio) or first 40 chars (Free)

---

## 🧪 Test Cross-Device Sync

### Test Mobile + Web Consistency

1. Open Atlas on **desktop**: http://localhost:5176
2. Open Atlas on **mobile**: http://192.168.0.10:5176
3. Set tier to **Core** or **Studio** (needs cloud sync)
4. Delete a conversation on **desktop**
5. Refresh **mobile** browser
6. Click "View History" on **mobile**
7. ✅ Deleted conversation should be gone on both devices

---

## 🎯 Expected Results Summary

| Test | Free Tier | Core Tier | Studio Tier |
|------|-----------|-----------|-------------|
| **Deletion Type** | Local-only hard | Server + local hard | Soft delete |
| **Console Log** | `📴 Free tier - Local-only` | `⚙️ Core tier - Hard delete` | `🩵 Studio tier - Soft delete` |
| **Upgrade Prompt** | Core ($19.99/mo) | Studio ($149.99/mo) | None |
| **In Supabase** | Still exists | Permanently deleted | `deleted_at` set |
| **In Local Dexie** | Deleted | Deleted | `deletedAt` set |
| **Cross-Device Sync** | ❌ No | ✅ Yes | ✅ Yes |
| **Restorable** | ❌ No | ❌ No | ✅ Yes |

---

## 🚨 Troubleshooting

### Issue: Upgrade prompts not showing

**Fix**: Make sure you're clicking "OK" on the confirmation dialog first, then the upgrade prompt appears after 500ms.

### Issue: Tier not changing

**Fix**: You must refresh the page after changing tier in Supabase. The tier is cached for 5 seconds.

### Issue: Conversations still showing after deletion

**Fix**: 
- Free tier: Deletion is local-only, other devices will still see it
- Core/Studio: Make sure backend is running (`curl http://localhost:8000/healthz`)

### Issue: Auto-title not working

**Fix**: Make sure you're sending a message (not just creating a conversation). Title generates after first message.

---

## ✅ Quick Verification Commands

### Check Backend Status

```bash
curl http://localhost:8000/healthz
# Should return: {"status":"ok",...}
```

### Check Frontend Status

```bash
curl -I http://localhost:5176
# Should return: HTTP/1.1 200 OK
```

### Check All Tiers Work

```javascript
// Test all three tiers quickly
const tiers = ['free', 'core', 'studio'];
for (const tier of tiers) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('profiles').update({ subscription_tier: tier }).eq('id', user.id);
  console.log(`✅ Tested ${tier} tier - refresh and delete a conversation`);
}
```

---

## 🎉 Success Criteria

✅ Free tier: Local-only deletion, upgrade prompt shows
✅ Core tier: Server + local deletion, syncs across devices, upgrade prompt shows
✅ Studio tier: Soft delete, `deleted_at` timestamp set, no upgrade prompt
✅ Auto-title: New conversations get AI-generated titles after first message
✅ Cross-device: Mobile and web show same conversation list

---

*All tests passing = Atlas is production-ready! 🚀*

