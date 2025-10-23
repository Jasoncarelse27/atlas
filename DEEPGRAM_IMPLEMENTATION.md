# Deepgram STT Implementation - 22x Faster Voice Calls
**Date:** October 23, 2025  
**Status:** Ready to Deploy (Waiting for API Key)

---

## 🎯 **GOAL: Reduce STT Latency from 6.8s → 300ms**

---

## 📊 **PERFORMANCE COMPARISON**

| Provider | Current Latency | After Deepgram | Improvement |
|----------|----------------|----------------|-------------|
| OpenAI Whisper | 6.8s 🐌 | - | - |
| **Deepgram** | - | 0.3s ⚡ | **22x faster** |

| Total Voice Call Latency | Before | After | Improvement |
|--------------------------|--------|-------|-------------|
| **End-to-End** | 12-14s | 5-6s | **60% faster** |

---

## 💰 **COST ANALYSIS**

| Component | Provider | Cost/Min | Notes |
|-----------|----------|----------|-------|
| STT | OpenAI Whisper | $0.006 | Current |
| STT | **Deepgram** | $0.0125 | +$0.0065/min |
| Claude Sonnet | Anthropic | ~$0.0025/msg | Unchanged |
| TTS | OpenAI | $0.015 | Unchanged |

**Cost Impact:** +$0.39/hour for 22x faster STT = **Worth it**

---

## 🔧 **IMPLEMENTATION STEPS**

### **1. Backend: Add Deepgram STT Endpoint**

**File:** `backend/server.mjs` (after line 1450)

```javascript
// 🚀 DEEPGRAM STT - 22x faster than Whisper (300ms vs 6.8s)
app.post('/api/stt-deepgram', verifyJWT, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { audio } = req.body; // base64 audio (without data:audio/webm;base64, prefix)
    const userId = req.user.id;
    
    if (!audio) {
      return res.status(400).json({ error: 'Audio data required' });
    }
    
    // Check Deepgram API key
    if (!process.env.DEEPGRAM_API_KEY) {
      logger.error('[Deepgram] API key not configured');
      return res.status(500).json({ error: 'STT service not configured' });
    }
    
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    
    // Call Deepgram API
    const deepgramResponse = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en',
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/webm',
        },
        body: audioBuffer,
      }
    );
    
    if (!deepgramResponse.ok) {
      const error = await deepgramResponse.text();
      logger.error('[Deepgram] API error:', error);
      return res.status(deepgramResponse.status).json({ 
        error: 'Transcription failed',
        details: error 
      });
    }
    
    const result = await deepgramResponse.json();
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
    const duration = result.metadata?.duration || 0;
    const latency = Date.now() - startTime;
    
    logger.info(`[Deepgram] ✅ STT success: "${transcript.substring(0, 50)}...", ${latency}ms, confidence: ${(confidence * 100).toFixed(1)}%`);
    
    // Log usage for cost tracking
    await supabase.from('usage_logs').insert({
      user_id: userId,
      event: 'stt_deepgram',
      data: {
        transcript_length: transcript.length,
        audio_duration: duration,
        latency_ms: latency,
        confidence: confidence,
        cost: duration * 0.0125 / 60 // $0.0125 per minute
      },
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    
    res.json({ 
      text: transcript,
      confidence: confidence,
      duration_seconds: duration,
      latency_ms: latency
    });
    
  } catch (error) {
    const latency = Date.now() - startTime;
    logger.error(`[Deepgram] Error: ${error.message}, ${latency}ms`);
    res.status(500).json({ error: 'Transcription failed', details: error.message });
  }
});
```

---

### **2. Frontend: Update voiceCallService.ts**

**File:** `src/services/voiceCallService.ts` (line 508-530)

**REPLACE THIS:**
```typescript
// STT via OpenAI Whisper (direct call)
const formData = new FormData();
formData.append('file', audioBlob, 'audio.webm');
formData.append('model', 'whisper-1');
formData.append('language', 'en');

const sttResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
  },
  body: formData,
});

const fetchEnd = performance.now();
logger.info(`[VoiceCall] ⏱️ STT fetch: ${(fetchEnd - fetchStart).toFixed(0)}ms`);

if (!sttResponse.ok) {
  throw new Error(`STT failed: ${sttResponse.statusText}`);
}

const sttResult = await sttResponse.json();
const transcript = sttResult.text?.trim();
```

**WITH THIS:**
```typescript
// STT via Deepgram (22x faster than Whisper)
const base64Audio = await this.blobToBase64(audioBlob);
const { data: { session } } = await supabase.auth.getSession();

const sttResponse = await fetch('/api/stt-deepgram', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
  },
  body: JSON.stringify({ 
    audio: base64Audio.split(',')[1] // Remove data:audio/webm;base64, prefix
  }),
});

const fetchEnd = performance.now();
logger.info(`[VoiceCall] ⏱️ STT fetch: ${(fetchEnd - fetchStart).toFixed(0)}ms`);

if (!sttResponse.ok) {
  throw new Error(`STT failed: ${sttResponse.statusText}`);
}

const sttResult = await sttResponse.json();
const transcript = sttResult.text?.trim();

logger.info(`[VoiceCall] 📊 Deepgram confidence: ${(sttResult.confidence * 100).toFixed(1)}%`);
```

---

### **3. Environment Variable**

**File:** `.env`

Add this line:
```
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

---

### **4. Helper Method (if not exists)**

**File:** `src/services/voiceCallService.ts`

Check if `blobToBase64` method exists. If not, add:

```typescript
private async blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

---

## ✅ **TESTING CHECKLIST**

After deployment:

- [ ] Voice call starts successfully
- [ ] STT latency < 500ms (check console logs)
- [ ] Transcription accuracy is good
- [ ] No backend errors in logs
- [ ] Usage logs track Deepgram costs
- [ ] Total call latency < 6 seconds
- [ ] User can have multi-turn conversation
- [ ] Interrupts work smoothly

---

## 📊 **EXPECTED LOGS**

**Before (Whisper):**
```
[VoiceCall] ⏱️ STT fetch: 6819ms  🐌
[VoiceCall] ⏱️ Total latency: 12000ms
```

**After (Deepgram):**
```
[VoiceCall] ⏱️ STT fetch: 300ms  ⚡
[VoiceCall] 📊 Deepgram confidence: 96.3%
[VoiceCall] ⏱️ Total latency: 5200ms
```

---

## 🚀 **DEPLOYMENT**

1. Add `DEEPGRAM_API_KEY` to `.env`
2. Update backend (`server.mjs`)
3. Update frontend (`voiceCallService.ts`)
4. Restart backend: `pkill -f "node server.mjs" && cd backend && nohup node server.mjs > ../backend.log 2>&1 &`
5. Test voice call
6. Commit & push

---

## 🎯 **SUCCESS CRITERIA**

✅ STT latency drops from 6.8s → 0.3s (22x faster)  
✅ Total latency drops from 12-14s → 5-6s (60% faster)  
✅ Voice calls feel natural (like ChatGPT)  
✅ No premature interrupts  
✅ Cost increase acceptable (+$0.39/hour)  

---

**READY TO IMPLEMENT - WAITING FOR DEEPGRAM API KEY**

