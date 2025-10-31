# 🧪 Manual Service Testing Guide

## ✅ Already Confirmed Working
- **VADService**: ✅ Working (`[VAD]` logs visible)
- **MessagePersistenceService**: ✅ Working (`[MessagePersistence]` logs visible)

---

## 🧪 Testing Remaining Services

### Test 1: NetworkMonitoringService

**Goal**: Verify network quality monitoring works

**Steps**:
1. Enable flag: `VITE_USE_NETWORK_MONITORING_SERVICE=true` ✅ (already enabled)
2. Start voice call
3. Simulate network changes:
   - **Option A**: Throttle network in Chrome DevTools
     - Open DevTools → Network tab
     - Set throttling to "Slow 3G" or "Offline"
     - Start voice call
   - **Option B**: Disconnect/reconnect WiFi
4. Check console for:
   ```
   [NetworkMonitoring] 🌐 Network quality: excellent → poor
   [NetworkMonitoring] 🌐 Network quality: poor → excellent
   ```

**Expected**: STT timeout should adapt (longer timeout for poor network)

**Status**: ⏳ Ready to test

---

### Test 2: RetryService

**Goal**: Verify retry logic works on failures

**Steps**:
1. Enable flag: `VITE_USE_RETRY_SERVICE=true` ✅ (already enabled)
2. Start voice call
3. Simulate STT failure:
   - **Option A**: Block Deepgram API (network throttling)
   - **Option B**: Use invalid API key temporarily
   - **Option C**: Wait for natural network failure
4. Check console for:
   ```
   [RetryService] Retry attempt 1/5 for Speech-to-Text (delay: 1234ms)
   [RetryService] Retry attempt 2/5 for Speech-to-Text (delay: 2345ms)
   ```

**Expected**: 
- Retries happen with exponential backoff
- No retries for 0.0% confidence errors
- No retries for auth errors (401, 403, 429)

**Status**: ⏳ Ready to test (needs failure scenario)

---

### Test 3: AudioPlaybackService

**Goal**: Verify audio playback works in standard mode

**Steps**:
1. Enable flag: `VITE_USE_AUDIO_PLAYBACK_SERVICE=true` ✅ (already enabled)
2. **Disable streaming mode**: Set `VITE_VOICE_STREAMING_ENABLED=false` in `.env.local`
3. Restart dev server
4. Start voice call (will use standard mode, not streaming)
5. Check console for:
   ```
   [AudioPlayback] ✅ Audio playing
   [AudioPlayback] Audio playback ended
   ```

**Expected**: 
- Audio plays correctly
- Global state cleanup works
- Callbacks fire correctly

**Status**: ⏳ Ready to test (need to disable streaming mode)

---

## 🔍 Quick Verification Script

```bash
# Check which services are enabled
grep "VITE_USE_.*_SERVICE=true" .env.local

# Check if streaming is enabled (affects AudioPlaybackService)
grep "VITE_VOICE_STREAMING" .env.local

# Run unit tests
npm test -- src/services/voice/__tests__/

# Check service files exist
ls -la src/services/voice/*Service.ts
```

---

## 📊 Test Results Template

```
Test Date: ___________

✅ VADService
Status: ✅ PASSED
Evidence: [VAD] logs in console
Notes: _______________________

✅ MessagePersistenceService  
Status: ✅ PASSED
Evidence: [MessagePersistence] logs in console
Notes: _______________________

⏳ NetworkMonitoringService
Status: ⏳ PENDING / ✅ PASSED
Evidence: _______________________
Notes: _______________________

⏳ RetryService
Status: ⏳ PENDING / ✅ PASSED
Evidence: _______________________
Notes: _______________________

⏳ AudioPlaybackService
Status: ⏳ PENDING / ✅ PASSED
Evidence: _______________________
Notes: _______________________
```

---

## 🎯 Current Status

**Working**: 2/5 services confirmed
**Ready to Test**: 3/5 services (need specific scenarios)

**Next**: Test NetworkMonitoringService by throttling network, then test AudioPlaybackService in standard mode.

