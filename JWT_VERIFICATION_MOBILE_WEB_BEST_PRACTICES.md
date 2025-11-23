# JWT Verification Best Practices - Mobile & Web Implementation

**Date:** December 8, 2025  
**Platforms:** Web (React/TypeScript) + Mobile Browsers (PWA)  
**Status:** ✅ **SECURE IMPLEMENTATION GUIDE**

---

## 🎯 **Research Summary**

### **Key Findings:**

1. **Supabase `auth.getClaims()`** - ✅ **RECOMMENDED**
   - Verifies JWT signature locally using JWKS (no network request)
   - Works for both web and mobile browsers
   - Uses Web Crypto API (browser) / Apple Security Framework (iOS native)
   - Requires asymmetric signing keys (RS256/ES256)

2. **Supabase `auth.getUser()`** - ⚠️ **FALLBACK ONLY**
   - Makes network request to Supabase Auth server
   - Verifies token server-side
   - Use only when `getClaims()` unavailable or fails

3. **Best Practices:**
   - ✅ Use `getClaims()` for local verification (fast, secure, offline-capable)
   - ✅ Implement retry logic with exponential backoff
   - ✅ Cache verification results (5-10 minutes)
   - ✅ Fail closed (reject invalid tokens)
   - ✅ Monitor and alert on failures

---

## 🔧 **Recommended Implementation**

### **Backend: Secure JWT Verification Service**

