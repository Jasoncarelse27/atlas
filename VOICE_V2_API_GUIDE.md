# 🎙️ Voice V2 API - Complete Guide

**Status:** ✅ All API keys configured in `.env`  
**Location:** `api/voice-v2/`  
**Protocol:** WebSocket (real-time bidirectional)

---

## 📋 Table of Contents

1. [Check Fly.io Deployment Status](#1-check-flyio-deployment-status)
2. [Test Locally](#2-test-locally)
3. [API Documentation](#3-api-documentation)

---

## 1. Check Fly.io Deployment Status

### Health Check

```bash
# Check if Voice V2 is deployed on Fly.io
curl https://atlas-voice-v2.fly.dev/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "activeSessions": 0,
  "uptime": 1234.56,
  "timestamp": "2025-11-01T09:20:00.000Z"
}
```

### Check Deployment Status

```bash
# From your project root
cd api/voice-v2
flyctl status
```

**If not deployed yet:**
```bash
# Deploy to Fly.io
flyctl deploy
```

---

## 2. Test Locally

### Prerequisites

✅ All API keys in `.env`:
- `ANTHROPIC_API_KEY` ✅
- `OPENAI_API_KEY` ✅  
- `DEEPGRAM_API_KEY` ✅

### Step 1: Install Dependencies

```bash
cd api/voice-v2
npm install
```

### Step 2: Start Local Server

```bash
# Start the local development server
node local-server.mjs
```

**Expected Output:**
```
[VoiceV2 Local] 🚀 Starting WebSocket server on port 3001...
[VoiceV2 Local] ✅ WebSocket server running on ws://localhost:3001
[VoiceV2 Local] 🎤 Deepgram STT enabled (Nova-2 model)
[VoiceV2 Local] 🤖 Claude AI enabled (Haiku 3.5 - fastest)
[VoiceV2 Local] 🔊 OpenAI TTS enabled (TTS-1-HD, voice: nova)
[VoiceV2 Local] 📝 Full voice conversation ready!
```

### Step 3: Test with Browser

Open `public/voice-v2-test.html` in your browser, or use this simple test:

**HTML Test Page (`test-voice-v2.html`):**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Voice V2 Test</title>
</head>
<body>
    <h1>🎙️ Voice V2 Test</h1>
    <button id="connectBtn">Connect</button>
    <button id="startBtn" disabled>Start Audio</button>
    <button id="stopBtn" disabled>Stop Audio</button>
    <div id="status">Disconnected</div>
    <div id="transcript"></div>

    <script>
        let ws = null;
        let stream = null;
        let audioContext = null;

        document.getElementById('connectBtn').onclick = () => {
            ws = new WebSocket('ws://localhost:3001');
            
            ws.onopen = () => {
                document.getElementById('status').textContent = 'Connected';
                document.getElementById('connectBtn').disabled = true;
                document.getElementById('startBtn').disabled = false;
                
                // Authenticate session
                ws.send(JSON.stringify({
                    type: 'session_start',
                    authToken: 'your-supabase-jwt-token-here', // Replace with real token
                    userId: 'test-user-id',
                    conversationId: 'test-conversation-id'
                }));
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('Received:', data);
                
                if (data.type === 'partial_transcript') {
                    document.getElementById('transcript').textContent = data.text;
                } else if (data.type === 'final_transcript') {
                    document.getElementById('transcript').textContent = data.text;
                } else if (data.type === 'audio_chunk') {
                    // Play audio response
                    playAudio(data.audio);
                }
            };
        };

        document.getElementById('startBtn').onclick = async () => {
            stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { sampleRate: 16000, channelCount: 1 } 
            });
            
            audioContext = new AudioContext({ sampleRate: 16000 });
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    const audioData = e.inputBuffer.getChannelData(0);
                    const buffer = new Int16Array(audioData.length);
                    for (let i = 0; i < audioData.length; i++) {
                        buffer[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
                    }
                    ws.send(buffer.buffer);
                }
            };
            
            source.connect(processor);
            processor.connect(audioContext.destination);
            
            document.getElementById('startBtn').disabled = true;
            document.getElementById('stopBtn').disabled = false;
        };

        document.getElementById('stopBtn').onclick = () => {
            if (stream) stream.getTracks().forEach(track => track.stop());
            if (audioContext) audioContext.close();
            document.getElementById('startBtn').disabled = false;
            document.getElementById('stopBtn').disabled = true;
        };

        function playAudio(base64Audio) {
            const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
            audio.play();
        }
    </script>
