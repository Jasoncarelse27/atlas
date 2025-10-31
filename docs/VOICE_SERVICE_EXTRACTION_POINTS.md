# Voice Service Extraction Points Documentation

**File:** `src/services/voiceCallService.ts`  
**Total Lines:** 1,792  
**Refactoring Risk:** 81% (Critical)  
**Created:** 2025-01-01  
**Purpose:** Document all service extraction boundaries for safe refactoring

---

## Overview

This document maps all logical service boundaries in `voiceCallService.ts` for safe extraction. Each service can be extracted independently with low risk when following the extraction checklist.

**Critical:** All extractions must preserve exact behavior, state synchronization, and error handling patterns.

---

## Service Extraction Map

### 1. Voice Activity Detection (VAD) Service

**Status:** 🔴 High Priority - Most self-contained, lowest risk extraction

**Current Location:**
- State variables: Lines 39-64
- Setup: Lines 212-465 (`startRecordingWithVAD`)
- Calibration: Lines 471-535 (`calibrateAmbientNoise`)
- Monitoring: Lines 536-734 (`startVADMonitoring`)
- Restart logic: Lines 735-790 (`restartRecordingVAD`)

**Extraction Points:**

**Methods to Extract:**
- `startRecordingWithVAD()` → `VADService.startRecording()`
- `calibrateAmbientNoise()` → `VADService.calibrate()`
- `startVADMonitoring()` → `VADService.startMonitoring()`
- `restartRecordingVAD()` → `VADService.restart()`

**State Variables to Extract:**
```typescript
// Audio context and nodes
private audioContext: AudioContext | null = null;           // Line 40
private analyser: AnalyserNode | null = null;              // Line 41
private microphone: MediaStreamAudioSourceNode | null = null; // Line 42
private vadCheckInterval: NodeJS.Timeout | null = null;     // Line 43

// Speech detection state
private silenceStartTime: number | null = null;             // Line 44
private lastSpeechTime: number | null = null;               // Line 47
private recordingStartTime: number = 0;                     // Line 56

// Threshold calibration
private baselineNoiseLevel: number = 0;                     // Line 61
private adaptiveThreshold: number = 0.02;                   // Line 62
private isCalibrated: boolean = false;                      // Line 63

// Constants
private readonly SILENCE_DURATION = 250;                    // Line 45
private readonly MIN_SPEECH_DURATION = 300;                 // Line 46
private readonly MIN_RECORDING_DURATION = 150;              // Line 57
```

**Dependencies:**
- `getSafeUserMedia` from `@/utils/audioHelpers` (Line 2)
- `logger` from `@/lib/logger` (Line 5)
- `isFeatureEnabled` from `../config/featureFlags` (Line 4)
- `audioQueueService` from `./audioQueueService` (Line 6) - for interrupt detection

**Critical State Dependencies:**
- `isActive` (Line 20) - Must check before operations
- `isProcessing` (Line 58) - Must synchronize with processing
- `hasInterrupted` (Line 64) - Affects VAD behavior
- `interruptTime` (Line 52) - Used in resume logic
- `mediaRecorder` (Line 21) - Controls recording lifecycle

**Cleanup Requirements:**
- Line 124-127: Clear `vadCheckInterval` in `stopCall()`
- Line 159-183: Cleanup audio context, analyser, microphone in `stopCall()`

**Risk Level:** 🟢 **Low**
- Self-contained audio analysis logic
- Clear boundaries
- Well-isolated state

**Extraction Complexity:** Medium
- Must preserve timing constraints
- Must synchronize with processing flags
- Must handle audio context lifecycle

---

### 2. Network Quality Monitoring Service

**Status:** 🟢 Low Priority - Very low risk, independent monitoring

**Current Location:**
- State variables: Lines 32-37
- Start monitoring: Lines 1682-1707 (`startNetworkMonitoring`)
- Stop monitoring: Lines 1712-1719 (`stopNetworkMonitoring`)
- Quality check: Lines 1724-1771 (`checkNetworkQuality`)
- Timeout calculation: Lines 1776-1784 (`getSTTTimeout`)
- Public getter: Lines 1789-1791 (`getNetworkQuality`)

