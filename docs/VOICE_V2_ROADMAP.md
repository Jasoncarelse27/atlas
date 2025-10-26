# Atlas Voice Chat V2 - Roadmap to ChatGPT-Level Performance

## 🎯 Mission
Achieve **< 2 second** total response time with bidirectional streaming voice chat.

---

## 📊 Performance Gap Analysis

| Metric | V1 Current | V2 Target | Technology Shift |
|--------|-----------|-----------|------------------|
| **Total Latency** | 8.4s | < 2s | WebSocket + Edge |
| **STT** | 2.6s (REST) | 0.3s | Streaming WebSocket |
| **Claude TTFB** | 3.3s (HTTP→SSE) | < 1s | Persistent WebSocket |
| **TTS** | 2s (sequential) | 0.4s | Streaming TTS |
| **Infrastructure** | Railway REST | Vercel Edge / Fly.io |

---

## 🏗️ V2 Architecture

### **Target Stack:**
```
Client (React) ←→ Edge Function (WebSocket) ←→ Realtime APIs
    ↓                       ↓                        ↓
  WebAudio          Vercel Edge / Fly.io      Deepgram Stream
    ↓                       ↓                        ↓
  VAD Logic            Session Manager         Claude (proxied)
    ↓                       ↓                        ↓
Audio Buffer          Redis / Supabase         PlayHT Realtime
```

### **New Flow:**
1. **Client** opens persistent WebSocket to `/api/voice-v2`
2. **Mic audio** chunks sent continuously (16 kHz PCM, 100ms intervals)
3. **Deepgram Stream** transcribes in real-time → partial transcripts every 150ms
4. **Claude** receives partial transcript → starts generating after ~500ms
5. **TTS** streams audio back as Claude generates (no sentence wait)
6. **Client** plays audio progressively using AudioWorklet

### **Key Differences from V1:**
| Component | V1 | V2 |
|-----------|----|----|
| Connection | HTTP per request | Persistent WebSocket |
| STT | Upload full file | Stream chunks |
| LLM | Wait for full transcript | Process partial |
| TTS | Generate per sentence | Stream per token |
| Latency | Sequential (8.4s) | Pipelined (< 2s) |

---

## 📋 Implementation Phases

### **Phase 1: Deepgram Streaming Integration (1 week)**

**Deliverables:**
1. Replace `/api/stt-deepgram` REST with WebSocket client
2. Stream audio chunks instead of full blob upload
3. Handle partial transcripts (update UI in real-time)

**Code Changes:**
```typescript
// NEW: src/services/deepgramStreamService.ts
export class DeepgramStreamService {
  private ws: WebSocket | null = null;
  
  async connect(apiKey: string): Promise<void> {
    this.ws = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-2');
    this.ws.onopen = () => this.ws.send(JSON.stringify({ 
      type: 'start', 
      encoding: 'linear16',
      sample_rate: 16000 
    }));
    
    this.ws.onmessage = (event) => {
      const { transcript, is_final } = JSON.parse(event.data);
      if (is_final) this.onFinalTranscript(transcript);
      else this.onPartialTranscript(transcript);
    };
  }
  
  sendAudio(audioChunk: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioChunk);
    }
  }
}
```

**Expected Improvement:** 2.6s → 0.5s (2.1s faster)

**Risk:** Low - Deepgram has well-documented streaming API

---

### **Phase 2: Edge Function with WebSocket (2 weeks)**

**Deliverables:**
1. Create `api/voice-v2/index.ts` as Vercel Edge Function
2. Handle WebSocket upgrades in Edge runtime
3. Proxy between client ←→ Deepgram ←→ Claude

**New Files:**
```
api/
  voice-v2/
    index.ts          # Edge function entry
    sessionManager.ts # Track active voice sessions
    types.ts          # Shared interfaces
```

**Key Code:**
```typescript
// api/voice-v2/index.ts
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const upgrade = req.headers.get('upgrade');
  if (upgrade !== 'websocket') {
    return new Response('Expected websocket', { status: 426 });
  }
  
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  socket.onopen = () => startVoiceSession(socket);
  socket.onmessage = (e) => handleAudioChunk(socket, e.data);
  socket.onclose = () => endVoiceSession(socket);
  
  return response;
}
```

**Expected Improvement:** Claude TTFB 3.3s → < 1s (2.3s faster)

**Risk:** Medium - Edge runtime has different APIs than Node.js

---

### **Phase 3: Streaming TTS (1 week)**

