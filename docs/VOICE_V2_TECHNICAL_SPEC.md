# Atlas Voice V2 - Technical Specification

## 🎯 Overview

**Architecture:** WebSocket-based bidirectional streaming  
**Target Latency:** < 2 seconds end-to-end  
**Infrastructure:** Vercel Edge Functions + Streaming APIs

---

## 📡 WebSocket Protocol

### **Message Types (Client → Server)**

```typescript
// Start session
{
  type: 'session_start',
  userId: string,
  conversationId: string,
  authToken: string
}

// Audio chunk (raw PCM 16kHz mono)
ArrayBuffer

// Control messages
{
  type: 'mute' | 'unmute' | 'interrupt',
}
```

### **Message Types (Server → Client)**

```typescript
// Partial transcript (real-time)
{
  type: 'partial_transcript',
  text: string,
  confidence: number
}

// Final transcript
{
  type: 'final_transcript',
  text: string,
  confidence: number
}

// Audio chunk (base64-encoded MP3)
{
  type: 'audio_chunk',
  audio: string, // base64
  sentenceIndex: number
}

// Status updates
{
  type: 'status',
  status: 'listening' | 'transcribing' | 'thinking' | 'speaking'
}

// Errors
{
  type: 'error',
  code: string,
  message: string
}

// Session metrics (on close)
{
  type: 'session_end',
  sessionId: string,
  duration: number,
  metrics: {
    sttDuration: number,
    llmLatency: number,
    ttsLatency: number,
    totalLatency: number
  }
}
```

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │  Microphone  │──>│ AudioContext │──>│  WebSocket   │  │
│  └──────────────┘   └──────────────┘   └──────┬───────┘  │
│                                                 │           │
│  ┌──────────────┐   ┌──────────────┐          │           │
│  │   Speakers   │<──│ AudioWorklet │<─────────┘           │
│  └──────────────┘   └──────────────┘                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WSS (Secure WebSocket)
                              │
┌─────────────────────────────▼─────────────────────────────┐
│                    VERCEL EDGE FUNCTION                    │
│                     (/api/voice-v2)                        │
│                                                            │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │   Session    │──>│  Audio Queue │──>│   Metrics    │ │
│  │   Manager    │   │              │   │   Logger     │ │
│  └──────────────┘   └──────────────┘   └──────────────┘ │
│                                                            │
└────────┬───────────────┬───────────────┬──────────────────┘
         │               │               │
         │               │               │
    ┌────▼────┐     ┌────▼────┐    ┌────▼────┐
    │Deepgram │     │ Claude  │    │ PlayHT  │
    │Streaming│     │ Stream  │    │Realtime │
    │   STT   │     │   LLM   │    │   TTS   │
    └─────────┘     └─────────┘    └─────────┘
```

---

## 🔧 Component Specifications

### **1. Client-Side Audio Capture**

```typescript
// src/services/voiceV2/audioCapture.ts
export class AudioCaptureService {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  
  async start(onAudioChunk: (chunk: ArrayBuffer) => void): Promise<void> {
    // Request microphone with specific constraints
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,        // 16 kHz for Deepgram
        channelCount: 1,          // Mono
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    
    // Create audio context at 16 kHz
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.stream);
    
    // Process in 4096-sample chunks (256ms at 16kHz)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const audioData = e.inputBuffer.getChannelData(0);
      
      // Convert Float32Array to Int16Array (PCM)
      const pcm = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        const s = Math.max(-1, Math.min(1, audioData[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      onAudioChunk(pcm.buffer);
    };
    
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }
  
  stop(): void {
    this.processor?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
  }
}
```

### **2. Client-Side Audio Playback**

```typescript
// src/services/voiceV2/audioPlayback.ts
export class AudioPlaybackService {
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying: boolean = false;
  
  async initialize(): Promise<void> {
    this.audioContext = new AudioContext();
  }
  
  async addAudioChunk(base64Audio: string): Promise<void> {
    if (!this.audioContext) throw new Error('Not initialized');
    
    // Decode base64 to ArrayBuffer
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Decode audio data
    const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
    this.audioQueue.push(audioBuffer);
    
    if (!this.isPlaying) {
      this.playQueue();
    }
  }
  
  private playQueue(): void {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }
    
    this.isPlaying = true;
    const buffer = this.audioQueue.shift()!;
    