**Extraction Points:**

**Methods to Extract:**
- `startNetworkMonitoring()` → `NetworkMonitoringService.start()`
- `stopNetworkMonitoring()` → `NetworkMonitoringService.stop()`
- `checkNetworkQuality()` → `NetworkMonitoringService.checkQuality()`
- `getSTTTimeout()` → `NetworkMonitoringService.getSTTTimeout()`
- `getNetworkQuality()` → `NetworkMonitoringService.getQuality()`

**State Variables to Extract:**
```typescript
private networkQuality: 'excellent' | 'good' | 'poor' | 'offline' = 'excellent'; // Line 33
private networkCheckInterval: NodeJS.Timeout | null = null;                       // Line 34
private recentApiLatencies: number[] = [];                                        // Line 35
private readonly NETWORK_CHECK_INTERVAL = 5000;                                  // Line 36
private readonly MAX_LATENCY_HISTORY = 10;                                        // Line 37
```

**Dependencies:**
- `logger` from `@/lib/logger` (Line 5)
- `performance.now()` API (browser native)
- `/api/health` endpoint (Line 1734)

**Critical State Dependencies:**
- `isActive` (Line 20) - Only monitor when call is active
- `currentOptions` (Line 23) - For status change callbacks (Line 1700, 1703)

**Cleanup Requirements:**
- Line 115: Stop monitoring in `stopCall()`
- Line 1714-1718: Clear interval and reset state

**Risk Level:** 🟢 **Very Low**
- Pure monitoring logic
- No complex state synchronization
- Independent of other services

**Extraction Complexity:** Low
- Simple interval-based monitoring
- No audio/recording dependencies
- Easy to test in isolation

**⚠️ Critical Issue Found:**
- Line 1730: Network check timeout not tracked in `pendingTimeouts` Set
- **Fix Required:** Add timeout tracking before extraction

---

### 3. STT (Speech-to-Text) Service

**Status:** 🟡 Medium Priority - API integration, requires retry logic

**Current Location:**
- Encoding: Lines 1492-1499 (`blobToBase64`)
- Standard processing: Lines 822-839 (in `processVoiceChunkStandard`)
- Streaming processing: Lines 969-1215 (in `processVoiceChunkStreaming`)
- Timeout calculation: Lines 1776-1784 (`getSTTTimeout`)

**Extraction Points:**

**Methods to Extract:**
- `blobToBase64()` → `STTService.encodeAudio()`
- STT fetch logic from `processVoiceChunkStandard()` → `STTService.transcribeStandard()`
- STT fetch logic from `processVoiceChunkStreaming()` → `STTService.transcribeStreaming()`
- `getSTTTimeout()` → `STTService.getTimeout()` (or inject NetworkMonitoringService)

**State Variables to Extract:**
```typescript
// None - stateless service (uses injected dependencies)
```

**Dependencies:**
- `supabase.auth.getSession()` - Authentication (Lines 819, 972, 1107)
- `/api/stt-deepgram` endpoint (Line 981, 1112)
- `logger` from `@/lib/logger` (Line 5)
- `retryWithBackoff()` - Retry logic (Lines 822, 1104)
- `getSTTTimeout()` - Adaptive timeout (Line 978, 1109)
- `isFeatureEnabled('VOICE_STREAMING')` - Feature flag (Line 796)

**Critical State Dependencies:**
- `recordingMimeType` (Line 26) - Audio format for encoding
- `networkQuality` (Line 33) - For adaptive timeouts
- `isProcessing` (Line 58) - Must set before async call
- `hasInterrupted` (Line 64) - Affects resume logic on error
- `interruptTime` (Line 52) - Used in resume logic

**Error Handling:**
- Lines 1050-1101: 0.0% confidence handling with resume logic
- Lines 1151-1205: Retry error handling with resume logic
- Lines 1222-1234: Short transcript rejection

