# ✅ Environment Variable Verification Guide

## 🔍 **Quick Verification Steps**

### **Step 1: Get Supabase Anon Key**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings → API**
4. Copy the **"anon public"** key (starts with `eyJhbGci...`)

### **Step 2: Verify Railway**
1. Go to [Railway Dashboard](https://railway.app)
2. Select your project → **Settings → Shared Variables**
3. Find `SUPABASE_ANON_KEY`
4. Click to view/unmask the value
5. **Compare** with Supabase "anon public" key
6. **They MUST match exactly** (byte-for-byte)

### **Step 3: Verify Vercel**
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project → **Settings → Environment Variables**
3. Find `VITE_SUPABASE_ANON_KEY`
4. **Compare** with Railway `SUPABASE_ANON_KEY`
5. **They MUST match exactly**

## ✅ **Expected Values**

All three should be **identical**:
- Supabase Dashboard → Settings → API → **anon public**
- Railway → `SUPABASE_ANON_KEY`
- Vercel → `VITE_SUPABASE_ANON_KEY`

## 🔧 **If They Don't Match**

1. **Copy** the value from Supabase Dashboard (source of truth)
2. **Update** Railway `SUPABASE_ANON_KEY` → Railway auto-redeploys
3. **Update** Vercel `VITE_SUPABASE_ANON_KEY` → Vercel auto-redeploys
4. **Wait** 2-3 minutes for deployments
5. **Test** again

## 🧪 **Test After Fix**

1. Hard refresh browser (Cmd+Shift+R)
2. Send a message
3. Check console logs:
   - Should see: `[ChatService] 🔄 401 Unauthorized detected...`
   - Should see: `[ChatService] ✅ Token refreshed, retrying request...`
   - Request should succeed

## 📊 **Current Status**

- ✅ Backend code: Fixed and deployed
- ✅ Frontend code: Fixed and deployed  
- ⚠️ Environment variables: **NEEDS VERIFICATION**

**Next:** Verify all three values match, then test.

