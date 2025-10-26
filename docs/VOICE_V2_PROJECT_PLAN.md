# Atlas Voice V2 - Project Plan

**Goal:** ChatGPT-level voice conversation (< 2s response time)  
**Timeline:** 6-8 weeks  
**Start Date:** October 27, 2024  
**Target Launch:** December 15, 2024

---

## 📊 Success Criteria

### **Performance Targets:**
- ✅ Average latency: < 2.5 seconds (P50)
- ✅ P95 latency: < 4 seconds
- ✅ STT: < 0.5 seconds (streaming)
- ✅ Claude TTFB: < 1 second
- ✅ TTS: < 0.5 seconds (streaming)

### **Quality Targets:**
- ✅ Transcription accuracy: > 90%
- ✅ Call success rate: > 99%
- ✅ User satisfaction: > 85%
- ✅ Zero "feels cheap" feedback

### **Business Targets:**
- ✅ Voice calls drive 20% of Free→Studio upgrades
- ✅ Studio retention +30% with voice usage
- ✅ API costs < $0.30 per 10-min call

---

## 🏗️ Architecture Overview

### **V1 (Current - Don't Ship)**
```
Client → Railway REST → Deepgram REST → Claude HTTP → OpenAI TTS
⏱️ Total: 31 seconds (unshippable)
```

### **V2 (Target)**
```
Client ←→ Vercel Edge WebSocket ←→ Streaming APIs
         ↓                              ↓
   Audio chunks (100ms)        Deepgram Stream
         ↓                              ↓
   Progressive TTS            Claude Realtime
         ↓                              ↓
   AudioWorklet              PlayHT Stream
⏱️ Total: < 2 seconds (ChatGPT quality)
```

---

## 📅 Week-by-Week Plan

### **Week 1: Foundation (Nov 1-8)**
**Goal:** Set up V2 infrastructure

**Tasks:**
- [ ] Create `/api/voice-v2` directory structure
- [ ] Set up Vercel Edge Function for WebSockets
- [ ] Implement session manager (in-memory)
- [ ] Create WebSocket protocol spec
- [ ] Set up development environment

**Deliverables:**
- Working WebSocket connection (client ←→ Edge)
- Basic echo test (send audio, receive confirmation)
- Session tracking (start, end, metadata)

**Success Metric:** WebSocket stays open for 10+ minutes

---

### **Week 2: Deepgram Streaming (Nov 9-15)**
**Goal:** Replace REST with streaming STT

**Tasks:**
- [ ] Integrate Deepgram Streaming API
- [ ] Implement audio chunk buffering (100ms chunks)
- [ ] Handle partial transcripts
- [ ] Add final transcript detection
- [ ] Error handling & reconnection

**Deliverables:**
- Audio → Deepgram Stream → Transcript
- Real-time partial transcripts
- < 0.5s STT latency

**Success Metric:** STT latency < 500ms (90% of tests)

---

### **Week 3: Claude Integration (Nov 16-22)**
**Goal:** Connect Claude streaming to Edge Function

**Tasks:**
- [ ] Proxy Claude API through Edge Function
- [ ] Implement streaming response handling
- [ ] Add conversation context management
- [ ] Optimize for voice (shorter responses)
- [ ] Rate limiting & error handling

**Deliverables:**
- Transcript → Claude → Streaming response
- Context window management (last 10 messages)
- < 1s Claude TTFB

**Success Metric:** Claude TTFB < 1s (90% of tests)

---

### **Week 4: Streaming TTS (Nov 23-29)**
**Goal:** Replace sequential TTS with streaming

**Tasks:**
- [ ] Evaluate PlayHT Realtime 2.0 vs ElevenLabs V2
- [ ] Implement streaming TTS client
- [ ] AudioWorklet for buffer-free playback
- [ ] Sentence-by-sentence generation
- [ ] Audio queue management

**Deliverables:**
- Claude tokens → TTS stream → Audio playback
- No buffering/pauses between sentences
- < 0.5s TTS latency

**Success Metric:** First audio plays < 1s after Claude starts

---

### **Week 5: Session & Cost Tracking (Nov 30-Dec 6)**
**Goal:** Production-ready telemetry

**Tasks:**
- [ ] Create `voice_sessions` table
- [ ] Log STT/LLM/TTS usage per session
- [ ] Calculate costs per session
- [ ] Add performance metrics (latency breakdown)
- [ ] Create monitoring dashboard

**Deliverables:**
- Every session logged to database
- Real-time cost tracking
- Performance analytics
- Admin dashboard

**Success Metric:** 100% of sessions logged accurately

---

### **Week 6: Testing & Polish (Dec 7-13)**
**Goal:** Production-ready quality

**Tasks:**
- [ ] Load testing (100 concurrent calls)
- [ ] Error scenario testing (network drops, API failures)
- [ ] Cross-browser testing (Chrome, Safari, Firefox)
- [ ] Mobile testing (iOS, Android)
- [ ] Latency optimization

**Deliverables:**
- < 1% error rate under load
- Graceful degradation on network issues
- Works on all major browsers
- Mobile-optimized

