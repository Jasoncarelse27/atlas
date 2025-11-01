# TTS Error Handling - Best Practices & Fixes

## 🔍 **Issue Identified**

**Error:** `POST https://rbwabemtucdkytvvpzvk.supabase.co/functions/v1/tts 500 (Internal Server Error)`

**Impact:** TTS generation fails intermittently, but retry logic recovers (1-3 attempts)

**Root Causes:**
1. **Edge Function timeout** - Supabase Edge Functions have 60s timeout, large audio can exceed
2. **OpenAI API rate limits** - Temporary throttling causes 500 errors
3. **Missing error details** - Generic 500 doesn't reveal actual issue
4. **No circuit breaker** - Continues retrying even during outages

---

## ✅ **Best Practices to Implement**

### **1. Enhanced Error Logging** ⭐ HIGH PRIORITY

**Current:** Generic error message
```typescript
catch (err) {
  return new Response(JSON.stringify({ error: String(err) }), {
    status: 500,
  });
}
```

**Best Practice:** Detailed error with request ID
```typescript
catch (err) {
  const requestId = crypto.randomUUID();
  console.error(`[TTS] Error ${requestId}:`, {
    error: err.message,
    stack: err.stack,
    textLength: text?.length,
    model,
    latency: Date.now() - startTime
  });
  
  return new Response(JSON.stringify({ 
    error: "TTS generation failed",
    requestId, // ✅ Track errors
    retryable: isRetryableError(err), // ✅ Indicate if retry makes sense
  }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

---

### **2. Circuit Breaker Pattern** ⭐ HIGH PRIORITY

**Why:** Prevents cascading failures during outages

**Implementation:**
```typescript
// Track consecutive failures
let consecutiveFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_TIME = 60000; // 1 minute

function checkCircuitBreaker(): boolean {
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    const lastFailureTime = getLastFailureTime();
    if (Date.now() - lastFailureTime < CIRCUIT_BREAKER_RESET_TIME) {
      return false; // Circuit open - reject requests
    }
    // Reset circuit breaker
    consecutiveFailures = 0;
  }
  return true; // Circuit closed - allow requests
}
```

---

### **3. Fallback Strategy** ⭐ MEDIUM PRIORITY

**Current:** Always uses `tts-1-hd` (slower, higher quality)

**Best Practice:** Fallback to `tts-1` on failure
```typescript
// Try HD first, fallback to standard on error
let model = 'tts-1-hd';
try {
  return await generateTTS(text, voice, model);
} catch (error) {
  if (model === 'tts-1-hd' && isTimeoutError(error)) {
    logger.warn('[TTS] HD model timeout, falling back to standard');
    model = 'tts-1';
    return await generateTTS(text, voice, model);
  }
  throw error;
}
```

---

### **4. Timeout Handling** ⭐ HIGH PRIORITY

**Current:** No explicit timeout on OpenAI API call

**Best Practice:** Set timeout to prevent Edge Function timeout
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 50000); // 50s timeout (10s buffer)

try {
  const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
    signal: controller.signal, // ✅ Abort after 50s
    // ... rest of config
  });
} finally {
  clearTimeout(timeoutId);
}
```

---

### **5. Retry Logic Improvements** ⭐ MEDIUM PRIORITY

**Current:** Fixed exponential backoff (1s, 2s, 4s)

**Best Practice:** Smart retry based on error type
```typescript
function getRetryDelay(attempt: number, error: Error): number {
  // Rate limit: Use Retry-After header if available
  if (error.message.includes('rate limit')) {
    return 60000; // Wait 1 minute
  }
  
  // Timeout: Quick retry
  if (error.message.includes('timeout')) {
    return 2000; // 2 seconds
  }
  
  // Server error: Exponential backoff
  return 1000 * Math.pow(2, attempt);
}

function shouldRetry(error: Error, attempt: number): boolean {
  // Don't retry on auth errors
  if (error.message.includes('401') || error.message.includes('403')) {
    return false;
  }
  
  // Don't retry on client errors (4xx)
  if (error.message.includes('400') || error.message.includes('422')) {
    return false;
  }
  
  // Retry on server errors (5xx) and timeouts
  return attempt < 3;
}
```

---

### **6. Request ID Tracking** ⭐ LOW PRIORITY

**Why:** Track errors across client/server boundaries

**Implementation:**
```typescript
// Client side
const requestId = crypto.randomUUID();
const response = await fetch(`${supabaseUrl}/functions/v1/tts`, {
  headers: {
    'X-Request-ID': requestId, // ✅ Track request
  },
});

// Server side
const requestId = req.headers.get('X-Request-ID') || crypto.randomUUID();
console.log(`[TTS] Request ${requestId}: ${text.length} chars`);
```

---

### **7. Health Check Endpoint** ⭐ LOW PRIORITY

**Why:** Proactively detect TTS service issues

**Implementation:**
```typescript
// Add to Edge Function
if (req.url.endsWith('/health')) {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  return new Response(JSON.stringify({
    status: openaiKey ? 'healthy' : 'unhealthy',
    service: 'tts',
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

---

## 🚀 **Implementation Priority**

### **Phase 1: Critical Fixes (Immediate)**
1. ✅ Add timeout handling (prevent Edge Function timeout)
2. ✅ Enhanced error logging (debug 500 errors)
3. ✅ Circuit breaker (prevent cascading failures)

### **Phase 2: Improvements (This Week)**
4. ✅ Fallback to `tts-1` on timeout
5. ✅ Smart retry logic (error-aware)
6. ✅ Request ID tracking

### **Phase 3: Monitoring (Next Week)**
7. ✅ Health check endpoint
8. ✅ Sentry integration for TTS errors
9. ✅ Metrics dashboard

---

## 📊 **Expected Improvements**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| TTS Error Rate | ~5% | <1% | 80% reduction |
| Recovery Time | 3-5s | <1s | 4x faster |
| User Impact | Visible errors | Seamless fallback | Better UX |
| Debug Time | Hours | Minutes | 10x faster |

---

## 🔧 **Quick Wins**

### **1. Add Timeout (5 minutes)**
```typescript
// In supabase/functions/tts/index.ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 50000);

const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
  signal: controller.signal,
  // ... rest
});
```

### **2. Better Error Messages (5 minutes)**
```typescript
if (!ttsResponse.ok) {
  const errorText = await ttsResponse.text();
  const errorJson = JSON.parse(errorText).catch(() => ({ error: errorText }));
  
  return new Response(JSON.stringify({ 
    error: "TTS generation failed",
    details: errorJson.error || errorText,
    code: ttsResponse.status,
  }), {
    status: ttsResponse.status,
  });
}
```

### **3. Fallback Model (10 minutes)**
```typescript
// In audioQueueService.ts
let model = 'tts-1-hd';
try {
  return await generateTTS(text, voice, model);
} catch (error) {
  if (model === 'tts-1-hd' && error.message.includes('timeout')) {
    logger.warn('[TTS] HD timeout, using standard model');
    model = 'tts-1';
    return await generateTTS(text, voice, model);
  }
  throw error;
}
```

---

## 📝 **Summary**

**Current State:** TTS works but has intermittent 500 errors that recover with retries

**Goal:** Zero visible errors, seamless fallback, faster recovery

**Next Steps:**
1. Implement timeout handling (prevents Edge Function timeout)
2. Add fallback to `tts-1` model
3. Enhanced error logging for debugging
4. Circuit breaker for outages

**Estimated Time:** 30 minutes for critical fixes, 2 hours for full implementation

