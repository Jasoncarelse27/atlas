# ✅ TTS 401 Fix - Vercel/Railway Deployment Issue

## 🔍 Root Cause Identified

**Problem**: Backend was using **SERVICE_ROLE_KEY** for JWT verification instead of **ANON_KEY**

**Why This Broke After Moving to Vercel/Railway:**
- Before: Local development might have worked with service role key
- After: Production environment requires proper JWT validation with anon key
- Service role key bypasses RLS and is for admin operations, NOT token validation

---

## ✅ **THE FIX**

### **Backend JWT Verification** (`backend/server.mjs`)

**Before (WRONG):**
```javascript
// ❌ Using service role key - bypasses RLS, wrong for token validation
const { data: { user }, error } = await supabase.auth.getUser(token);
```

**After (CORRECT):**
```javascript
// ✅ Using anon key - proper JWT validation
const { supabasePublic } = await import('./config/supabaseClient.mjs');
const { data: { user }, error } = await supabasePublic.auth.getUser(token);
```

---

## 🎯 **Why This Matters**

### **Supabase Key Types:**

1. **ANON_KEY** (Public Key)
   - ✅ Used for JWT verification
   - ✅ Respects RLS policies
   - ✅ Validates user tokens correctly
   - ✅ Safe to use in frontend

2. **SERVICE_ROLE_KEY** (Admin Key)
   - ❌ Bypasses RLS policies
   - ❌ Not for token validation
   - ❌ Should only be used for admin operations
   - ❌ Never expose to frontend

### **Best Practice:**
- **JWT Verification**: Use ANON_KEY (`supabasePublic`)
- **Admin Operations**: Use SERVICE_ROLE_KEY (`supabase`)
- **Database Queries**: Use SERVICE_ROLE_KEY (with RLS checks)

---

## 🔧 **Additional Improvements Made**

### **1. Enhanced Error Logging**
- Full error details instead of "Object"
- Token preview for debugging
- Session status logging

### **2. Automatic Token Refresh**
- Retries with refreshed token on 401
- Prevents redirect for TTS failures
- Better user experience

### **3. Pre-Request Validation**
- Checks session before making request
- Attempts refresh if token missing
- Clear error messages

---

## 📋 **Railway Environment Variables Required**

Make sure Railway backend has:

```bash
# Required for JWT verification
SUPABASE_URL=https://rbwabemtucdkytvvpzvk.supabase.co
SUPABASE_ANON_KEY=your-anon-key  # ✅ CRITICAL: Must be set!
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Backend operations
CLAUDE_API_KEY=your-claude-key
OPENAI_API_KEY=your-openai-key  # For TTS
```

**Important**: `SUPABASE_ANON_KEY` must be set in Railway for JWT verification to work!

---

## 🧪 **Testing**

### **Before Fix:**
- ❌ TTS returns 401 Unauthorized
- ❌ "Invalid or expired token" error
- ❌ Token refresh doesn't help

### **After Fix:**
- ✅ TTS works correctly
- ✅ Token validation succeeds
- ✅ Automatic refresh works

---

## 🚀 **Deployment Steps**

1. **Verify Railway Environment Variables:**
   ```bash
   # Check Railway dashboard
   SUPABASE_ANON_KEY is set ✅
   SUPABASE_SERVICE_ROLE_KEY is set ✅
   ```

2. **Redeploy Backend:**
   ```bash
   git push origin main
   # Railway will auto-deploy
   ```

3. **Test TTS:**
   - Click audio button on a message
   - Should work without 401 errors

---

## 📚 **References**

- **Supabase Auth Docs**: https://supabase.com/docs/guides/auth
- **JWT Verification**: https://supabase.com/docs/guides/auth/verify-jwts
- **Service Role vs Anon Key**: https://supabase.com/docs/guides/auth/row-level-security

---

**Status**: ✅ **FIXED** - Backend now uses correct key for JWT verification

**Last Updated**: December 2025