    const source = this.audioContext!.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext!.destination);
    
    source.onended = () => {
      this.playQueue(); // Play next chunk
    };
    
    source.start();
  }
  
  interrupt(): void {
    // Clear queue and stop current playback
    this.audioQueue = [];
    this.audioContext?.close().then(() => {
      this.audioContext = new AudioContext();
    });
    this.isPlaying = false;
  }
}
```

### **3. Edge Function Session Manager**

```typescript
// api/voice-v2/sessionManager.ts
export interface VoiceSession {
  sessionId: string;
  userId: string;
  conversationId: string;
  
  // Connections
  deepgramWs: WebSocket | null;
  claudeAbort: AbortController | null;
  
  // State
  status: 'listening' | 'transcribing' | 'thinking' | 'speaking';
  startTime: Date;
  lastActivityTime: Date;
  
  // Metrics
  metrics: {
    sttDuration: number;
    sttRequests: number;
    llmInputTokens: number;
    llmOutputTokens: number;
    llmLatency: number;
    ttsCharacters: number;
    ttsLatency: number;
    totalLatency: number;
  };
  
  // Context
  conversationBuffer: Array<{ role: 'user' | 'assistant', content: string }>;
}

export class SessionManager {
  private sessions = new Map<string, VoiceSession>();
  
  create(sessionId: string, userId: string, conversationId: string): VoiceSession {
    const session: VoiceSession = {
      sessionId,
      userId,
      conversationId,
      deepgramWs: null,
      claudeAbort: null,
      status: 'listening',
      startTime: new Date(),
      lastActivityTime: new Date(),
      metrics: {
        sttDuration: 0,
        sttRequests: 0,
        llmInputTokens: 0,
        llmOutputTokens: 0,
        llmLatency: 0,
        ttsCharacters: 0,
        ttsLatency: 0,
        totalLatency: 0,
      },
      conversationBuffer: [],
    };
    
    this.sessions.set(sessionId, session);
    return session;
  }
  
  get(sessionId: string): VoiceSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  delete(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.deepgramWs?.close();
      session.claudeAbort?.abort();
      this.sessions.delete(sessionId);
    }
  }
  
  // Auto-cleanup inactive sessions (>10 min)
  cleanupInactive(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      const inactive = now - session.lastActivityTime.getTime() > 600000;
      if (inactive) {
        this.delete(sessionId);
      }
    }
  }
}
```

---

## 🔌 API Integration Specs

### **Deepgram Streaming**

```typescript
// Connect to Deepgram WebSocket
const deepgramWs = new WebSocket(
  `wss://api.deepgram.com/v1/listen?` +
  `model=nova-2&` +
  `encoding=linear16&` +
  `sample_rate=16000&` +
  `channels=1&` +
  `interim_results=true&` +
  `punctuate=true&` +
  `utterances=true`,
  {
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`
    }
  }
);

// Send audio chunks
deepgramWs.send(audioChunk); // ArrayBuffer

// Receive transcripts
deepgramWs.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.is_final) {
    const transcript = data.channel.alternatives[0].transcript;
    const confidence = data.channel.alternatives[0].confidence;
    // Process final transcript
  } else {
    const partialTranscript = data.channel.alternatives[0].transcript;
    // Show partial transcript to user
  }
};
```

### **Claude Streaming**

```typescript
// Call Claude with streaming
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-3-haiku-20240307',
    max_tokens: 300,
    stream: true,
    system: `You're Atlas, a warm and emotionally intelligent AI companion.
Voice call guidelines:
- Speak naturally and conversationally
- Keep responses brief (2-3 sentences unless asked for detail)
- Use contractions (I'm, you're, let's)
- Show empathy through tone, not over-explanation`,
    messages: [
      ...conversationBuffer, // Last 10 messages for context
      { role: 'user', content: transcript }
    ]
  }),
  signal: abortController.signal,
});

// Parse SSE stream
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.type === 'content_block_delta') {
        const text = data.delta.text;
        // Process text chunk
      }
    }
  }
}
```

### **PlayHT Realtime**

```typescript
// Generate streaming TTS
const response = await fetch('https://api.play.ht/api/v2/tts/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${PLAYHT_API_KEY}`,
    'X-User-ID': PLAYHT_USER_ID,
  },
  body: JSON.stringify({
    text: sentence,
    voice: 's3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json', // Nova voice
    output_format: 'mp3',
    sample_rate: 24000,
    speed: 1.05, // Slightly faster for natural conversation
  }),
});