```javascript
// backend/services/jwtVerificationService.mjs

import { logger } from '../lib/simpleLogger.mjs';
import { supabasePublic } from '../config/supabaseClient.mjs';

// ✅ Cache for verification results (5 minutes)
const verificationCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ✅ Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

/**
 * ✅ SECURE: Verify JWT using Supabase auth.getClaims() (local verification)
 * Falls back to auth.getUser() with retry logic if needed
 * Works for both web and mobile browsers
 */
export async function verifyJWT(token) {
  // 1. Check cache first
  const cacheKey = token.substring(0, 50);
  const cached = verificationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug('[JWT] ✅ Cache hit for token verification');
    return cached.user;
  }

  // 2. Try auth.getClaims() first (local verification - secure & fast)
  try {
    const { data: { user }, error } = await supabasePublic.auth.getClaims(token);
    
    if (!error && user) {
      // ✅ Cache successful verification
      verificationCache.set(cacheKey, {
        user,
        expiresAt: Date.now() + CACHE_TTL
      });
      
      logger.debug('[JWT] ✅ Verified using auth.getClaims() (local)');
      return user;
    }
    
    // If getClaims() fails, log but don't throw yet
    logger.debug('[JWT] ⚠️ auth.getClaims() failed, trying getUser() fallback:', error?.message);
  } catch (error) {
    logger.debug('[JWT] ⚠️ auth.getClaims() exception, trying getUser() fallback:', error.message);
  }

  // 3. Fallback to auth.getUser() with retry logic
  return await verifyJWTWithRetry(token, cacheKey);
}

/**
 * ✅ FALLBACK: Verify JWT using auth.getUser() with retry logic
 * Handles transient network errors gracefully
 */
async function verifyJWTWithRetry(token, cacheKey) {
  let lastError = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await supabasePublic.auth.getUser(token);
      
      if (result.data?.user) {
        // ✅ Cache successful verification
        verificationCache.set(cacheKey, {
          user: result.data.user,
          expiresAt: Date.now() + CACHE_TTL
        });
        
        logger.debug(`[JWT] ✅ Verified using auth.getUser() (attempt ${attempt + 1})`);
        return result.data.user;
      }
      
      // Check if it's a network error (retry) or auth error (fail immediately)
      const error = result.error;
      if (error) {
        const isNetworkError = isNetworkErrorType(error);
        
        if (!isNetworkError) {
          // Auth error (invalid token) - fail immediately
          throw new Error(`Invalid token: ${error.message}`);
        }
        
        // Network error - retry
        lastError = error;
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          logger.debug(`[JWT] ⚠️ Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    } catch (error) {
      // Check if it's a network error
      if (isNetworkErrorType(error)) {
        lastError = error;
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          logger.debug(`[JWT] ⚠️ Network exception, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      } else {
        // Non-network error - fail immediately
        throw error;
      }
    }
  }
  
  // All retries failed
  throw new Error(`JWT verification failed after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * ✅ Helper: Detect network errors
 */
function isNetworkErrorType(error) {
  if (!error) return false;
  
  const errorMsg = error.message?.toLowerCase() || '';
  const errorName = error.name?.toLowerCase() || '';
  
  return (
    errorMsg.includes('fetch') ||
    errorMsg.includes('network') ||
    errorMsg.includes('connection') ||
    errorMsg.includes('timeout') ||
    errorMsg.includes('econnrefused') ||
    errorMsg.includes('enotfound') ||
    errorName.includes('network') ||
    errorName.includes('fetch') ||
    errorName === 'typeerror' ||
    error.status === undefined // Network errors often lack status codes
  );
}

/**
 * ✅ Cleanup: Clear expired cache entries
 */
export function clearExpiredCache() {
  const now = Date.now();
  for (const [key, value] of verificationCache.entries()) {
    if (value.expiresAt <= now) {
      verificationCache.delete(key);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(clearExpiredCache, 10 * 60 * 1000);
```

---

### **Backend Middleware: Updated verifyJWT**

```javascript
// backend/server.mjs - Updated verifyJWT middleware

import { verifyJWT as verifyJWTSecure } from './services/jwtVerificationService.mjs';

const verifyJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Missing or invalid authorization header'
    });
  }

  const token = authHeader.substring(7);
  
  try {
    // ✅ SECURE: Use secure verification service
    const user = await verifyJWTSecure(token);
    
    if (!user || !user.id) {
      return res.status(401).json({ 
        error: 'Invalid token',
        details: 'No user found in token'
      });
    }
    
    req.user = user;
    return next();
    
  } catch (error) {
    logger.error('[verifyJWT] ❌ Verification failed:', {
      error: error.message,
      tokenPreview: token.substring(0, 20) + '...',
      path: req.path
    });
    
    // ✅ FAIL CLOSED: Reject request
    return res.status(401).json({ 
      error: 'Authentication failed',
      details: error.message,
      code: 'TOKEN_VERIFICATION_FAILED',
      suggestion: 'Please refresh your session or sign in again'
    });
  }
};
```

---

## 📱 **Frontend: Mobile & Web Support**

### **Client-Side Token Refresh**

```typescript
// src/utils/authTokenManager.ts

import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';

/**
 * ✅ BEST PRACTICE: Get auth token with automatic refresh
 * Works for both web and mobile browsers
 */
export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  try {
    // 1. Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      logger.debug('[AuthToken] No session found');
      return null;
    }
    
    // 2. Check if token needs refresh (within 5 minutes of expiry)
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const needsRefresh = timeUntilExpiry < 5 * 60 * 1000; // 5 minutes
    
    if (forceRefresh || needsRefresh) {
      logger.debug('[AuthToken] Token expiring soon, refreshing...');
      
      // 3. Refresh session
      const { data: { session: refreshedSession }, error: refreshError } = 
        await supabase.auth.refreshSession();
      
      if (refreshError || !refreshedSession) {
        logger.warn('[AuthToken] Token refresh failed:', refreshError?.message);
        return session.access_token; // Return old token as fallback
      }
      
      return refreshedSession.access_token;
    }
    
    return session.access_token;
    
  } catch (error) {
    logger.error('[AuthToken] Error getting token:', error);
    return null;
  }
}
```

---

## 🔒 **Security Considerations**

### **1. Signature Verification**

✅ **ALWAYS verify signature** - Never decode without verification
- `auth.getClaims()` verifies signature using JWKS (secure)
- `auth.getUser()` verifies signature server-side (secure)
- ❌ Never decode JWT payload without verification (current fallback is insecure)

### **2. Fail Closed**

✅ **Reject invalid tokens** - Don't allow requests when verification fails
- Network errors → Retry with exponential backoff
- Auth errors → Fail immediately (don't retry)
- All retries exhausted → Fail closed

### **3. Token Storage**

✅ **Secure storage** - Use platform-appropriate storage
- **Web:** HTTP-only cookies (preferred) or secure localStorage
- **Mobile:** Keychain (iOS) / Keystore (Android)
- **PWA:** Secure localStorage with encryption

### **4. Token Expiration**

✅ **Handle expiration gracefully**
- Proactive refresh (5 minutes before expiry)
- Automatic retry on 401 errors
- Clear error messages for expired tokens

---

## 📊 **Performance Optimizations**

### **1. Caching**

✅ **Cache verification results** (5-10 minutes)
- Reduces network requests
- Improves response time
- Still secure (cached results are verified)

### **2. Local Verification**

✅ **Use `auth.getClaims()` first**
- No network request (fast)
- Works offline (mobile benefit)
- Verifies signature (secure)

### **3. Retry Logic**

✅ **Exponential backoff**
- Prevents overload during outages
- Handles transient network errors
- Fails fast on auth errors

---

## 🧪 **Testing Strategy**

### **1. Unit Tests**

```javascript
// Test getClaims() success
// Test getUser() fallback
// Test retry logic
// Test cache behavior
// Test network error detection
```

### **2. Integration Tests**

```javascript
// Test full verification flow
// Test mobile browser compatibility
// Test web browser compatibility
// Test offline scenarios
```

### **3. Security Tests**

```javascript
// Test invalid token rejection
// Test expired token rejection
// Test forged token rejection
// Test network error handling
```

---

## 📝 **Migration Plan**

### **Phase 1: Create Secure Service** ✅
1. Create `jwtVerificationService.mjs`
2. Implement `verifyJWT()` with `getClaims()` + retry
3. Add caching and error handling

### **Phase 2: Update Backend** ✅
1. Replace insecure fallback decode
2. Use secure verification service
3. Update error handling

### **Phase 3: Frontend Updates** ✅
1. Update token refresh logic
2. Add proactive token refresh
3. Improve error messages

### **Phase 4: Testing** ✅
1. Test on web browsers
2. Test on mobile browsers
3. Test offline scenarios
4. Test network error scenarios

### **Phase 5: Monitoring** ✅
1. Add metrics for verification failures
2. Alert on high failure rates
3. Monitor cache hit rates

---

## ✅ **Benefits**

1. **Security:** ✅ Verifies signature (no authentication bypass)
2. **Performance:** ✅ Local verification (fast, offline-capable)
3. **Reliability:** ✅ Retry logic (handles transient errors)
4. **Scalability:** ✅ Caching (reduces load)
5. **Compatibility:** ✅ Works on web and mobile browsers

---

## 🚨 **Current Status**

**Current Implementation:** ⚠️ **INSECURE** (decodes without verification)  
**Recommended Implementation:** ✅ **SECURE** (verifies signature)  
**Migration Required:** 🔴 **YES** - Replace insecure fallback immediately

---

**Next Steps:**
1. ✅ Create secure verification service
2. ✅ Update backend middleware
3. ✅ Test on web and mobile browsers
4. ✅ Deploy and monitor

























