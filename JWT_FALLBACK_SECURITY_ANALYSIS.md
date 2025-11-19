# JWT Fallback Verification - Security Analysis & Best Practices

**Date:** December 8, 2025  
**Status:** ⚠️ **SECURITY CONCERN IDENTIFIED**  
**Recommendation:** **REPLACE WITH SECURE ALTERNATIVE**

---

## 🔍 **Current Implementation**

The current fallback JWT verification approach:
1. **Detects network errors** from Supabase `auth.getUser()` failures
2. **Decodes JWT without signature verification** as fallback
3. **Checks token expiration** (`exp` claim) before accepting
4. **Extracts user info** from decoded payload

**Location:** `backend/server.mjs` lines 868-956

---

## ⚠️ **Security Risks**

### **1. Authentication Bypass Vulnerability**

**Risk Level:** 🔴 **CRITICAL**

**Problem:**
- Decoding JWTs without signature verification allows **anyone to forge tokens**
- An attacker can create a fake JWT with:
  - Valid structure (3 parts: header.payload.signature)
  - Any user ID (`sub` claim)
  - Any email (`email` claim)
  - Future expiration (`exp` claim)

**Attack Scenario:**
```javascript
// Attacker creates fake JWT:
const fakeToken = base64url(header) + '.' + 
                  base64url({sub: 'admin-user-id', email: 'admin@atlas.com', exp: future}) + 
                  '.' + 
                  base64url('fake-signature');

// Current code accepts this because:
// 1. Network error detected ✅
// 2. Token structure valid ✅
// 3. Token not expired ✅
// 4. Signature NOT verified ❌
```

**Impact:**
- **Full authentication bypass** - attacker can impersonate any user
- **Tier escalation** - attacker can claim Studio tier without payment
- **Data breach** - access to any user's conversations/messages

---

### **2. Fail-Open vs Fail-Closed**

**Security Best Practice:** 🔒 **FAIL CLOSED**

**Current Behavior:** ⚠️ **FAIL OPEN** (allows requests when verification fails)

**Industry Standard:**
- **Fail Closed:** Reject all requests when verification fails (secure, but may cause downtime)
- **Fail Open:** Allow requests with degraded security (risky, but maintains availability)

**Recommendation:**
- **Production systems should FAIL CLOSED** for authentication
- **Availability concerns** should be addressed with:
  - Retry logic with exponential backoff
  - Cached verification results
  - Circuit breakers
  - Health checks and monitoring

---

## ✅ **Best Practices Research**

### **1. Supabase Official Recommendations**

**From Supabase Documentation:**

1. **Server-Side Verification:**
   - ✅ Use `auth.getUser()` - makes network request, verifies token
   - ✅ Always verify signature - never decode without verification
   - ✅ Use `auth.getClaims()` for local verification (verifies signature using JWKS)

2. **Client-Side:**
   - ✅ Use `auth.getSession()` - retrieves from local storage (no verification)
   - ⚠️ Never use `getSession()` on server - doesn't verify token

3. **Local Verification:**
   - ✅ Use `auth.getClaims()` - verifies signature locally using JWKS
   - ✅ Requires asymmetric signing keys (RS256)
   - ✅ No network request needed

---

### **2. Industry Standards**

**OWASP JWT Security Cheat Sheet:**
- ✅ **Always verify signature** before trusting token
- ✅ **Never decode without verification** in production
- ✅ **Use JWKS** for local signature verification
- ❌ **Never trust client-provided tokens** without verification

**NIST Guidelines:**
- ✅ **Fail closed** for authentication failures
- ✅ **Implement retry logic** for transient failures
- ✅ **Monitor and alert** on authentication failures

---

## 🔧 **Recommended Solutions**

### **Option 1: Use Supabase `auth.getClaims()` (RECOMMENDED)**

**Best Practice:** ✅ **VERIFIES SIGNATURE LOCALLY**

```javascript
// ✅ SECURE: Verifies signature using JWKS (no network request)
const { data: { user }, error } = await supabasePublic.auth.getClaims(token);

if (error || !user) {
  // Handle error - fail closed
  return res.status(401).json({ error: 'Invalid token' });
}
```

**Benefits:**
- ✅ Verifies signature locally (secure)
- ✅ No network request (fast, works during outages)
- ✅ Uses JWKS (industry standard)
- ✅ Handles token expiration automatically