**Success Metric:** 99%+ success rate in stress tests

---

### **Week 7: Beta Launch (Dec 14-20)**
**Goal:** Ship to 10% of Studio users

**Tasks:**
- [ ] Deploy V2 to production
- [ ] A/B test (10% get V2, 90% get no voice)
- [ ] Monitor metrics (latency, errors, satisfaction)
- [ ] Collect user feedback
- [ ] Fix critical issues

**Deliverables:**
- V2 live for 10% Studio users
- Real-time monitoring dashboard
- User feedback form
- Issue tracker

**Success Metric:** < 5% of users report issues

---

### **Week 8: Full Rollout (Dec 21-27)**
**Goal:** Ship to 100% of Studio users

**Tasks:**
- [ ] Analyze Week 7 metrics
- [ ] Fix any remaining issues
- [ ] Scale to 50% Studio users
- [ ] Monitor for 3 days
- [ ] Roll out to 100%

**Deliverables:**
- V2 available to all Studio users
- V1 code deprecated
- Marketing announcement
- User guide

**Success Metric:** 85%+ user satisfaction

---

## 🛠️ Technical Implementation

### **Phase 1: WebSocket Infrastructure**

#### **Client Side** (`src/services/voiceCallServiceV2.ts`)
```typescript
export class VoiceCallServiceV2 {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private sessionId: string | null = null;

  async startCall(options: VoiceCallOptions): Promise<void> {
    // 1. Connect to Edge Function WebSocket
    this.ws = new WebSocket('wss://atlas.app/api/voice-v2');
    
    // 2. Start audio capture (16 kHz PCM)
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true 
      } 
    });
    
    // 3. Send audio chunks every 100ms
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(stream);
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      const audioData = e.inputBuffer.getChannelData(0);
      this.ws?.send(audioData.buffer); // Send raw PCM
    };
    
    source.connect(processor);
    processor.connect(this.audioContext.destination);
    
    // 4. Handle incoming messages
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'partial_transcript':
          options.onPartialTranscript(data.text);
          break;
        case 'final_transcript':
          options.onFinalTranscript(data.text);
          break;
        case 'audio_chunk':
          this.playAudioChunk(data.audio);
          break;
        case 'error':
          options.onError(new Error(data.message));
          break;
      }
    };
  }
  
  private playAudioChunk(audioBase64: string): void {
    // Use AudioWorklet for buffer-free playback
    const audioData = atob(audioBase64);
    const audioBuffer = new ArrayBuffer(audioData.length);
    const view = new Uint8Array(audioBuffer);
    
    for (let i = 0; i < audioData.length; i++) {
      view[i] = audioData.charCodeAt(i);
    }
    
    this.audioContext?.decodeAudioData(audioBuffer, (buffer) => {
      const source = this.audioContext!.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext!.destination);
      source.start();
    });
  }
}
```