// Stream audio chunks
const reader = response.body.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  // Send audio chunk to client
  const base64Audio = btoa(String.fromCharCode(...value));
  clientSocket.send(JSON.stringify({
    type: 'audio_chunk',
    audio: base64Audio,
  }));
}
```

---

## 🗄️ Database Schema

```sql
-- Voice sessions table
CREATE TABLE voice_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  conversation_id uuid REFERENCES conversations(id),
  
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  
  -- Usage metrics
  stt_duration_seconds numeric DEFAULT 0,
  stt_requests int DEFAULT 0,
  llm_input_tokens int DEFAULT 0,
  llm_output_tokens int DEFAULT 0,
  llm_latency_ms int DEFAULT 0,
  tts_characters int DEFAULT 0,
  tts_latency_ms int DEFAULT 0,
  
  -- Model info
  stt_model text DEFAULT 'deepgram-nova-2',
  llm_model text DEFAULT 'claude-3-haiku',
  tts_model text DEFAULT 'playht-2.0',
  
  -- Cost (USD) - calculated
  cost_usd numeric GENERATED ALWAYS AS (
    (stt_duration_seconds / 60 * 0.0125) +      -- Deepgram: $0.0125/min
    (llm_input_tokens / 1000000.0 * 1.5) +      -- Haiku in: $1.5/M
    (llm_output_tokens / 1000000.0 * 7.5) +     -- Haiku out: $7.5/M
    (tts_characters / 1000.0 * 0.030)           -- PlayHT: $0.030/1K chars
  ) STORED,
  
  -- Performance
  avg_latency_ms int,
  p95_latency_ms int,
  interruptions_count int DEFAULT 0,
  errors_count int DEFAULT 0,
  
  -- Metadata
  user_agent text,
  ip_address inet,
  
  CONSTRAINT voice_sessions_ended_check CHECK (ended_at IS NULL OR ended_at > started_at)
);

-- Indexes for analytics
CREATE INDEX idx_voice_sessions_user_date ON voice_sessions(user_id, started_at DESC);
CREATE INDEX idx_voice_sessions_cost ON voice_sessions(cost_usd DESC);
CREATE INDEX idx_voice_sessions_latency ON voice_sessions(avg_latency_ms);

-- RLS policies
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON voice_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert sessions"
  ON voice_sessions FOR INSERT
  WITH CHECK (true); -- Edge Function has service role key
```

---

## 📊 Performance Monitoring

### **Metrics to Track:**

1. **Latency Breakdown:**
   - Time to first audio chunk (TTFA)
   - STT latency (per request)
   - Claude TTFB
   - TTS latency (per sentence)
   - End-to-end latency

2. **Quality Metrics:**
   - STT confidence scores
   - Audio quality (sample rate, bit rate)
   - Connection stability (drops, reconnections)

3. **Usage Metrics:**
   - Sessions per day
   - Average session duration
   - Total audio minutes processed
   - API costs per session

4. **Error Rates:**
   - WebSocket disconnections
   - STT failures
   - Claude timeouts
   - TTS failures

### **Alerting Thresholds:**

- P95 latency > 5 seconds → Page on-call
- Error rate > 5% → Alert Slack
- Cost per session > $0.50 → Alert finance
- Active sessions > 100 → Scale infrastructure

---

## 🚀 Deployment Strategy

### **Phase 1: Development (Week 1-5)**
- Deploy to `voice-v2-dev.atlas.app`
- Internal testing only
- Feature flag: `VITE_VOICE_V2_ENABLED=false`

### **Phase 2: Staging (Week 6)**
- Deploy to `voice-v2-staging.atlas.app`
- Beta testers (10 users)
- Monitor for 1 week

### **Phase 3: Canary (Week 7)**
- Deploy to production
- Enable for 10% of Studio users
- Monitor for 3 days

### **Phase 4: Full Rollout (Week 8)**
- Gradually increase to 50%, 100%
- Deprecate V1 code
- Marketing announcement

---

**Status:** Specification complete  
**Next:** Begin Week 1 implementation  
**Last Updated:** October 26, 2024