**Requirements:**
- Supabase must use asymmetric signing keys (RS256)
- JWKS endpoint must be accessible

---

### **Option 2: Retry Logic with Exponential Backoff**

**Best Practice:** ✅ **FAIL CLOSED WITH RETRIES**

```javascript
async function verifyJWTWithRetry(token, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await supabasePublic.auth.getUser(token);
      if (result.data?.user) {
        return result.data.user;
      }
      
      // If it's a network error, retry
      if (result.error && isNetworkError(result.error)) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Non-network error - fail immediately
      throw new Error('Invalid token');
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

**Benefits:**
- ✅ Handles transient network errors
- ✅ Fails closed (rejects invalid tokens)
- ✅ Exponential backoff (prevents overload)

---

### **Option 3: Cached Verification Results**

**Best Practice:** ✅ **REDUCE NETWORK REQUESTS**

```javascript
// Cache verification results (5 minutes)
const verificationCache = new Map();

async function verifyJWTWithCache(token) {
  const cacheKey = token.substring(0, 50); // Use token prefix as key
  const cached = verificationCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }
  
  const result = await supabasePublic.auth.getUser(token);
  if (result.data?.user) {
    verificationCache.set(cacheKey, {
      user: result.data.user,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    });
    return result.data.user;
  }
  
  throw new Error('Invalid token');
}
```

**Benefits:**
- ✅ Reduces network requests
- ✅ Improves performance
- ✅ Still verifies signature (secure)

---

## 📊 **Risk Assessment**

| Approach | Security | Availability | Performance | Recommendation |
|----------|----------|-------------|-------------|---------------|
| **Current (Decode without verify)** | 🔴 Critical Risk | 🟢 High | 🟢 Fast | ❌ **REPLACE** |
| **auth.getClaims() (JWKS)** | 🟢 Secure | 🟢 High | 🟢 Fast | ✅ **BEST** |
| **Retry Logic** | 🟢 Secure | 🟡 Medium | 🟡 Medium | ✅ **GOOD** |
| **Cached Verification** | 🟢 Secure | 🟢 High | 🟢 Fast | ✅ **GOOD** |
| **Combined (Claims + Cache + Retry)** | 🟢 Secure | 🟢 High | 🟢 Fast | ✅ **IDEAL** |

---

## 🚨 **Immediate Action Required**

### **Priority 1: Replace Fallback Decode**

**Current Code (INSECURE):**
```javascript
// ❌ SECURITY RISK: Decodes without verification
const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
if (payload.sub && payload.email) {
  req.user = { id: payload.sub, email: payload.email };
  return next(); // ⚠️ ACCEPTS FORGED TOKENS
}
```

**Recommended Fix:**
```javascript
// ✅ SECURE: Use Supabase auth.getClaims() for local verification
try {
  const { data: { user }, error } = await supabasePublic.auth.getClaims(token);
  if (error || !user) {
    // Fail closed - reject request
    return res.status(401).json({ error: 'Invalid token' });
  }
  req.user = user;
  return next();
} catch (error) {
  // Network error - fail closed
  return res.status(503).json({ 
    error: 'Authentication service unavailable',
    retryAfter: 60 
  });
}
```

---

### **Priority 2: Implement Retry Logic**

Add exponential backoff retry for transient network errors:

```javascript
async function verifyJWTWithRetry(token, maxRetries = 3) {
  // Implementation from Option 2 above
}
```

---

### **Priority 3: Add Monitoring**

Monitor authentication failures:
- Track network error rates
- Alert on high failure rates
- Log all fallback activations

---

## 📝 **Conclusion**

**Current Implementation:** ⚠️ **NOT A BEST PRACTICE**

**Reasons:**
1. ❌ Decodes without signature verification (security risk)
2. ❌ Allows authentication bypass (critical vulnerability)
3. ❌ Fails open instead of closed (availability over security)

**Recommended Approach:**
1. ✅ Use `auth.getClaims()` for local verification (verifies signature)
2. ✅ Implement retry logic for transient failures
3. ✅ Add cached verification results
4. ✅ Fail closed for authentication failures

**Next Steps:**
1. Replace fallback decode with `auth.getClaims()`
2. Implement retry logic with exponential backoff
3. Add monitoring and alerting
4. Test thoroughly before production deployment

---

**Security Impact:** 🔴 **CRITICAL** - Current implementation allows authentication bypass  
**Recommendation:** 🚨 **REPLACE IMMEDIATELY** with secure alternative

















