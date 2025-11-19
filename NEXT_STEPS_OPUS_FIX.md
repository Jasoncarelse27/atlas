# ✅ Opus Model Fix - Next Steps

**Status:** Code fixed and pushed to GitHub  
**What We Fixed:** Changed Opus model from `claude-3-opus-20240229` → `claude-opus-4-1-20250805`

---

## 🎯 **What To Do Next (3 Simple Steps)**

### **Step 1: Wait for Railway to Deploy** ⏱️ (2-3 minutes)
Railway auto-deploys when you push to GitHub. It should be deploying now.

**How to check:**
1. Go to https://railway.app
2. Click on your backend service
3. Check the "Deployments" tab - should show "Building" or "Deployed"

---

### **Step 2: Verify the Fix is Live** ✅

**Option A: Check Railway Logs (Easiest)**
1. Railway Dashboard → Your Backend → "Logs" tab
2. Look for this line at startup:
   ```
   [Server] Model configuration: {
     studio: 'claude-opus-4-1-20250805'  ← Should show NEW model
   }
   ```

**Option B: Test by Sending a Message**
1. Go to https://atlas-xi-tawny.vercel.app
2. Send a test message
3. Check Railway logs for:
   - ✅ `🚀 Sending request to Anthropic API with model: claude-opus-4-1-20250805`
   - ✅ `✅ Token usage captured from message_stop: X input, Y output`
   - ❌ NO `404` errors

---

### **Step 3: Verify Billing is Recording** 💰

**Check Supabase Database:**
1. Go to Supabase Dashboard → SQL Editor
2. Run this query:
   ```sql
   SELECT 
     event,
     tokens_used,
     estimated_cost,
     metadata->>'model' as model,
     created_at
   FROM usage_logs
   WHERE event = 'chat_message'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

**What to look for:**
- ✅ `tokens_used > 0` (not 0)
- ✅ `model = 'claude-opus-4-1-20250805'` (for Studio tier)
- ✅ `estimated_cost > 0`

---

## 🚨 **If Something's Wrong**

### **If Railway hasn't deployed:**
- Check Railway dashboard for errors
- Railway might need manual redeploy (click "Redeploy" button)

### **If you still see 404 errors:**
- Railway might be using cached code
- Try: Railway Dashboard → Settings → Clear Build Cache → Redeploy

### **If tokens are still 0:**
- Check Railway logs for `⚠️ No token usage captured`
- This means Anthropic isn't returning usage data (different issue)

---

## ✅ **Success Criteria**

You'll know it's working when:
1. ✅ Railway logs show `claude-opus-4-1-20250805` (not the old model)
2. ✅ No 404 errors when sending messages
3. ✅ `usage_logs` table shows `tokens_used > 0`
4. ✅ Billing dashboard shows usage

---

## 📞 **Quick Test**

**Right now, try this:**
1. Open Railway logs
2. Send a test message from the app
3. Share what you see in the logs

That's it! The fix is in the code, we just need to verify Railway deployed it.