**Cleanup Requirements:**
- AbortController cleanup (Lines 977-978, 1108-1109)
- Timeout cleanup (Lines 992, 1039, 1123, 1145)

**Risk Level:** 🟡 **Medium**
- API integration complexity
- Retry logic must be preserved
- Resume logic integration critical

**Extraction Complexity:** High
- Complex error handling paths
- Resume logic dependencies
- Multiple feature flag branches
- AbortController management

**⚠️ Critical Issues Found:**
- Line 978: AbortController timeout not tracked in `pendingTimeouts`
- Line 1109: AbortController timeout not tracked
- **Fix Required:** Track all timeouts before extraction

---

### 4. TTS (Text-to-Speech) Service

**Status:** 🟡 Medium Priority - Audio queue integration required

**Current Location:**
- Standard TTS: Lines 872-894 (in `processVoiceChunkStandard`)
- Streaming TTS: Lines 1121-1491 (in `processVoiceChunkStreaming`)
- Acknowledgment sound: Lines 1652-1676 (`playAcknowledgmentSound`)

**Extraction Points:**

**Methods to Extract:**
- TTS fetch logic from `processVoiceChunkStandard()` → `TTSService.synthesizeStandard()`
- TTS streaming logic from `processVoiceChunkStreaming()` → `TTSService.synthesizeStreaming()`
- `playAcknowledgmentSound()` → `TTSService.playAcknowledgment()`

**State Variables to Extract:**
```typescript
// None - stateless service (uses injected dependencies)
```

**Dependencies:**
- `supabase.auth.getSession()` - Authentication (Lines 878, etc.)
- `/api/message?stream=1` - Claude streaming (Line 1268)
- `/api/message` - Claude non-streaming (Line 1558)
- Supabase Edge Function `/functions/v1/tts` (Line 874)
- `audioQueueService` - Audio queue management (Lines 1313, 1324, 1394, etc.)
- `conversationBuffer` - Context management (Lines 1243, 1279, 1445)
- `logger` from `@/lib/logger` (Line 5)
- `isFeatureEnabled('VOICE_STREAMING')` - Feature flag (Line 796)

**Critical State Dependencies:**
- `isProcessing` (Line 58) - Must clear after processing
- `hasInterrupted` (Line 64) - Affects audio queue behavior
- `interruptTime` (Line 52) - Used in resume logic
- `currentAudio` (Line 29) - Standard mode audio element
- `mediaRecorder` (Line 21) - Must stop when Atlas speaks (Line 1318)

**Error Handling:**
- Lines 1284-1294: Claude timeout handling
- Lines 1296-1300: Claude error handling
- Lines 1454-1490: Streaming error handling with resume logic

**Cleanup Requirements:**
- Line 907: Global state `(window as any).__atlasAudioElement` cleanup
- Line 915: Delete global state on audio end
- Line 1348-1355: Audio queue completion callback cleanup
- Line 1655: AudioContext for acknowledgment sound cleanup

**Risk Level:** 🟡 **Medium**
- Complex audio queue integration
- Streaming logic complexity
- Resume logic dependencies

**Extraction Complexity:** Very High
- Complex streaming state machine
- Audio queue callback management
- Resume logic integration
- Multiple feature flag branches

**⚠️ Critical Issues Found:**
- Line 907: Global state `__atlasAudioElement` not always cleaned up
- Line 1655: AudioContext for acknowledgment sound not tracked for cleanup
- Line 1348: Timeout not tracked in `pendingTimeouts`
- **Fix Required:** Track all timeouts and cleanup before extraction

---

### 5. Audio Playback Service

**Status:** 🟢 Low Priority - Simple wrapper, low risk

**Current Location:**
- Standard playback: Lines 896-922 (in `processVoiceChunkStandard`)
- Current audio tracking: Lines 29, 134-138, 897-901

**Extraction Points:**

**Methods to Extract:**
- Audio element creation/playback from `processVoiceChunkStandard()` → `AudioPlaybackService.play()`
- Audio stop logic from `stopCall()` → `AudioPlaybackService.stop()`

