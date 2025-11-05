# 🚨 CRITICAL: Vercel Environment Variables Setup

**Date:** November 5, 2025  
**Status:** 🔴 **BLOCKING PRODUCTION**  
**Priority:** **IMMEDIATE ACTION REQUIRED**

---

## 🔴 Problem

Your Vercel deployment is missing Supabase environment variables:
- `VITE_SUPABASE_URL=false`
- `VITE_SUPABASE_ANON_KEY=false`

**Impact:** App completely broken - won't load even if Zustand fix works.

---

## ✅ Quick Fix (5 Minutes)

### **Step 1: Get Your Supabase Credentials**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings → API**
4. Copy:
   - **Project URL** (this is `VITE_SUPABASE_URL`)
   - **anon/public key** (this is `VITE_SUPABASE_ANON_KEY`)

### **Step 2: Add to Vercel**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **atlas** project
3. Go to **Settings → Environment Variables**
4. Click **Add New**
5. Add these **TWO** variables:

   **Variable 1:**
   - **Name:** `VITE_SUPABASE_URL`
   - **Value:** `https://your-project-id.supabase.co` (your actual URL)
   - **Environment:** ✅ Production ✅ Preview ✅ Development
   - Click **Save**

   **Variable 2:**
   - **Name:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (your actual key)
   - **Environment:** ✅ Production ✅ Preview ✅ Development
   - Click **Save**

### **Step 3: Redeploy**

1. After adding variables, go to **Deployments** tab
2. Click **⋯** (three dots) on latest deployment
3. Click **Redeploy**
4. Wait ~2 minutes for deployment

---

## ✅ Verification

After redeploy:

1. **Check Console:**
   - Open DevTools → Console
   - ✅ Should NOT see Supabase env variable error
   - ✅ Should NOT see `create` export error

2. **Check Bundle Hash:**
   - DevTools → Network → Reload
   - Find `index-*.js`
   - ✅ Should NOT be `aoA5kM6H` (new hash)

3. **Test App:**
   - ✅ App loads (no white screen)
   - ✅ Can authenticate
   - ✅ Can send messages

---

## 📋 Complete Environment Variables List

For reference, here are ALL environment variables needed:

### **Frontend (Vercel):**
- `VITE_SUPABASE_URL` ✅ **REQUIRED**
- `VITE_SUPABASE_ANON_KEY` ✅ **REQUIRED**
- `VITE_SENTRY_DSN` (optional - for error tracking)
- `VITE_FASTSPRING_STORE_ID` (optional - for payments)
- `VITE_FASTSPRING_API_KEY` (optional - for payments)

### **Backend (Railway):**
- `SUPABASE_URL` (same as VITE_SUPABASE_URL)
- `SUPABASE_SERVICE_ROLE_KEY` (different from anon key)
- `CLAUDE_API_KEY`
- `REDIS_URL` (if using Redis)

---

## ⚠️ Security Notes

- ✅ **Anon Key:** Safe to expose in frontend (has RLS protection)
- ❌ **Service Role Key:** NEVER expose in frontend (backend only)
- ✅ **Project URL:** Safe to expose

---

## 🎯 Expected Result

After adding environment variables and redeploying:

**Before:**
- ❌ `Missing Supabase environment variables`
- ❌ App shows error page
- ❌ Cannot authenticate

**After:**
- ✅ No environment variable errors
- ✅ App loads correctly
- ✅ Can authenticate and use app

---

**Status:** ⏳ **WAITING FOR USER TO ADD ENV VARS**  
**Time to Fix:** ~5 minutes  
**Blocking:** ✅ **YES - App won't work without this**

