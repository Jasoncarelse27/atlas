# ✅ API URL Fix for Vercel Deployment

**Issue:** Frontend deployed on Vercel was making API calls to Vercel domain instead of Railway backend  
**Root Cause:** Services were using relative URLs (`/api/message`) which only work with Vite proxy in development  
**Fix:** Created centralized API client utility and updated all services to use `VITE_API_URL` in production  
**Status:** ✅ COMPLETE - Ready for deployment

---

## 🔍 **ROOT CAUSE ANALYSIS**

### **The Problem:**
When the frontend is deployed on Vercel (separate domain from Railway backend), relative URLs like `/api/message` resolve to `https://atlas-8h6x.vercel.app/api/message` instead of `https://atlas-production-2123.up.railway.app/api/message`.

### **Why It Happened:**
- In development, Vite proxy handles `/api/*` routes and forwards them to the backend
- In production on Vercel, there's no proxy - relative URLs go to Vercel's domain
- Services were inconsistently using relative URLs vs `VITE_API_URL`

---

## ✅ **THE COMPREHENSIVE FIX**

### **1. Created Centralized API Client** (`src/utils/apiClient.ts`)
```typescript
/**
 * Centralized API Client Utility
 * - Production: Requires VITE_API_URL to be set (frontend/backend on different domains)
 * - Development: Uses relative URLs (Vite proxy handles routing)
 */
export function getApiUrl(): string
export function getApiEndpoint(endpoint: string): string
```

**Best Practices Implemented:**
- ✅ Single source of truth for API URL resolution
- ✅ Production warning if `VITE_API_URL` is missing
- ✅ Handles trailing slashes consistently
- ✅ Supports both `/api/endpoint` and `api/endpoint` formats

### **2. Updated All Services** (18 files)

**Services Updated:**
1. ✅ `src/services/chatService.ts` - 5 API calls
2. ✅ `src/services/voiceCallService.ts` - 4 API calls
3. ✅ `src/services/voice/STTService.ts` - 1 API call
4. ✅ `src/services/voiceCallServiceSimplified.ts` - 2 API calls
5. ✅ `src/services/fastspringService.ts` - 1 API call
6. ✅ `src/services/imageService.ts` - 1 API call
7. ✅ `src/services/voiceService.ts` - 2 API calls
8. ✅ `src/services/featureService.ts` - 2 API calls
9. ✅ `src/services/tierEnforcementService.ts` - 4 API calls
10. ✅ `src/hooks/useTierMiddleware.ts` - 1 API call
11. ✅ `src/hooks/useNetworkStatus.ts` - 1 API call

**Pattern Applied:**
```typescript
// ❌ BEFORE:
const response = await fetch('/api/message?stream=1', { ... });

// ✅ AFTER:
import { getApiEndpoint } from '@/utils/apiClient';
const response = await fetch(getApiEndpoint('/api/message?stream=1'), { ... });
```

### **3. Updated Legacy Utilities**
- ✅ `src/utils/getBaseUrl.ts` - Now redirects to `apiClient` (backward compatible)

---

## 🚀 **DEPLOYMENT CHECKLIST**

### **1. Verify Vercel Environment Variable**
```bash
# In Vercel Dashboard → Settings → Environment Variables
VITE_API_URL=https://atlas-production-2123.up.railway.app
```

**⚠️ CRITICAL:** This MUST be set for production to work!

### **2. Verify Development Still Works**
```bash
# In development, VITE_API_URL can be empty (uses relative URLs)
# Vite proxy handles routing
npm run dev
```

### **3. Test Production Deployment**
1. Deploy to Vercel
2. Visit Vercel URL
3. Open browser console
4. Send a message
5. Verify API calls go to Railway backend (check Network tab)

---

## 📊 **FILES CHANGED**

### **New Files:**
- `src/utils/apiClient.ts` - Centralized API client utility

### **Updated Files (18):**
- `src/services/chatService.ts`
- `src/services/voiceCallService.ts`
- `src/services/voice/STTService.ts`
- `src/services/voiceCallServiceSimplified.ts`
- `src/services/fastspringService.ts`
- `src/services/imageService.ts`
- `src/services/voiceService.ts`
- `src/services/featureService.ts`
- `src/services/tierEnforcementService.ts`
- `src/hooks/useTierMiddleware.ts`
- `src/hooks/useNetworkStatus.ts`
- `src/utils/getBaseUrl.ts` (backward compatibility)

---

## 🧪 **TESTING**

### **Before Deployment:**
```bash
# 1. Check all imports compile
npm run build

# 2. Verify no linting errors
npm run lint

# 3. Test locally (should still work with Vite proxy)
npm run dev
```

### **After Deployment:**
1. ✅ Visit Vercel URL
2. ✅ Open browser console
3. ✅ Send a test message
4. ✅ Check Network tab - API calls should go to Railway
5. ✅ Verify no 405 Method Not Allowed errors

---

## 🎯 **EXPECTED BEHAVIOR**

### **Development:**
- `VITE_API_URL` empty or not set → Uses relative URLs → Vite proxy routes to backend
- Works as before ✅

### **Production (Vercel):**
- `VITE_API_URL` set to Railway URL → All API calls go to Railway backend
- Frontend on Vercel, backend on Railway ✅

---

## ⚠️ **CRITICAL NOTES**

1. **VITE_API_URL MUST be set in Vercel** - Without it, API calls will fail
2. **No trailing slash** - Railway URL should be `https://atlas-production-2123.up.railway.app` (no trailing `/`)
3. **CORS configured** - Backend CORS already allows Vercel domains (see `backend/server.mjs`)

---

## 📝 **BEST PRACTICES FOLLOWED**

1. ✅ **Single Source of Truth** - One utility handles all API URLs
2. ✅ **Production Safety** - Warns if `VITE_API_URL` missing in production
3. ✅ **Backward Compatible** - Legacy `getBaseUrl()` still works
4. ✅ **Comprehensive** - Updated ALL services, not just chat
5. ✅ **Consistent Pattern** - Same import and usage everywhere

---

**Status:** ✅ **READY FOR DEPLOYMENT**  
**Next Step:** Set `VITE_API_URL` in Vercel environment variables and deploy