**State Variables to Extract:**
```typescript
private currentAudio: HTMLAudioElement | null = null; // Line 29
```

**Dependencies:**
- `audioQueueService` - Already handles streaming playback (Line 6)
- `logger` from `@/lib/logger` (Line 5)

**Critical State Dependencies:**
- `currentOptions` (Line 23) - For status change callbacks (Line 914)
- Global state `(window as any).__atlasAudioElement` (Line 907, 915)

**Cleanup Requirements:**
- Line 134-138: Stop audio in `stopCall()`
- Line 907: Set global state
- Line 915: Delete global state on end

**Risk Level:** 🟢 **Low**
- Simple audio element wrapper
- Minimal state
- Clear boundaries

**Extraction Complexity:** Low
- Straightforward audio element management
- Clear lifecycle

**⚠️ Critical Issue Found:**
- Line 907: Global state not always cleaned up
- **Fix Required:** Ensure cleanup on all error paths

---

### 6. Call Lifecycle Management Service

**Status:** 🔴 High Priority - Core orchestration, high risk

**Current Location:**
- Start call: Lines 66-99 (`startCall`)
- Stop call: Lines 101-206 (`stopCall`)
- Duration enforcement: Lines 84-93 (in `startCall`)

**Extraction Points:**

**Methods to Extract:**
- Duration check logic → `CallLifecycleService.enforceDuration()`
- Cleanup coordination → `CallLifecycleService.cleanup()`

**State Variables to Extract:**
```typescript
private isActive = false;                                    // Line 20
private callStartTime: Date | null = null;                  // Line 22
private currentOptions: VoiceCallOptions | null = null;     // Line 23
private maxCallDuration = 30 * 60 * 1000;                   // Line 24
private durationCheckInterval: NodeJS.Timeout | null = null; // Line 25
```

**Dependencies:**
- All other services (orchestrator)
- `logger` from `@/lib/logger` (Line 5)
- `audioQueueService` (Line 130-131)
- `conversationBuffer` (Line 192)

**Critical State Dependencies:**
- All state variables from other services
- Must coordinate cleanup of all services

**Cleanup Requirements:**
- Lines 108-112: Clear all pending timeouts
- Lines 118-121: Clear duration interval
- Lines 130-131: Stop audio queue
- Lines 134-138: Stop current audio
- Lines 141-157: Stop media recorder
- Lines 159-183: Cleanup VAD audio context
- Lines 194-202: Reset all state flags

**Risk Level:** 🔴 **High**
- Core orchestration logic
- Coordinates all services
- Critical for correct behavior

**Extraction Complexity:** Very High
- Must coordinate all services
- Complex cleanup sequence
- State synchronization critical

---

### 7. Message Persistence Service

**Status:** 🟢 Low Priority - Simple database operations

**Current Location:**
- Save message: Lines 1625-1647 (`saveVoiceMessage`)
- Track metering: Lines 1595-1623 (`trackCallMetering`)
- Usage: Lines 849-850, 866-867, 1246, 1441-1442

**Extraction Points:**

**Methods to Extract:**
- `saveVoiceMessage()` → `MessagePersistenceService.save()`
- `trackCallMetering()` → `UsageTrackingService.track()`

**State Variables to Extract:**
```typescript
// None - stateless service (uses injected dependencies)
```

**Dependencies:**
- `supabase` from `@/lib/supabaseClient` (Line 1)
- `logger` from `@/lib/logger` (Line 5)
- `currentOptions.tier` (Line 1607) - For metering

**Critical State Dependencies:**
- `currentOptions` (Line 23) - For tier and user ID
- `callStartTime` (Line 22) - For duration calculation

**Cleanup Requirements:**
- None - stateless operations

**Risk Level:** 🟢 **Low**
- Simple database operations
- No complex state
- Clear boundaries

**Extraction Complexity:** Low
- Straightforward database calls
- Easy to test

---

### 8. Retry Logic Service (Additional)

