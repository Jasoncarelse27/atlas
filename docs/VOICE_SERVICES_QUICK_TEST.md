# 🚀 Quick Testing Guide - Voice Services

## ✅ Test Status

- ✅ **NetworkMonitoringService** - 14 tests passing
- ✅ **RetryService** - Tests created
- ⏳ **MessagePersistenceService** - Tests pending
- ⏳ **AudioPlaybackService** - Tests pending  
- ⏳ **VADService** - Tests pending

---

## 🏃 Quick Start

### Run All Tests
```bash
npm test
```

### Run Specific Service
```bash
npm test NetworkMonitoringService
npm test RetryService
```

### Watch Mode (Auto-rerun on changes)
```bash
npm test -- --watch
```

### UI Mode (Visual test runner)
```bash
npm test:ui
```

### Coverage Report
```bash
npm test:coverage
```

---

## 🧪 Manual Testing

### 1. Enable Service Flags (one at a time)

Create `.env.local`:
```bash
# Test NetworkMonitoringService
VITE_USE_NETWORK_MONITORING_SERVICE=true

# Test RetryService  
VITE_USE_RETRY_SERVICE=true

# Test MessagePersistenceService
VITE_USE_MESSAGE_PERSISTENCE_SERVICE=true

# Test AudioPlaybackService
VITE_USE_AUDIO_PLAYBACK_SERVICE=true

# Test VADService
VITE_USE_VAD_SERVICE=true
```

### 2. Start Dev Server
```bash
npm run dev
```

### 3. Test Voice Call
1. Navigate to voice call page
2. Start a voice call
3. Check browser console for service logs:
   - `[NetworkMonitoring]` - Network quality updates
   - `[RetryService]` - Retry attempts
   - `[MessagePersistence]` - Message saves
   - `[AudioPlayback]` - Audio playback events
   - `[VAD]` - Voice activity detection

### 4. Verify Feature Works
- ✅ Voice call starts successfully
- ✅ Speech detection works
- ✅ Audio playback works
- ✅ Network quality adapts
- ✅ Retries work on failures

### 5. Test Rollback
1. Disable flag: `VITE_USE_NETWORK_MONITORING_SERVICE=false`
2. Refresh page
3. Start voice call
4. Verify legacy code works (no errors)

---

## 📊 Test Coverage Goals

- **Unit Tests**: >80% coverage per service
- **Integration Tests**: All services work with VoiceCallService
- **Manual Tests**: All features work in real scenarios

---

## 🐛 Debugging

### Check Service Usage
Open browser console and look for:
- `[NetworkMonitoring]` logs
- `[RetryService]` logs  
- `[MessagePersistence]` logs
- `[AudioPlayback]` logs
- `[VAD]` logs

### Verify Feature Flags
```typescript
// In browser console
import { FEATURE_FLAGS } from '@/config/featureFlags';
console.log(FEATURE_FLAGS);
```

### Common Issues

**Service not starting:**
- Check feature flag is enabled
- Check browser console for errors
- Verify service initialization

**Legacy code still running:**
- Double-check feature flag value
- Hard refresh browser (Cmd+Shift+R)
- Check env variable name spelling

---

## ✅ Success Criteria

- [ ] All unit tests pass
- [ ] All services work with feature flags enabled
- [ ] All services work with feature flags disabled (legacy)
- [ ] No console errors
- [ ] Voice calls work end-to-end
- [ ] Can toggle flags without errors

---

## 📝 Next Steps

1. ✅ Create unit tests for remaining services
2. ⏳ Create integration tests
3. ⏳ Manual test all scenarios
4. ⏳ Canary deployment (1% → 100%)

---

## 🎯 Current Status

**Extracted**: 5/9 services (56%)
**Tested**: 2/5 services (40%)
**Production Ready**: With feature flags (disabled by default)

