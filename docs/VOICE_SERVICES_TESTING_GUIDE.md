# Voice Services Testing Guide

## 🎯 Testing Strategy

We've extracted 5 services from `voiceCallService.ts`. Each service needs:
1. **Unit Tests** - Test service in isolation
2. **Integration Tests** - Test with VoiceCallService
3. **Manual Testing** - Real-world scenarios

---

## 🧪 Test Framework

- **Framework**: Vitest
- **Location**: `src/services/voice/__tests__/`
- **Run**: `npm test` or `npm test:ui` (visual)

---

## 📋 Testing Checklist

### 1. NetworkMonitoringService

**Unit Tests:**
- [ ] Start/stop monitoring
- [ ] Network quality detection (excellent/good/poor/offline)
- [ ] Latency tracking
- [ ] STT timeout calculation based on quality
- [ ] Callback invocation on quality change
- [ ] Cleanup of intervals/timeouts

**Integration Tests:**
- [ ] Works with VoiceCallService
- [ ] Feature flag toggle works
- [ ] Legacy fallback works

**Manual Tests:**
- [ ] Enable flag: `VITE_USE_NETWORK_MONITORING_SERVICE=true`
- [ ] Check network quality changes trigger callbacks
- [ ] Verify STT timeout adapts to network quality

---

### 2. RetryService

**Unit Tests:**
- [ ] Exponential backoff with jitter
- [ ] Max retries enforcement
- [ ] Skip retries for auth errors (401, 403, 429)
- [ ] Skip retries for 0.0% confidence errors
- [ ] Preserve original error messages
- [ ] Callback invocation on retry

**Integration Tests:**
- [ ] Works with VoiceCallService retry logic
- [ ] Feature flag toggle works
- [ ] Legacy fallback works

**Manual Tests:**
- [ ] Enable flag: `VITE_USE_RETRY_SERVICE=true`
- [ ] Simulate network failures (offline mode)
- [ ] Verify retries happen with correct delays

---

### 3. MessagePersistenceService

**Unit Tests:**
- [ ] Save user messages
- [ ] Save assistant messages
- [ ] Track call metering
- [ ] Cost calculation (STT + TTS)
- [ ] Error handling (non-critical)

**Integration Tests:**
- [ ] Works with VoiceCallService
- [ ] Feature flag toggle works
- [ ] Legacy fallback works
- [ ] Supabase integration (mocked)

**Manual Tests:**
- [ ] Enable flag: `VITE_USE_MESSAGE_PERSISTENCE_SERVICE=true`
- [ ] Verify messages saved to database
- [ ] Verify usage logs created

---

### 4. AudioPlaybackService

**Unit Tests:**
- [ ] Play audio from base64 data URL
- [ ] Stop current playback
- [ ] Check if playing
- [ ] Global state cleanup (`__atlasAudioElement`)
- [ ] Error handling
- [ ] Callback invocation (onPlay, onEnded, onError)

**Integration Tests:**
- [ ] Works with VoiceCallService
- [ ] Feature flag toggle works
- [ ] Legacy fallback works
- [ ] Interrupt logic works

**Manual Tests:**
- [ ] Enable flag: `VITE_USE_AUDIO_PLAYBACK_SERVICE=true`
- [ ] Verify audio plays correctly
- [ ] Verify cleanup on errors
- [ ] Test interrupt behavior

---

### 5. VADService

**Unit Tests:**
- [ ] Start recording with VAD
- [ ] Calibrate ambient noise
- [ ] Speech detection
- [ ] Silence detection
- [ ] Interrupt detection
- [ ] Resume logic
- [ ] Cleanup resources
- [ ] Microphone mute detection

**Integration Tests:**
- [ ] Works with VoiceCallService
- [ ] Shared state synchronization
- [ ] Feature flag toggle works
- [ ] Legacy fallback works

**Manual Tests:**
- [ ] Enable flag: `VITE_USE_VAD_SERVICE=true`
- [ ] Test speech detection
- [ ] Test silence detection
- [ ] Test interrupt/resume
- [ ] Test microphone mute detection

---

## 🚀 Quick Start

### Run All Tests
```bash
npm test
```

### Run Specific Service Tests
```bash
npm test NetworkMonitoringService
npm test RetryService
npm test MessagePersistenceService
npm test AudioPlaybackService
npm test VADService
```

### Run with UI
```bash
npm test:ui
```

### Run with Coverage
```bash
npm test:coverage
```

---

## 🔧 Manual Testing

### Enable All Services
```bash
# .env.local
VITE_USE_NETWORK_MONITORING_SERVICE=true
VITE_USE_RETRY_SERVICE=true
VITE_USE_MESSAGE_PERSISTENCE_SERVICE=true
VITE_USE_AUDIO_PLAYBACK_SERVICE=true
VITE_USE_VAD_SERVICE=true
```

### Test Individual Services
1. Enable one flag at a time
2. Test voice call functionality
3. Verify logs show service usage
4. Disable flag and verify legacy works

### Test Rollback
1. Enable all flags
2. Start voice call
3. Disable flags mid-call
4. Verify no errors/crashes

---

## 📊 Success Criteria

✅ **Unit Tests**: All services have >80% coverage
✅ **Integration Tests**: All services work with VoiceCallService
✅ **Manual Tests**: All features work in real scenarios
✅ **Feature Flags**: Can enable/disable without issues
✅ **Legacy Fallback**: Works when flags disabled

---

## 🐛 Debugging

### Check Service Usage
Look for log prefixes:
- `[NetworkMonitoring]`
- `[RetryService]`
- `[MessagePersistence]`
- `[AudioPlayback]`
- `[VAD]`

### Verify Feature Flags
```typescript
import { FEATURE_FLAGS } from '@/config/featureFlags';
console.log(FEATURE_FLAGS);
```

---

## 📝 Next Steps

1. Create unit tests for each service
2. Create integration tests
3. Manual test checklist
4. Canary deployment (1% → 10% → 50% → 100%)