**Status:** 🟢 Low Priority - Pure logic, very low risk

**Current Location:**
- Retry method: Lines 1501-1549 (`retryWithBackoff`)

**Extraction Points:**

**Methods to Extract:**
- `retryWithBackoff()` → `RetryService.withBackoff()`

**State Variables to Extract:**
```typescript
private readonly RETRY_DELAYS = [1000, 2000, 4000, 8000, 10000]; // Line 27
private readonly MAX_RETRIES = 5;                                // Line 28
```

**Dependencies:**
- `logger` from `@/lib/logger` (Line 5)
- `currentOptions` (Line 23) - For status change callbacks (Line 1510)

**Critical State Dependencies:**
- `currentOptions` - For status updates during retries

**Risk Level:** 🟢 **Very Low**
- Pure retry logic
- No side effects
- Easy to extract

**Extraction Complexity:** Low
- Generic retry pattern
- Easy to test

---

### 9. Timeout Management Service (Additional)

**Status:** 🟡 Medium Priority - Critical for memory leak prevention

**Current Location:**
- Timeout tracking: Line 30
- Cleanup: Lines 111-112
- Usage: Throughout file (48 instances)

**Extraction Points:**

**Methods to Extract:**
- `setTimeout` wrapper → `TimeoutService.setTimeout()`
- `clearTimeout` wrapper → `TimeoutService.clearTimeout()`
- Cleanup all → `TimeoutService.clearAll()`

**State Variables to Extract:**
```typescript
private pendingTimeouts: Set<NodeJS.Timeout> = new Set(); // Line 30
```

**Dependencies:**
- None

**Critical State Dependencies:**
- None - pure timeout management

**⚠️ Critical Issues Found:**
- Line 1229: `setTimeout` not tracked in `pendingTimeouts`
- Line 1730: Network check timeout not tracked
- **Fix Required:** Track ALL timeouts before extraction

**Risk Level:** 🟡 **Medium**
- Critical for memory leak prevention
- Must track all timeouts

**Extraction Complexity:** Medium
- Must wrap all setTimeout calls
- Must ensure cleanup on all paths

---

## Critical Issues Summary

### Memory Leaks
1. **Line 1229:** `setTimeout` not added to `pendingTimeouts` Set
2. **Line 1730:** Network check timeout not tracked
3. **Line 907:** Global state `__atlasAudioElement` not always deleted
4. **Line 1655:** AudioContext for acknowledgment sound not tracked
5. **AbortControllers:** Not always cleaned up on error paths

### Race Conditions
1. **VAD vs Processing:** `isProcessing` flag checked in multiple places
2. **Resume Logic:** Complex timing dependencies
3. **Audio Queue:** `setOnComplete` callback might fire after call ends

### State Synchronization
1. **Critical Flags:** `isProcessing`, `hasInterrupted`, `interruptTime`, `isActive`
2. **Audio Queue State:** `audioQueueService.getIsPlaying()` checked multiple times
3. **Conversation Buffer:** Shared singleton - might need per-call isolation

---

## Extraction Priority Order

1. **NetworkMonitoringService** - Very low risk, independent
2. **RetryService** - Very low risk, pure logic
3. **MessagePersistenceService** - Low risk, simple DB ops
4. **AudioPlaybackService** - Low risk, simple wrapper
5. **VADService** - Low risk, self-contained (but larger)
6. **TimeoutManagementService** - Medium risk, must fix issues first
7. **STTService** - Medium risk, complex error handling
8. **TTSService** - Medium risk, complex streaming logic
9. **CallLifecycleService** - High risk, orchestration (extract last)

---

## Next Steps

1. Fix critical issues before extraction (timeout tracking, cleanup)
2. Create service interfaces (`src/services/voice/interfaces.ts`)
3. Add extraction markers in code (comments only)
4. Extract services in priority order
5. Test each extraction thoroughly before proceeding

---

**Last Updated:** 2025-01-01  
**Maintained By:** Development Team  
**Review Status:** Pending