</body>
</html>
```

### Step 4: Test Health Endpoint

```bash
# In another terminal
curl http://localhost:3001/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "activeSessions": 0,
  "uptime": 45.23,
  "timestamp": "2025-11-01T09:20:00.000Z"
}
```

---

## 3. API Documentation

### WebSocket Endpoint

**Production (Fly.io):**
```
wss://atlas-voice-v2.fly.dev
```

**Local Development:**
```
ws://localhost:3001
```

---

### Connection Flow

1. **Connect** → WebSocket connection opens
2. **Authenticate** → Send `session_start` with JWT token
3. **Send Audio** → Stream binary PCM audio data (16kHz, mono)
4. **Receive** → Get transcripts and audio responses

---

### Message Types

#### **Client → Server**

##### 1. `session_start` (Authentication)
```json
{
  "type": "session_start",
  "authToken": "supabase-jwt-token",
  "userId": "user-uuid",
  "conversationId": "conversation-uuid"
}
```

**Response:**
```json
{
  "type": "session_started",
  "sessionId": "session-uuid",
  "message": "Session authenticated and started"
}
```

##### 2. Binary Audio Data
- **Format:** Int16 PCM, 16kHz, mono
- **Chunk Size:** ~4096 samples (~256ms)
- **Send:** Raw binary buffer via `ws.send(audioBuffer)`

##### 3. `session_end`
```json
{
  "type": "session_end",
  "sessionId": "session-uuid"
}
```

---

#### **Server → Client**

##### 1. `connected` (On WebSocket open)
```json
{
  "type": "connected",
  "sessionId": "session-uuid",
  "message": "Voice V2 WebSocket connected",
  "timestamp": "2025-11-01T09:20:00.000Z"
}
```

##### 2. `partial_transcript` (Real-time STT)
```json
{
  "type": "partial_transcript",
  "text": "Hello, how are",
  "confidence": 0.95,
  "sessionId": "session-uuid",
  "timestamp": "2025-11-01T09:20:00.000Z"
}
```

##### 3. `final_transcript` (Final STT result)
```json
{
  "type": "final_transcript",
  "text": "Hello, how are you?",
  "confidence": 0.98,
  "sessionId": "session-uuid",
  "timestamp": "2025-11-01T09:20:00.000Z"
}
```

##### 4. `audio_chunk` (TTS response)
```json
{
  "type": "audio_chunk",
  "audio": "base64-encoded-mpeg-audio",
  "sessionId": "session-uuid",
  "timestamp": "2025-11-01T09:20:00.000Z"
}
```

##### 5. `audio_received` (Acknowledgment)
```json
{
  "type": "audio_received",
  "sessionId": "session-uuid",
  "size": 4096,
  "totalChunks": 10,
  "timestamp": "2025-11-01T09:20:00.000Z"
}
```

##### 6. `error`
```json
{
  "type": "error",
  "message": "Error description",
  "code": "ERROR_CODE",
  "sessionId": "session-uuid",
  "timestamp": "2025-11-01T09:20:00.000Z"
}
```

**Error Codes:**
- `AUTH_REQUIRED` - Need to send `session_start` first
- `AUTH_INVALID` - Invalid or expired JWT token
- `RATE_LIMIT_EXCEEDED` - Too many concurrent sessions
- `STT_ERROR` - Deepgram transcription error
- `LLM_ERROR` - Claude AI error
- `TTS_ERROR` - OpenAI TTS error

---

### Audio Configuration

**Required Format:**
- **Sample Rate:** 16000 Hz
- **Channels:** 1 (mono)
- **Encoding:** Linear16 PCM (Int16)
- **Chunk Size:** 4096 samples (~256ms)

**JavaScript Example:**
```javascript
const audioContext = new AudioContext({ sampleRate: 16000 });
const source = audioContext.createMediaStreamSource(stream);
const processor = audioContext.createScriptProcessor(4096, 1, 1);

processor.onaudioprocess = (e) => {
    const audioData = e.inputBuffer.getChannelData(0);
    const buffer = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
        buffer[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
    }
    ws.send(buffer.buffer);
};
```

---

### Rate Limits

- **Max Concurrent Sessions:** 3 per user
- **Max Session Duration:** 30 minutes
- **Max Cost Per Session:** $5.00

---

### Cost Tracking

The server tracks costs per session:
- **Deepgram STT:** $0.0043/minute
- **Claude Haiku:** $0.25/1M input tokens, $1.25/1M output tokens
- **OpenAI TTS:** $15.00/1M characters

---

### Security

1. **Authentication Required:** Must send valid Supabase JWT token
2. **Rate Limiting:** Max 3 concurrent sessions per user
3. **Session Validation:** User ID validated from JWT
4. **Cost Limits:** Sessions auto-terminate at $5 limit

---

## 🚀 Quick Start Example

```javascript
// 1. Connect
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = () => {
    // 2. Authenticate
    ws.send(JSON.stringify({
        type: 'session_start',
        authToken: 'your-jwt-token',
        userId: 'user-id',
        conversationId: 'conversation-id'
    }));
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'partial_transcript') {
        console.log('User said:', data.text);
    } else if (data.type === 'audio_chunk') {
        // Play AI response
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        audio.play();
    }
};

// 3. Send audio (after getting user media)
const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: { sampleRate: 16000, channelCount: 1 } 
});
// ... process and send audio chunks
```

---

## 📚 Related Files

- **Server:** `api/voice-v2/server.mjs` (Production)
- **Local Dev:** `api/voice-v2/local-server.mjs`
- **Client Service:** `src/services/voiceV2/voiceCallServiceV2.ts`
- **Test Page:** `public/voice-v2-test.html`

---

## ✅ Verification Checklist

- [ ] API keys in `.env` (✅ All 3 keys found)
- [ ] Local server starts (`node local-server.mjs`)
- [ ] Health endpoint responds (`curl http://localhost:3001/health`)
- [ ] WebSocket connects (`ws://localhost:3001`)
- [ ] Fly.io deployment (check `flyctl status`)

---

**Status:** ✅ Ready to test locally! All API keys configured.

