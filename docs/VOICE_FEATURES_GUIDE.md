# Atlas Voice Features Guide

## Overview

Atlas includes comprehensive voice capabilities across three tiers:
- **FREE**: No voice features (upgrade prompt shown)
- **CORE**: Standard TTS + Voice transcription (5 min/month limit)
- **STUDIO**: HD TTS + Voice calls (unlimited with intelligent metering)

## Features by Tier

### FREE Tier
- **TTS**: Blocked
- **Voice Transcription**: Blocked
- **Voice Notes**: Blocked
- **Voice Calls**: Blocked

### CORE Tier ($19.99/month)
- **TTS**: Standard quality (`tts-1`, `alloy` voice)
- **Voice Transcription**: OpenAI Whisper STT
- **Voice Notes**: Upload as audio files (1 min max per note)
- **Voice Calls**: Not available
- **Limits**: 
  - 5 minutes/month total audio usage
  - 2 minutes/day cap
  - Shared across STT + TTS

### STUDIO Tier ($149.99/month)
- **TTS**: HD quality (`tts-1-hd`, `nova` voice)
- **Voice Transcription**: OpenAI Whisper STT
- **Voice Notes**: Upload as audio files (5 min max per note)
- **Voice Calls**: Continuous conversation mode (30 min max per call)
- **Limits**: Unlimited (with intelligent metering)
- **Intelligent Metering**: Real-time cost tracking and anomaly detection

## How to Use

### 1. Text-to-Speech (TTS)

**For Core/Studio users:**

Every AI message includes a "Listen" button that plays the response as audio.

```typescript
// Button appears automatically on AI messages
// Located below the message text
// Shows "Playing..." while audio is active
```

**Features:**
- Automatic caching (30% cost savings on repeated messages)
- Tier-based voice quality (Core=alloy, Studio=nova)
- Usage tracking against monthly limits
- Smooth playback experience

### 2. Voice Transcription

**For Core/Studio users:**

Click the microphone button to transcribe speech to text.

**How it works:**
1. Click mic button
2. Speak your message
3. Click stop
4. Text appears in input field
5. Review and send

**Current behavior** (existing feature, unchanged):
- Quick click = transcribe to text
- Mic icon in input toolbar
- Automatic tier checking

### 3. Voice Notes (Phase 2)

**For Core/Studio users:**

Long-press the microphone button to record and send voice notes.

**How it works:**
1. Long-press (>500ms) mic button
2. Speak your message
3. Release to send
4. Voice note uploads as audio file attachment

**Limits:**
- Core: 1 minute max per note
- Studio: 5 minutes max per note
- Stored in Supabase Storage (`voice-notes` bucket)

### 4. Voice Calls (Studio Only)

**For Studio users only:**

Start a continuous voice conversation with Atlas.

**How it works:**
1. Click phone icon button
2. Speak naturally
3. Atlas transcribes → responds → speaks back
4. Continuous loop (like a phone call)
5. Click "End Call" to stop

**Features:**
- 3-second audio chunks for responsiveness
- Automatic silence detection
- Real-time cost tracking (intelligent metering)
- 30-minute max duration per call

## Technical Details

### Usage Tracking

All audio usage is tracked in `profiles.usage_stats`:

```json
{
  "audio_minutes_used": 2.5,
  "tts_characters_used": 1500,
  "voice_calls_count": 3,
  "voice_notes_count": 10,
  "last_daily_audio_reset": "2025-01-15T00:00:00Z",
  "estimated_cost_this_month": 0.15
}
```

### Cost Analysis

**CORE Tier:**
- STT: $0.006/minute
- TTS: $0.015/1K characters
- Monthly cost: ~$0.04/user (5 min limit)
- Profit margin: 99.8%

**STUDIO Tier:**
- STT: $0.006/minute
- TTS (HD): $0.030/1K characters
- Monthly cost: ~$0.63/user (heavy usage)
- Profit margin: 99.65%

### Intelligent Metering (Studio)

Real-time cost tracking and anomaly detection:

```sql
-- Tracks usage per user per month
SELECT * FROM intelligent_metering
WHERE user_id = 'your-user-id'
AND month_year = '2025-01';
```

**Anomaly Detection:**
- Triggers if daily cost exceeds $5
- Alerts admins for suspicious patterns
- Prevents API abuse

### Audio Caching

TTS audio is cached for 24 hours to reduce costs:

