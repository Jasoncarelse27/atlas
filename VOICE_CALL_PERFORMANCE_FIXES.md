# 🚨 Voice Call Performance Critical Fixes

## Current Issues (From Your Logs)

### ❌ **Unacceptable Performance:**
- **Initial response: 54.5 seconds** (should be < 2s)
  - STT: 7 seconds (should be 200-300ms)
  - Claude TTFB: 41 seconds (should be < 1s)
  - Total latency: 54.5 seconds
- **Second STT: 6.2 seconds** (still too slow)
- **TTS timing out** after 10 seconds
- **Conversation sync: 12 seconds** (blocking during call)

---

## 🎯 Immediate Fixes (5 minutes)

### 1. **Increase TTS Timeout**
```typescript
// audioQueueService.ts line 106
// Before: 10000 (10 seconds)
// After: 30000 (30 seconds)
if (Date.now() - startWait > 30000) {
```

### 2. **Disable Conversation Sync During Voice Calls**
```typescript
// ChatPage.tsx - Add check in sync service
if (voiceCallActive) return; // Skip sync during voice calls
```

### 3. **Add Request Timeouts**
```typescript
// voiceCallService.ts - Add timeout to fetch calls
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

fetch('/api/stt-deepgram', {
  signal: controller.signal,
  // ... rest of options
});
```

### 4. **Use Faster Claude Model for Voice**
```typescript
// backend/server.mjs line 1047
model: is_voice_call ? 'claude-3-haiku-20240307' : selectedModel,
```

---

## 🚀 Root Cause Analysis

### 1. **STT Slowness (6-7 seconds)**
- **Likely cause:** Cold start on backend or Deepgram API latency
- **Fix:** Add keep-alive, connection pooling, or switch to streaming STT

### 2. **Claude 41-second delay**
- **Likely cause:** Model cold start or rate limiting
- **Fix:** Use Haiku for voice (10x faster), add timeout

### 3. **TTS Timeout**
- **Likely cause:** 10-second timeout too short for TTS generation
- **Fix:** Increase to 30 seconds, add progress logging

### 4. **Conversation Sync Blocking**
- **Likely cause:** Running heavy DB queries during voice call
- **Fix:** Disable sync during active calls

---

## 📊 Performance Targets

| Component | Current | Target | Solution |
|-----------|---------|--------|----------|
| STT | 6-7s | 300ms | Streaming API, connection pooling |
| Claude TTFB | 41s | < 1s | Use Haiku, add timeout |
| TTS Generation | 10s timeout | < 2s | Increase timeout, optimize |
| Total Response | 54s | < 2s | All above combined |

---

## 🔥 Quick Win Implementation

```typescript
// 1. Use streaming for everything
const response = await fetch('/api/message?stream=1', {
  headers: {
    'Accept': 'text/event-stream',
  }
});

// 2. Process chunks as they arrive
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Process chunk immediately
}

// 3. Skip unnecessary operations
if (isVoiceCallActive) {
  // Skip: conversation sync, message animations, etc.
}
```

---

## 🎯 ChatGPT-Quality Checklist

### ✅ **What ChatGPT Does Right:**
1. **Instant STT** - Uses streaming, no waiting
2. **Fast first token** - < 500ms to start speaking
3. **Natural interruptions** - Smooth cut-offs
4. **No blocking operations** - Everything async
5. **Optimized models** - Uses GPT-3.5 Turbo for voice

### ❌ **What Atlas Is Doing Wrong:**
1. **Batch processing** - Waiting for full audio before STT
2. **Slow model** - Using Sonnet instead of Haiku
3. **Sync operations** - DB sync during calls
4. **High timeouts** - Allowing 41s delays
5. **No streaming** - Waiting for complete responses

---

## 💡 The Fix Priority

1. **Use Haiku for voice** - 10x faster than Sonnet
2. **Add timeouts everywhere** - Max 5s for any operation
3. **Disable sync during calls** - No DB operations
4. **Stream everything** - STT, LLM, TTS all streaming
5. **Connection pooling** - Reuse HTTPS connections
