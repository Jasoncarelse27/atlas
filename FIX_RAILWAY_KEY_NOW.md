# 🚨 CRITICAL: Fix Railway SUPABASE_ANON_KEY NOW

**Status:** 🔴 **BLOCKING - 401 ERRORS PERSIST**

---

## 🎯 **The Problem**

Railway's `SUPABASE_ANON_KEY` doesn't match Supabase's actual anon key. This causes:
- ✅ Frontend can refresh tokens (Vercel key is correct)
- ❌ Backend rejects valid tokens (Railway key is wrong)
- Result: **401 Unauthorized on every request**

---

## ✅ **ONE-SHOT FIX**

### **Step 1: Get Correct Key from Supabase**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings → API** (or **API Keys** tab)
4. Find **"anon public"** key
5. Click **"Copy"** button (don't manually copy - use the button!)
6. **Verify it's 208 characters** and ends with `...00QhyXuU`

### **Step 2: Update Railway**
1. Go to [Railway Dashboard](https://railway.app)
2. Select your project → **atlas** service
3. Click **"Variables"** tab
4. Find `SUPABASE_ANON_KEY`
5. Click **"Edit"** (or three dots → Edit)
6. **SELECT ALL** and **DELETE** the entire old value
7. **PASTE** the full key from Supabase (208 chars)
8. **VERIFY** it ends with `...00QhyXuU`
9. Click **"Save"**

### **Step 3: Wait for Redeploy**
- Railway will auto-redeploy (~1-2 minutes)
- Check Railway → **Deployments** tab
- Wait for green checkmark ✅

### **Step 4: Verify Fix**
Run this command:
```bash
./scripts/verify-railway-key.sh
```

Or test manually:
```bash
curl https://atlas-production-2123.up.railway.app/api/auth/status
```

Should show:
- `anonKeyLength: 208`
- `anonKeyPreview` matches your local key preview

### **Step 5: Test in Browser**
1. **Hard refresh** (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. Send a test message
3. Should work! ✅

---

## 🔍 **Why This Happens**

Supabase JWT tokens are signed with Supabase's JWT secret. To verify them:
- Backend MUST use the **SAME** anon key that Supabase uses
- If keys don't match → `supabasePublic.auth.getUser()` fails → 401

**Best Practice:** Always copy keys directly from Supabase Dashboard, never type manually.

---

## ✅ **Verification Checklist**

After fix, verify:
- [ ] Railway `SUPABASE_ANON_KEY` length = 208 chars
- [ ] Railway key preview matches local/Vercel
- [ ] Railway key ends with `...00QhyXuU`
- [ ] `/api/auth/status` shows `tokenVerificationTest.success: true` (when tested with token)
- [ ] Browser console shows no 401 errors
- [ ] Messages send successfully

---

**This is the ONLY fix needed. Once Railway key matches Supabase, 401 errors will stop.**

