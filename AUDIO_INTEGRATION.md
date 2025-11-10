# 🎙️ Atlas Audio Integration Guide

## ✅ What's Been Implemented

### Backend (`backend/server.mjs`)
- ✅ OpenAI Whisper integration for speech-to-text (STT)
- ✅ OpenAI TTS integration for text-to-speech (TTS)
- ✅ `/api/transcribe` endpoint with tier enforcement
- ✅ `/api/synthesize` endpoint with tier enforcement
- ✅ Audio usage tracking (minutes per month)
- ✅ Automatic tier restriction (Free users blocked, Core/Studio allowed)
- ✅ Tier-based voice quality: Core (tts-1/alloy) vs Studio (tts-1-hd/nova)

### Frontend (`src/services/voiceService.ts`)
- ✅ `recordAndTranscribe()` with tier checking
- ✅ `synthesizeSpeech()` for converting AI responses to voice
- ✅ `playAudio()` for playing TTS audio
- ✅ JWT authentication for all audio API calls
- ✅ Graceful error handling with upgrade prompts

### Tier Enforcement
- **Free Tier**: ❌ No audio features (blocked at both frontend and backend)
- **Core Tier**: ✅ 60 minutes/month audio (tracked in `usage_stats.audio_minutes_used`)
- **Studio Tier**: ✅ Unlimited audio

---

## 📋 Setup Instructions

### 1. Get API Key

#### OpenAI (for both Whisper STT and TTS)
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (starts with `sk-proj-...` or `sk-...`)

### 2. Add Key to `.env`

```bash
# Add this line to your .env file (just ONE key needed!):
OPENAI_API_KEY=sk-...
```

### 3. Restart Backend

```bash
npm run backend
```

You should see:
```
🔑 API Keys Status:
  Claude/Anthropic: ✅ Available
  OpenAI (Whisper + TTS): ✅ Available
```

---

## 🎯 How to Use Audio Features

### Example 1: Voice Input (STT)

```typescript
import { voiceService } from '@/services/voiceService';

// Record audio and transcribe
const handleVoiceInput = async (audioBlob: Blob, userTier: 'free' | 'core' | 'studio') => {
  try {
    const transcript = await voiceService.recordAndTranscribe(audioBlob, userTier);
    console.log('User said:', transcript);
    // Use transcript for chat message
  } catch (error) {
    if (error.message.includes('requires Core or Studio')) {
      // Show upgrade prompt
      showUpgradeModal();
    }
  }
};
```

### Example 2: Voice Output (TTS)

```typescript
import { voiceService } from '@/services/voiceService';

// Convert AI response to speech and play it
const handleAIResponse = async (aiText: string) => {
  try {
    // Synthesize speech (voice auto-selected by tier: alloy for Core, nova for Studio)
    const audioUrl = await voiceService.synthesizeSpeech(aiText);
    
    // Play audio
    await voiceService.playAudio(audioUrl);
    
    console.log('✅ AI response played');
  } catch (error) {
    console.error('TTS failed:', error);
  }
};
```

### Example 3: Full Voice Conversation Flow

```typescript
// Complete voice conversation (STT → Claude → TTS)
const handleVoiceMessage = async (audioBlob: Blob, userTier: string) => {
  try {
    // 1. Transcribe user's voice
    const userMessage = await voiceService.recordAndTranscribe(audioBlob, userTier);
    
    // 2. Send to Claude for AI response
    const aiResponse = await chatService.sendMessage(userMessage);
    
    // 3. Convert AI response to speech
    const audioUrl = await voiceService.synthesizeSpeech(aiResponse);
    
    // 4. Play AI voice response
    await voiceService.playAudio(audioUrl);
    
  } catch (error) {
    console.error('Voice conversation failed:', error);
  }
};
```

---

## 🧪 Testing

### Test with Core Tier User

1. In Supabase, update your user profile:
```sql
UPDATE profiles
SET subscription_tier = 'core'
WHERE id = 'your-user-id';
```

2. Try recording voice in the chat
3. Backend should log:
```
🎙️ [Transcribe] Processing audio for user ... (tier: core)
✅ [Transcribe] Transcription complete: "..."
```