#### **Edge Function** (`api/voice-v2/index.ts`)
```typescript
export const config = { runtime: 'edge' };

interface VoiceSession {
  userId: string;
  conversationId: string;
  deepgramWs: WebSocket | null;
  claudeStream: ReadableStream | null;
  ttsStream: WebSocket | null;
  startTime: Date;
  metrics: {
    sttDuration: number;
    llmInputTokens: number;
    llmOutputTokens: number;
    ttsCharacters: number;
  };
}

const activeSessions = new Map<string, VoiceSession>();

export default async function handler(req: Request) {
  const upgrade = req.headers.get('upgrade');
  if (upgrade !== 'websocket') {
    return new Response('Expected websocket', { status: 426 });
  }
  
  const { socket, response } = Deno.upgradeWebSocket(req);
  const sessionId = crypto.randomUUID();
  
  socket.onopen = () => {
    console.log(`[VoiceV2] Session ${sessionId} opened`);
  };
  
  socket.onmessage = async (event) => {
    // Handle incoming audio chunks
    if (event.data instanceof ArrayBuffer) {
      await handleAudioChunk(sessionId, event.data, socket);
    } else {
      // Handle control messages
      const message = JSON.parse(event.data);
      await handleControlMessage(sessionId, message, socket);
    }
  };
  
  socket.onclose = () => {
    console.log(`[VoiceV2] Session ${sessionId} closed`);
    cleanupSession(sessionId);
  };
  
  return response;
}

async function handleAudioChunk(
  sessionId: string,
  audioData: ArrayBuffer,
  clientSocket: WebSocket
): Promise<void> {
  let session = activeSessions.get(sessionId);
  
  // Initialize session if not exists
  if (!session) {
    session = await initializeSession(sessionId, clientSocket);
    activeSessions.set(sessionId, session);
  }
  
  // Send to Deepgram
  session.deepgramWs?.send(audioData);
}

async function initializeSession(
  sessionId: string,
  clientSocket: WebSocket
): Promise<VoiceSession> {
  const session: VoiceSession = {
    userId: '', // Get from auth
    conversationId: '',
    deepgramWs: null,
    claudeStream: null,
    ttsStream: null,
    startTime: new Date(),
    metrics: {
      sttDuration: 0,
      llmInputTokens: 0,
      llmOutputTokens: 0,
      ttsCharacters: 0,
    },
  };
  
  // 1. Connect to Deepgram Streaming
  session.deepgramWs = new WebSocket(
    'wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000'
  );
  
  session.deepgramWs.onmessage = async (event) => {
    const data = JSON.parse(event.data);
    
    if (data.is_final) {
      const transcript = data.channel.alternatives[0].transcript;
      
      // Send final transcript to client
      clientSocket.send(JSON.stringify({
        type: 'final_transcript',
        text: transcript,
      }));
      
      // Send to Claude
      await processWithClaude(sessionId, transcript, clientSocket);
    } else {
      // Send partial transcript to client
      clientSocket.send(JSON.stringify({
        type: 'partial_transcript',
        text: data.channel.alternatives[0].transcript,
      }));
    }
  };
  
  return session;
}

async function processWithClaude(
  sessionId: string,
  transcript: string,
  clientSocket: WebSocket
): Promise<void> {
  const session = activeSessions.get(sessionId)!;
  
  // Call Claude streaming API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      stream: true,
      messages: [{ role: 'user', content: transcript }],
    }),
  });
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let currentSentence = '';
  
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.delta?.text) {
            const text = data.delta.text;
            fullResponse += text;
            currentSentence += text;
            
            // Check for sentence boundaries
            if (/[.!?]\s/.test(currentSentence)) {
              await sendToTTS(sessionId, currentSentence, clientSocket);
              currentSentence = '';
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }
  
  // Send remaining sentence
  if (currentSentence.trim()) {
    await sendToTTS(sessionId, currentSentence, clientSocket);
  }
}

async function sendToTTS(
  sessionId: string,
  text: string,
  clientSocket: WebSocket
): Promise<void> {
  // Call PlayHT Realtime API
  const response = await fetch('https://api.play.ht/api/v2/tts/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('PLAYHT_API_KEY')}`,
    },
    body: JSON.stringify({
      text,
      voice: 'nova',
      output_format: 'mp3',
      speed: 1.05,
    }),
  });
  
  const reader = response.body?.getReader();
  
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    
    // Send audio chunk to client
    const base64Audio = btoa(String.fromCharCode(...value));
    clientSocket.send(JSON.stringify({
      type: 'audio_chunk',
      audio: base64Audio,
    }));
  }
}

async function cleanupSession(sessionId: string): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  
  // Close connections
  session.deepgramWs?.close();
  
  // Save session to database
  await fetch('https://rbwabemtucdkytvvpzvk.supabase.co/rest/v1/voice_sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': Deno.env.get('SUPABASE_ANON_KEY')!,
    },
    body: JSON.stringify({
      user_id: session.userId,
      started_at: session.startTime.toISOString(),
      ended_at: new Date().toISOString(),
      ...session.metrics,
    }),
  });
  
  activeSessions.delete(sessionId);
}
```

---

## 💰 Cost Breakdown

### **Per 10-Minute Call:**
- **Deepgram Streaming:** 10 min × $0.0125/min = **$0.125**
- **Claude Haiku:** ~5K tokens × $1.5/M = **$0.0075**
- **PlayHT Realtime:** ~1.5K chars × $0.030/K = **$0.045**
- **Total:** **$0.178 per call** (27% cheaper than V1!)

### **Monthly (500 Studio users, 10 calls each):**
- 500 users × 10 calls × $0.178 = **$890/month**
- Revenue: 500 × $189.99 = **$94,995**
- **Profit Margin: 99.1%**

---

## 🎯 Development Priorities

### **Must-Have (P0):**
- ✅ WebSocket connection (client ←→ Edge)
- ✅ Deepgram Streaming integration
- ✅ Claude streaming proxy
- ✅ Streaming TTS (PlayHT or ElevenLabs)
- ✅ Session tracking & cost logging
- ✅ Error handling & reconnection

### **Should-Have (P1):**
- ✅ Partial transcript display
- ✅ Audio level visualization
- ✅ Interruption support (speak while Atlas talks)
- ✅ Mobile optimization
- ✅ Performance monitoring

### **Nice-to-Have (P2):**
- ⏸️ Call history & replays
- ⏸️ Voice customization (speed, pitch)
- ⏸️ Multi-language support
- ⏸️ Emotion detection

---

## 🚀 Next Steps

### **This Week (Oct 27-Nov 3):**
1. **Remove V1 voice call button** from production
2. **Set up V2 project structure** (`/api/voice-v2`)
3. **Install dependencies** (PlayHT SDK, Deepgram SDK)
4. **Create basic WebSocket echo test**
5. **Update project board** with Week 1 tasks

### **Kickoff Meeting:**
- Review this plan
- Assign tasks
- Set up daily standups
- Create Slack channel (#voice-v2)

---

**Status:** Ready to start  
**Owner:** Engineering Team  
**Stakeholder:** Jason (Product)  
**Last Updated:** October 26, 2024, 8:30 PM

