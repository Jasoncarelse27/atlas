# 🧪 Step-by-Step Testing Guide: Extracted Services

## Quick Start

```bash
# 1. Run test script
./scripts/test-extracted-services.sh

# 2. Enable all services (add to .env.local)
VITE_USE_NETWORK_MONITORING_SERVICE=true
VITE_USE_RETRY_SERVICE=true
VITE_USE_MESSAGE_PERSISTENCE_SERVICE=true
VITE_USE_AUDIO_PLAYBACK_SERVICE=true
VITE_USE_VAD_SERVICE=true

# 3. Restart dev server
npm run dev

# 4. Test voice call and watch console
```

---

## 📋 Test Plan: One Service at a Time

### Phase 1: Test NetworkMonitoringService

**Step 1**: Enable only NetworkMonitoringService
```bash
# In .env.local, add:
VITE_USE_NETWORK_MONITORING_SERVICE=true
```

**Step 2**: Restart dev server
```bash
npm run dev
```

**Step 3**: Start voice call and check console

**Expected Logs**:
```
[NetworkMonitoring] 🌐 Network quality: excellent → good
[NetworkMonitoring] ✅ Audio detected despite muted flag
```

**What to Verify**:
- ✅ `[NetworkMonitoring]` logs appear
- ✅ Network quality changes trigger callbacks
- ✅ STT timeout adapts to network quality
- ✅ No errors

**Rollback Test**: Disable flag → Legacy code should work

---

### Phase 2: Test RetryService

**Step 1**: Enable RetryService
```bash
# In .env.local, add:
VITE_USE_RETRY_SERVICE=true
```

**Step 2**: Restart and test

**Expected Logs**:
```
[RetryService] Retry attempt 1/5 for Text-to-Speech (delay: 1234ms)
```

**What to Verify**:
- ✅ `[RetryService]` logs appear on failures
- ✅ Exponential backoff working
- ✅ No retries for auth errors
- ✅ No retries for 0.0% confidence

---

### Phase 3: Test MessagePersistenceService

**Step 1**: Enable MessagePersistenceService
```bash
# In .env.local, add:
VITE_USE_MESSAGE_PERSISTENCE_SERVICE=true
```

**Step 2**: Restart and test

**Expected Logs**:
```
[MessagePersistence] ✅ Saved user voice message
[MessagePersistence] ✅ Usage logged successfully
```

**What to Verify**:
- ✅ `[MessagePersistence]` logs appear
- ✅ Messages saved to database
- ✅ Usage logs created
- ✅ Check Supabase messages table

---

### Phase 4: Test AudioPlaybackService

**Step 1**: Enable AudioPlaybackService
```bash
# In .env.local, add:
VITE_USE_AUDIO_PLAYBACK_SERVICE=true
```

**Step 2**: Restart and test

**Expected Logs**:
```
[AudioPlayback] ✅ Audio playing
[AudioPlayback] Audio playback ended
```

**What to Verify**:
- ✅ `[AudioPlayback]` logs appear
- ✅ Audio plays correctly
- ✅ Global state cleanup works
- ✅ No audio element leaks

---

### Phase 5: Test VADService

**Step 1**: Enable VADService
```bash
# In .env.local, add:
VITE_USE_VAD_SERVICE=true
```

**Step 2**: Restart and test

**Expected Logs**:
```
[VAD] ✅ Calibrated - Baseline: 5.7%, Threshold: 10.3%
[VAD] ✅ VAD monitoring started
[VAD] 🤫 Silence detected - processing speech
```

**What to Verify**:
- ✅ `[VAD]` logs appear (not `[VoiceCall]`)
- ✅ Speech detection working
- ✅ Silence detection working
- ✅ Calibration working
- ✅ Interrupt logic working

---

## 🎯 Phase 6: Test All Services Together

**Step 1**: Enable all flags
```bash
VITE_USE_NETWORK_MONITORING_SERVICE=true
VITE_USE_RETRY_SERVICE=true
VITE_USE_MESSAGE_PERSISTENCE_SERVICE=true
VITE_USE_AUDIO_PLAYBACK_SERVICE=true
VITE_USE_VAD_SERVICE=true
```

**Step 2**: Test full voice call

**Expected**: All service logs appear, everything works

---

## 🔄 Phase 7: Rollback Testing

**Step 1**: Disable all flags
```bash
# Comment out or remove all VITE_USE_*_SERVICE flags
```

**Step 2**: Restart and test

**Expected**: Legacy code works, no errors

---

## 📊 Test Checklist

### Service Logs Verification
- [ ] `[NetworkMonitoring]` logs appear
- [ ] `[RetryService]` logs appear
- [ ] `[MessagePersistence]` logs appear
- [ ] `[AudioPlayback]` logs appear
- [ ] `[VAD]` logs appear (not `[VoiceCall]`)

### Functionality Verification
- [ ] Voice call starts successfully
- [ ] Speech detection works
- [ ] STT transcription works
- [ ] TTS audio playback works
- [ ] Messages saved to database
- [ ] Call ends cleanly

### Error Handling
- [ ] No console errors
- [ ] Network failures handled gracefully
- [ ] Audio errors handled gracefully
- [ ] Service failures don't crash app

### Rollback
- [ ] Disable flags → Legacy works
- [ ] Enable flags → Services work
- [ ] Toggle mid-call → No crashes

---

## 🐛 Debugging

### Service Not Starting?
1. Check feature flag spelling
2. Hard refresh browser (Cmd+Shift+R)
3. Check console for errors
4. Verify service file exists

### Legacy Code Still Running?
1. Check `.env.local` file location
2. Restart dev server
3. Clear browser cache
4. Check flag values (true/false)

### No Service Logs?
1. Check console filter settings
2. Verify service initialization
3. Check for silent failures
4. Enable verbose logging

---

## 📝 Test Results Template

```
Test Date: ___________
Tester: ___________

Service: NetworkMonitoringService
Status: ✅ Pass / ❌ Fail
Notes: _______________________

Service: RetryService
Status: ✅ Pass / ❌ Fail
Notes: _______________________

Service: MessagePersistenceService
Status: ✅ Pass / ❌ Fail
Notes: _______________________

Service: AudioPlaybackService
Status: ✅ Pass / ❌ Fail
Notes: _______________________

Service: VADService
Status: ✅ Pass / ❌ Fail
Notes: _______________________

All Services Together:
Status: ✅ Pass / ❌ Fail
Notes: _______________________

Rollback Test:
Status: ✅ Pass / ❌ Fail
Notes: _______________________
```

---

## ✅ Success Criteria

All tests pass when:
- ✅ All 5 services can be enabled
- ✅ All services work together
- ✅ Legacy fallback works
- ✅ No console errors
- ✅ Voice calls work end-to-end
- ✅ Service logs appear correctly