```typescript
// Check cache first
const cachedAudio = await audioUsageService.getCachedAudio(text, model);

// If cache hit, save ~30% cost
if (cachedAudio) {
  return cachedAudio;
}

// Generate new and cache
const audioUrl = await voiceService.synthesizeSpeech(text);
await audioUsageService.cacheAudio(text, audioUrl, model, voice);
```

## Troubleshooting

### TTS Button Not Appearing

**Symptoms:** "Listen" button missing on AI messages

**Solutions:**
1. Check user tier (must be Core or Studio)
2. Verify message is from assistant (not user)
3. Check message status (not "sending")
4. Wait for typing animation to complete

### Audio Limit Reached

**Symptoms:** "Daily/Monthly audio limit reached" error

**Solutions:**
1. Wait for daily reset (midnight UTC)
2. Wait for monthly reset (billing cycle)
3. Upgrade to Studio for unlimited

### Voice Notes Not Uploading

**Symptoms:** Voice note recording but not appearing in chat

**Solutions:**
1. Check Supabase Storage bucket exists (`voice-notes`)
2. Verify RLS policies are correct
3. Check browser permissions for microphone
4. Verify file size <10MB

### Voice Call Not Starting

**Symptoms:** Phone icon missing or call fails to start

**Solutions:**
1. Verify Studio tier (voice calls are Studio-only)
2. Check microphone permissions
3. Ensure no other calls in progress
4. Check browser compatibility (WebRTC required)

## Security & Privacy

### Data Storage
- Voice notes stored in Supabase Storage
- RLS policies enforce user-level access
- Audio files auto-expire after 24 hours (cache)

### Permissions
- Microphone access required for recording
- User consent required before accessing mic
- Clear visual indicators during recording

### Cost Controls
- Hard caps for Core tier (5 min/month)
- Daily caps for Core tier (2 min/day)
- Intelligent metering for Studio tier
- Rate limiting (10 TTS requests/minute)

## API Reference

### audioUsageService

```typescript
// Check if user can use audio features
const check = await audioUsageService.checkAudioUsage(userId, tier);

// Track usage (STT or TTS)
await audioUsageService.trackUsage(userId, tier, 'tts', undefined, charCount);

// Get cached audio
const cached = await audioUsageService.getCachedAudio(text, model);

// Cache audio for reuse
await audioUsageService.cacheAudio(text, audioUrl, model, voice);
```

### voiceService

```typescript
// Record and transcribe audio
const transcript = await voiceService.recordAndTranscribe(audioBlob, tier);

// Synthesize speech from text
const audioUrl = await voiceService.synthesizeSpeech(text);

// Play audio
await voiceService.playAudio(audioUrl);

// Upload voice note
const noteUrl = await voiceService.recordVoiceNote(audioBlob, userId, conversationId);
```

### voiceCallService

```typescript
// Start voice call (Studio only)
await voiceCallService.startCall({
  userId,
  conversationId,
  tier: 'studio',
  onTranscript: (text) => console.log('User said:', text),
  onAIResponse: (text) => console.log('AI said:', text),
  onError: (err) => console.error('Call error:', err)
});

// Stop voice call
await voiceCallService.stopCall(userId);
```

## Best Practices

### For Users
1. Use TTS sparingly on Core tier (5 min limit)
2. Review transcriptions before sending
3. Keep voice notes concise (1 min on Core)
4. Monitor usage in settings

### For Developers
1. Always use centralized tier hooks (`useTierAccess`)
2. Track all audio usage via `audioUsageService`
3. Cache TTS audio when possible
4. Handle errors gracefully (don't block user flow)
5. Show clear feedback during audio operations

## Migration Notes

### From Previous Audio Implementation
- Existing STT functionality remains unchanged
- TTS is new but non-breaking
- Voice notes are optional enhancement
- Voice calls are Studio-only feature

### Database Migrations Required
1. Run `20250115_voice_features_tracking.sql`
2. Run `voice-notes-bucket.sql` (Supabase Storage)
3. Run `20250115_intelligent_metering.sql`

### Environment Variables
No new environment variables required. Uses existing:
- `OPENAI_API_KEY` (for Whisper + TTS)

## Support

For issues or questions:
- Check this guide first
- Review tier limits in `featureAccess.ts`
- Test with different tiers (free/core/studio)
- Check browser console for errors
- Verify Supabase Storage setup

---

**Atlas Voice Features - Professional, Cost-Effective, Scalable** 🎙️

