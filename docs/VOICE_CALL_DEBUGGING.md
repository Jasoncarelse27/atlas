# Voice Call Debugging - October 31, 2025

**Status:** 🔍 Investigating why call ends immediately

---

## 🔴 Issue Report

**Symptoms:**
- Voice call starts successfully
- Calibration completes
- Recording starts
- **Call ends immediately** (~1 second after start)
- No error logged before "Call ended"
- "Usage logged successfully" appears (indicates stopCall was called)

---

## 🔍 Root Cause Analysis

### Potential Causes:

1. **Error handler too aggressive**
   - `onError` in modal calls `endCall()` for ANY error
   - Non-critical errors are ending the call
   - **FIX:** Only end call for critical errors

2. **VAD monitoring error**
   - Error in `checkVAD` function
   - Not being caught properly
   - **FIX:** Add try-catch around VAD monitoring

3. **MediaRecorder error**
   - MediaRecorder failing silently
   - Triggering onError handler
   - **FIX:** Better error handling

4. **Modal closing prematurely**
   - `isOpen` prop changing
   - Cleanup effect running
   - **FIX:** Check modal state management

---

## ✅ Fixes Applied

### Fix 1: Error Handler (VoiceCallModal.tsx)
- Only end call for critical errors (permission denied, max duration)
- Non-critical errors show warning but keep call active
- Logs error type for debugging

### Fix 2: VAD Initialization (voiceCallService.ts)
- Initialize speech tracking variables before starting recording
- Add debug logging when recording starts
- Better state management

### Fix 3: Stop Call Logging (voiceCallService.ts)
- Add logging when stopCall is called
- Track why call is being stopped
- Help identify root cause

### Fix 4: Auth State Change Spam (useTierQuery.ts)
- Prevent duplicate "User signed in" logs
- Only log once per event type
- Changed to debug level

---

## 🧪 Testing Steps

1. Open voice call modal
2. Start call
3. Check console logs:
   - Should see "Recording started, waiting for speech..."
   - Should NOT see "Stopping call..." immediately
   - Watch for any errors
4. Speak into microphone
5. Verify call continues (doesn't end)

---

## 📊 Expected Behavior

**Before Fix:**
- Call starts → Call ends immediately
- No clear reason why

**After Fix:**
- Call starts → Waits for speech
- Only ends on critical errors
- Non-critical errors show warning

---

**Status:** Fixes applied, ready for testing

