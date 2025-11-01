# 🔧 Railway Variables Fix Guide

## Issue: ANTHROPIC_API_KEY Warning

**Problem:** `ANTHROPIC_API_KEY` exists in Railway **Shared Variables** but the `atlas` service can't see it.

**Why:** Railway Shared Variables need to be **attached** to individual services.

---

## ✅ Solution: Attach Shared Variables to Service

### Step 1: Go to Your Service Variables

1. Railway Dashboard → `exquisite-insight` project
2. Click on **`atlas`** service (not "Shared Variables")
3. Click **Variables** tab (service-specific variables)

### Step 2: Reference Shared Variable

Instead of adding the value directly, **reference** the shared variable:

1. Click **"Add Variable"**
2. Variable name: `ANTHROPIC_API_KEY`
3. Value: `${{Shared.ANTHROPIC_API_KEY}}` (or use the reference button)
4. Click **"Add"**

**OR** use Railway's UI:
- Click the variable name in Shared Variables
- Click **"SHARE"** button
- Select the `atlas` service
- Railway will auto-reference it

### Step 3: Verify

After adding, Railway will auto-redeploy. Check logs:
- ✅ Should see: `[Server] API Keys loaded: ANTHROPIC_API_KEY: ✅ Set (...`
- ❌ No more: `⚠️ WARNING: No Claude API key found`

---

## 🔍 How to Check Current Variables

**In Railway Dashboard:**
1. Go to `atlas` service → **Variables** tab
2. Look for `ANTHROPIC_API_KEY`
3. If missing → Add it as reference above
4. If present → Check if it's referencing Shared Variable correctly

---

## 📋 All Variables That Should Be Attached

Make sure these Shared Variables are attached to `atlas` service:

- ✅ `ANTHROPIC_API_KEY` (currently missing)
- ✅ `REDIS_URL` (should already be attached)
- ✅ `SUPABASE_URL` (should already be attached)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (should already be attached)
- ✅ `SUPABASE_KEY` (should already be attached)
- ✅ `MAILERLITE_SECRET` (optional)

---

## 🚀 After Fixing

Railway will automatically redeploy when you add variables. Watch for:
- ✅ No more API key warnings
- ✅ Server starts successfully
- ✅ AI features work (chat will function)

---

**Status:** Server is running fine, but AI features won't work until `ANTHROPIC_API_KEY` is attached to the service.