4. AI response should trigger TTS:
```
🔊 [Synthesize] Generating speech for user ... (tier: core)
✅ [Synthesize] Audio generated: ... bytes
```

### Test with Free Tier User

1. Update profile to `free`:
```sql
UPDATE profiles
SET subscription_tier = 'free'
WHERE id = 'your-user-id';
```

2. Try recording voice
3. Should see error:
```
🚫 [Transcribe] Free user ... attempted to use audio - blocked
```

---

## 🎤 Available Voices (OpenAI TTS)

Voices are automatically selected by tier:

**Core Tier** (`tts-1`):
- **alloy**: Neutral, balanced voice (default)

**Studio Tier** (`tts-1-hd`):
- **nova**: Warm, expressive female voice (default)

Other available OpenAI voices you can configure:
- **echo**: Male voice
- **fable**: British accent
- **onyx**: Deep male voice
- **shimmer**: Soft female voice

To customize voices, edit the backend `server.mjs` line 1448:
```javascript
const voice = tier === 'studio' ? 'nova' : 'alloy';
```

---

## 📊 Audio Usage Tracking

Audio usage is tracked in `profiles.usage_stats.audio_minutes_used`:

```sql
-- Check user's audio usage
SELECT 
  id,
  subscription_tier,
  usage_stats->>'audio_minutes_used' as audio_minutes
FROM profiles
WHERE id = 'your-user-id';
```

**Core Tier Limits**: 60 minutes/month
**Studio Tier**: Unlimited

The backend automatically increments usage on each transcription.

---

## 🔧 Troubleshooting

### "Audio transcription service unavailable" or "Speech synthesis failed"
- Check if `OPENAI_API_KEY` is set in `.env`
- Restart backend: `npm run backend`
- Verify OpenAI account has credits/billing enabled

### "Audio transcription requires Core or Studio tier"
- This is expected for Free users
- Implement upgrade flow in UI

### Transcription takes too long
- Whisper-1 typically processes 1 minute of audio in ~5 seconds
- Check network connectivity
- Ensure audio file is not corrupted

---

## 🚀 Next Steps (Optional Enhancements)

### 1. Add "Call Atlas" Button to Chat
- Create a `VoiceCallButton` component
- Use `VoiceRecorder` for continuous recording
- Auto-play TTS responses

### 2. Show Audio Waveform
- Use `wavesurfer.js` or similar library
- Display audio visualization during recording

### 3. Voice Activity Detection (VAD)
- Auto-stop recording when user stops speaking
- Implement using WebRTC VAD

### 4. Real-Time Streaming (Advanced)
- Implement WebSocket-based streaming for ChatGPT Voice-like experience
- Requires significant backend refactor

---

## 💰 Cost Estimates

### OpenAI Whisper (STT)
- $0.006 per minute of audio
- Example: 10 hours of audio = ~$3.60

### OpenAI TTS
- **tts-1**: $0.015 per 1,000 characters
- **tts-1-hd**: $0.030 per 1,000 characters  
- Example: 1 minute of speech ≈ 150 characters

### Total Cost per User (Core Tier, 60 min/month)
- STT: 60 min × $0.006 = $0.36
- TTS: ~9,000 chars × $0.000015 = $0.14
- **Total: ~$0.50/user/month** (97.5% margin on $19.99 Core tier!)

### Total Cost per User (Studio Tier, 120 min/month)
- STT: 120 min × $0.006 = $0.72
- TTS (HD): ~18,000 chars × $0.00003 = $0.54
- **Total: ~$1.26/user/month** (99.3% margin on $149.99 Studio tier!)

---

## ✅ Integration Checklist

- [x] OpenAI SDK installed
- [x] ElevenLabs SDK installed
- [x] Backend `/api/transcribe` endpoint
- [x] Backend `/api/synthesize` endpoint
- [x] Tier enforcement (Free blocked, Core/Studio allowed)
- [x] Audio usage tracking
- [x] Frontend `voiceService.ts` updated
- [x] JWT authentication on all endpoints
- [ ] Add API keys to `.env`
- [ ] Test with Core tier user
- [ ] Test Free tier blocking
- [ ] Add UI for voice features
- [ ] Implement upgrade prompts

---

**Built with ❤️ for Atlas AI** 🎙️