**Deliverables:**
1. Integrate PlayHT Realtime 2.0 or ElevenLabs Realtime
2. Stream TTS output directly from Claude tokens
3. Client-side AudioWorklet for buffer-free playback

**New Service:**
```typescript
// src/services/realtimeTTSService.ts
export class RealtimeTTSService {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext;
  
  async streamText(text: string): Promise<void> {
    this.ws = new WebSocket('wss://api.play.ht/v2/stream');
    this.ws.onmessage = (event) => {
      const audioChunk = event.data; // Raw PCM audio
      this.audioContext.decodeAudioData(audioChunk, (buffer) => {
        this.playImmediately(buffer); // No queue, play instantly
      });
    };
    
    this.ws.send(JSON.stringify({ text, voice: 'nova' }));
  }
}
```

**Expected Improvement:** TTS 2s → 0.4s (1.6s faster)

**Risk:** Low - PlayHT/ElevenLabs have production-ready streaming

---

### **Phase 4: Session Tracking & Cost Logging (1 week)**

**Deliverables:**
1. Supabase `voice_sessions` table
2. Real-time token counting
3. Cost calculation per session

**Database Migration:**
```sql
-- supabase/migrations/20250115_voice_sessions.sql
CREATE TABLE voice_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  
  -- Usage metrics
  stt_duration_seconds numeric DEFAULT 0,
  llm_input_tokens int DEFAULT 0,
  llm_output_tokens int DEFAULT 0,
  tts_characters int DEFAULT 0,
  
  -- Model info
  stt_model text DEFAULT 'deepgram-nova-2',
  llm_model text DEFAULT 'claude-3.5-sonnet',
  tts_model text DEFAULT 'playht-2.0',
  
  -- Cost (USD)
  cost_usd numeric GENERATED ALWAYS AS (
    (stt_duration_seconds / 60 * 0.0125) + -- Deepgram: $0.0125/min
    (llm_input_tokens / 1000000.0 * 3) +   -- Claude Sonnet in: $3/M
    (llm_output_tokens / 1000000.0 * 15) + -- Claude Sonnet out: $15/M
    (tts_characters / 1000.0 * 0.030)      -- PlayHT: $0.030/1K chars
  ) STORED,
  
  -- Metadata
  avg_latency_ms int,
  interruptions_count int DEFAULT 0,
  
  CONSTRAINT voice_sessions_ended_check CHECK (ended_at IS NULL OR ended_at > started_at)
);

-- Index for cost analytics
CREATE INDEX idx_voice_sessions_cost ON voice_sessions(user_id, created_at DESC, cost_usd);
```

**Service Layer:**
```typescript
// lib/voiceSessionService.ts
export async function startVoiceSession(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('voice_sessions')
    .insert({ user_id: userId })
    .select('id')
    .single();
    
  return data.id;
}

export async function updateSessionUsage(
  sessionId: string,
  metrics: { stt?: number; llm_in?: number; llm_out?: number; tts?: number }
): Promise<void> {
  await supabase
    .from('voice_sessions')
    .update({
      stt_duration_seconds: metrics.stt,
      llm_input_tokens: metrics.llm_in,
      llm_output_tokens: metrics.llm_out,
      tts_characters: metrics.tts,
    })
    .eq('id', sessionId);
}
```

**Risk:** Low - Standard Supabase operations

---

## 🚀 Deployment Strategy

### **Infrastructure Migration:**
1. **Keep V1 running** on Railway (`/api/voice-call`)
2. **Deploy V2** on Vercel Edge (`/api/voice-v2`)
3. **Feature flag** in UI: `VITE_VOICE_V2_ENABLED=true`
4. **A/B test** with 10% of Studio users

### **Rollout Plan:**
- **Week 1-2**: Deploy V2 to staging, test with internal users
- **Week 3**: Enable for 10% Studio users (A/B test)
- **Week 4**: Analyze metrics (latency, cost, satisfaction)
- **Week 5**: Roll out to 50% if metrics are positive
- **Week 6**: Migrate all users to V2, deprecate V1

### **Rollback Plan:**
- Keep V1 code in codebase for 3 months
- If V2 latency > V1 latency, instant rollback via feature flag
- Monitor error rates (target: < 1% call failure)

---

## 💰 Cost Analysis

### **V1 Cost (per 10-minute call):**
- STT (Deepgram): 10 min × $0.0125/min = **$0.125**
- Claude Sonnet: ~5K tokens × $15/M = **$0.075**
- TTS (OpenAI): ~1.5K chars × $0.030/K = **$0.045**
- **Total: $0.245 per call**

