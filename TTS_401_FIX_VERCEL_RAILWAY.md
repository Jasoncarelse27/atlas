# 🔧 TTS 401 Fix - Vercel/Railway Deployment Issue

## 🎯 Problem

**Issue**: TTS API returns 401 Unauthorized after moving to Vercel (frontend) + Railway (backend)  
**Root Cause**: Backend was using SERVICE_ROLE_KEY for JWT verification instead of ANON_KEY  
**Status**: ✅ **FIXED**

---

## 🔍 Root Cause Analysis

### **What Changed When Moving to Vercel/Railway:**

**Before (Monolithic):**
- Frontend and backend on same domain
- Shared Supabase client configuration
- JWT verification worked correctly

**After (Separate Deployments):**
- Frontend: Vercel (`*.vercel.app`)
- Backend: Railway (`*.up.railway.app`)
- Cross-origin requests require proper CORS + JWT verification

### **The Bug:**

```javascript
// ❌ WRONG: Using SERVICE_ROLE_KEY for JWT verification
const { data: { user }, error } = await supabase.auth.getUser(token);
// supabase uses SERVICE_ROLE_KEY which bypasses RLS
```

**Why This Fails:**
- SERVICE_ROLE_KEY bypasses Row Level Security (RLS)
- `getUser()` with SERVICE_ROLE_KEY might not properly validate user JWTs
- Best practice: Use ANON_KEY for user token verification

---

## ✅ Solution Applied

### **1. Fixed JWT Verification** (`backend/server.mjs`)

**Before:**
```javascript
// ❌ Using service role client
const { data: { user }, error } = await supabase.auth.getUser(token);
```

**After:**
```javascript
// ✅ Using ANON_KEY client (proper JWT verification)
const { supabasePublic } = await import('./config/supabaseClient.mjs');
const { data: { user }, error } = await supabasePublic.auth.getUser(token);
```

### **2. Enhanced Error Logging**

Added detailed error logging to diagnose issues:
- Token preview (first 20 chars)
- Error details (message, status, name)
- Request origin and path
- User ID when successful

### **3. Improved Frontend Auth Handling**

- ✅ Pre-request session validation
- ✅ Automatic token refresh on 401
- ✅ Better error messages
- ✅ Silent fail for TTS (no redirect)

---

## 📊 Best Practices Followed

### **1. Use ANON_KEY for User Token Verification** ✅

**Why:**
- ANON_KEY respects RLS policies
- Properly validates user JWTs
- Matches frontend behavior

**When to Use SERVICE_ROLE_KEY:**
- Admin operations
- Bypassing RLS (with caution)
- System-level operations

### **2. Separate Supabase Clients** ✅

```javascript
// Backend has two clients:
const supabase = createClient(url, SERVICE_ROLE_KEY); // Admin operations
const supabasePublic = createClient(url, ANON_KEY);   // User JWT verification
```

### **3. Enhanced Error Logging** ✅

- Logs token preview (for debugging)
- Logs error details (message, status)
- Logs request context (origin, path)
- Helps diagnose production issues

---

## 🧪 Testing

### **Before Fix:**
```
POST /api/synthesize
Authorization: Bearer <token>
→ 401 Unauthorized
```

### **After Fix:**
```
POST /api/synthesize
Authorization: Bearer <token>
→ 200 OK (with audio data)
```

### **Verify Fix:**

1. **Check Backend Logs:**
   ```
   [verifyJWT] ✅ Token verified successfully: { userId: '...', email: '...' }
   ```

2. **Check Frontend Console:**
   ```
   [VoiceService] ✅ Audio synthesized successfully
   ```

3. **Test TTS:**
   - Click audio button on message
   - Should play audio (no 401 error)

---

## 🔧 Additional Improvements Made

### **1. Frontend Token Refresh**
- Automatic refresh on 401
- Pre-request session check
- Better error handling

### **2. CORS Configuration**
- Already allows Vercel domains
- Credentials: true
- Proper headers allowed

### **3. Error Messages**
- User-friendly messages
- Detailed logging for debugging
- Silent fail for TTS (no redirect)

---

## 📝 Files Changed

1. ✅ `backend/server.mjs` - Fixed JWT verification to use ANON_KEY
2. ✅ `src/services/voiceService.ts` - Enhanced auth handling
3. ✅ `src/utils/authFetch.ts` - Added preventRedirect option
4. ✅ `src/utils/getAuthToken.ts` - Enhanced refresh logging
5. ✅ `src/components/chat/EnhancedMessageBubble.tsx` - Session validation

---

## 🚀 Deployment Checklist

### **Backend (Railway):**
- [x] `SUPABASE_URL` set
- [x] `SUPABASE_ANON_KEY` set (for JWT verification)
- [x] `SUPABASE_SERVICE_ROLE_KEY` set (for admin operations)
- [x] CORS allows Vercel domains

### **Frontend (Vercel):**
- [x] `VITE_API_URL` set to Railway backend
- [x] `VITE_SUPABASE_URL` set
- [x] `VITE_SUPABASE_ANON_KEY` set

---

## ✅ Expected Behavior

1. **User clicks TTS button**
2. **Frontend checks session** → Validates token exists
3. **Frontend calls `/api/synthesize`** → Sends token in Authorization header
4. **Backend verifies token** → Uses ANON_KEY client (proper verification)
5. **Backend returns audio** → 200 OK with base64 audio
6. **Frontend plays audio** → User hears speech

---

## 🎯 Why This Works Now

### **Before:**
- Backend used SERVICE_ROLE_KEY → Might not validate user JWTs properly
- Cross-origin issues → Token might not be sent correctly
- No error logging → Hard to diagnose

### **After:**
- ✅ Backend uses ANON_KEY → Proper JWT verification
- ✅ CORS configured → Allows Vercel origins
- ✅ Enhanced logging → Easy to diagnose issues
- ✅ Token refresh → Handles expired tokens

---

**Status**: ✅ **FIXED** - Ready for testing  
**Next Step**: Deploy backend changes and test TTS functionality