### **V2 Cost (per 10-minute call):**
- STT (Deepgram Streaming): 10 min × $0.0125/min = **$0.125** (same)
- Claude Sonnet: ~5K tokens × $15/M = **$0.075** (same)
- TTS (PlayHT Realtime): ~1.5K chars × $0.030/K = **$0.045** (same)
- **Total: $0.245 per call** (no increase!)

### **Monthly Cost (500 Studio users, 10 calls each):**
- 500 users × 10 calls × $0.245 = **$1,225/month**
- Revenue: 500 users × $189.99 = **$94,995/month**
- **Profit Margin: 98.7%** (API costs only)

**Verdict:** V2 latency improvements come at **zero cost increase** ✅

---

## 🎯 Success Metrics

### **Technical KPIs:**
- **Average latency:** < 2.5 seconds (current: 8.4s)
- **P95 latency:** < 4 seconds
- **Call success rate:** > 99%
- **Transcription accuracy:** > 90% (confidence > 0.9)

### **User Experience:**
- **User satisfaction:** > 85% "satisfied" or "very satisfied"
- **Repeat usage:** > 60% use voice calls 2+ times/week
- **Churn impact:** < 2% attribute to voice feature

### **Business Goals:**
- **Studio conversion:** Voice calls drive 20%+ of Free→Studio upgrades
- **Retention:** Studio users with voice calls have 30%+ lower churn
- **Differentiation:** #1 cited feature in Studio user surveys

---

## 🛡️ Risk Mitigation

### **Risk 1: Edge Function Cold Starts**
**Mitigation:** 
- Use Fly.io "always-on" instances ($5/month)
- OR Vercel Edge with keepalive

### **Risk 2: WebSocket Connection Drops**
**Mitigation:**
- Auto-reconnect with exponential backoff
- Buffer last 5s of audio for replay on reconnect
- Show "Reconnecting..." UI state

### **Risk 3: Cost Overruns**
**Mitigation:**
- Hard daily cap: 500 calls/day per Studio user (500 × $0.245 = $122.50/day)
- Alert if monthly API spend > $5,000
- Throttle if suspicious usage patterns detected

---

## 📚 Research & References

### **Similar Implementations:**
1. **ChatGPT Voice** - WebRTC + Whisper Streaming + GPT-4 Realtime
2. **Claude Voice (App)** - Similar stack (Deepgram + Claude + PlayHT)
3. **Pi AI** - Inflection's low-latency voice chat

### **Key Technologies:**
- [Deepgram Streaming API](https://developers.deepgram.com/docs/streaming)
- [PlayHT Realtime 2.0](https://docs.play.ht/reference/api-realtime-text-to-speech)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [Fly.io Global Apps](https://fly.io/docs/reference/regions/)

---

## 🗓️ Timeline

| Phase | Duration | Completion Date | Status |
|-------|----------|-----------------|--------|
| V1 Beta Ship | 1 week | Nov 1, 2024 | ⏳ In Progress |
| Phase 1: Deepgram Stream | 1 week | Nov 8, 2024 | 📋 Planned |
| Phase 2: Edge Function | 2 weeks | Nov 22, 2024 | 📋 Planned |
| Phase 3: Streaming TTS | 1 week | Nov 29, 2024 | 📋 Planned |
| Phase 4: Session Tracking | 1 week | Dec 6, 2024 | 📋 Planned |
| Internal Testing | 2 weeks | Dec 20, 2024 | 📋 Planned |
| A/B Test (10%) | 2 weeks | Jan 3, 2025 | 📋 Planned |
| Full Rollout | 1 week | Jan 10, 2025 | 📋 Planned |
| **V2 Launch** | - | **Q1 2025** | 🎯 Target |

---

## ✅ Pre-Launch Checklist

### **Before Starting V2:**
- [ ] V1 shipped with Beta label
- [ ] 50+ Studio voice calls logged
- [ ] User feedback collected
- [ ] Deepgram API limits confirmed (500 concurrent streams)
- [ ] Vercel Edge Function tested in staging
- [ ] Cost monitoring dashboard created

### **Before V2 Launch:**
- [ ] Latency < 2.5s in 95% of test calls
- [ ] Transcription accuracy > 90%
- [ ] Edge function deployed to 10+ global regions
- [ ] Rollback plan tested
- [ ] Documentation updated
- [ ] Support team trained on V2 differences

---

**Status:** Planned for Q1 2025  
**Owner:** Engineering Team  
**Next Review:** After V1 Beta ships  
**Last Updated:** October 26, 2024

