# Voice Service Extraction Checklist

**Purpose:** Step-by-step guide for safely extracting services from `voiceCallService.ts`  
**Created:** 2025-01-01  
**Status:** Ready for use

---

## Pre-Extraction Requirements

Before extracting any service, ensure:

- [ ] **Critical issues fixed** (see `VOICE_SERVICE_EXTRACTION_POINTS.md`)
  - [ ] All timeouts tracked in `pendingTimeouts` Set
  - [ ] AbortControllers properly cleaned up
  - [ ] Global state (`__atlasAudioElement`) cleanup verified
  - [ ] AudioContext cleanup verified
  
- [ ] **Test coverage exists** for current functionality
  - [ ] Unit tests for methods to be extracted
  - [ ] Integration tests for service interactions
  - [ ] End-to-end tests for voice call flow

- [ ] **Feature flags documented**
  - [ ] `VOICE_STREAMING` behavior preserved
  - [ ] `VOICE_SIMPLIFIED` behavior preserved
  - [ ] `VOICE_V2` behavior preserved

- [ ] **State synchronization plan**
  - [ ] Critical flags identified (`isProcessing`, `hasInterrupted`, `isActive`)
  - [ ] Synchronization strategy defined
  - [ ] Race condition prevention plan

---

## Extraction Process (Per Service)

### Phase 1: Preparation

- [ ] **Review extraction points** in `VOICE_SERVICE_EXTRACTION_POINTS.md`
  - [ ] Understand service boundaries
  - [ ] Identify all state variables
  - [ ] Map all dependencies
  - [ ] Review risk level and complexity

- [ ] **Create service file** `src/services/voice/[ServiceName].ts`
  - [ ] Import required dependencies
  - [ ] Copy interface from `src/services/voice/interfaces.ts`
  - [ ] Create class skeleton

- [ ] **Create test file** `src/services/voice/__tests__/[ServiceName].test.ts`
  - [ ] Test structure created
  - [ ] Mock dependencies prepared

### Phase 2: Implementation

- [ ] **Extract state variables**
  - [ ] Move private state to service class
  - [ ] Ensure proper initialization
  - [ ] Preserve default values

- [ ] **Extract methods**
  - [ ] Copy method implementations
  - [ ] Update dependencies (inject instead of direct access)
  - [ ] Preserve exact behavior
  - [ ] Maintain error handling

- [ ] **Update dependencies**
  - [ ] Inject dependencies via constructor
  - [ ] Update method signatures
  - [ ] Preserve callback patterns

- [ ] **Handle state synchronization**
  - [ ] Create sync mechanism for critical flags
  - [ ] Update state checks
  - [ ] Preserve race condition prevention

### Phase 3: Integration

- [ ] **Update VoiceCallService**
  - [ ] Import new service
  - [ ] Initialize service instance
  - [ ] Replace method calls with service calls
  - [ ] Preserve feature flag behavior

- [ ] **Update cleanup logic**
  - [ ] Call service cleanup in `stopCall()`
  - [ ] Ensure all resources released
  - [ ] Verify no memory leaks

- [ ] **Update error handling**
  - [ ] Preserve error propagation
  - [ ] Maintain error callbacks
  - [ ] Preserve resume logic

### Phase 4: Testing

- [ ] **Unit tests**
  - [ ] Service methods tested in isolation
  - [ ] Edge cases covered
  - [ ] Error scenarios tested
  - [ ] State transitions verified

- [ ] **Integration tests**
  - [ ] Service integration with VoiceCallService
  - [ ] State synchronization verified
  - [ ] Error propagation tested
  - [ ] Cleanup verified

- [ ] **End-to-end tests**
  - [ ] Full voice call flow tested
  - [ ] Feature flags tested
  - [ ] Error recovery tested
  - [ ] Memory leak checks

- [ ] **Load tests**
  - [ ] 10 concurrent calls
  - [ ] 50 concurrent calls
  - [ ] 100 concurrent calls
  - [ ] Verify no performance degradation

### Phase 5: Canary Deployment

- [ ] **Feature flag added**
  - [ ] Create feature flag `USE_[SERVICE_NAME]_SERVICE`
  - [ ] Default: `false` (use old code)
  - [ ] Add flag check in VoiceCallService

- [ ] **Gradual rollout**
  - [ ] Enable for 1% of users (internal testers)
  - [ ] Monitor for 24 hours
  - [ ] Check error rates, latency, memory usage
  - [ ] Enable for 10% if metrics good
  - [ ] Monitor for 48 hours
  - [ ] Enable for 50% if metrics good
  - [ ] Monitor for 72 hours
  - [ ] Enable for 100% if metrics good

- [ ] **Monitoring**
  - [ ] Error rate monitoring
  - [ ] Latency monitoring
  - [ ] Memory usage monitoring
  - [ ] User satisfaction monitoring

### Phase 6: Cleanup

- [ ] **Remove old code** (after 1 week of stable 100% rollout)
  - [ ] Remove old method implementations
  - [ ] Remove old state variables
  - [ ] Remove feature flag check
  - [ ] Update documentation

- [ ] **Final verification**
  - [ ] Code review completed
  - [ ] Tests passing
  - [ ] Documentation updated
  - [ ] No regressions

---

## Service-Specific Checklists

### NetworkMonitoringService

**Priority:** 1 (Very Low Risk)  
**Estimated Time:** 2-4 hours

**Pre-Extraction:**
- [ ] Fix timeout tracking (Line 1730)
- [ ] Verify health check endpoint exists

**Extraction:**
- [ ] Extract state: `networkQuality`, `networkCheckInterval`, `recentApiLatencies`
- [ ] Extract methods: `startNetworkMonitoring()`, `stopNetworkMonitoring()`, `checkNetworkQuality()`, `getSTTTimeout()`, `getNetworkQuality()`
- [ ] Inject `currentOptions` for callbacks
- [ ] Inject `isActive` check

**Testing:**
- [ ] Test quality detection (excellent/good/poor/offline)
- [ ] Test interval management
- [ ] Test cleanup on stop
- [ ] Test callback firing

---

### RetryService

**Priority:** 2 (Very Low Risk)  
**Estimated Time:** 1-2 hours

**Pre-Extraction:**
- [ ] None - pure logic

**Extraction:**
- [ ] Extract constants: `RETRY_DELAYS`, `MAX_RETRIES`
- [ ] Extract method: `retryWithBackoff()`
- [ ] Inject `currentOptions` for status callbacks
- [ ] Make generic (not voice-specific)

**Testing:**
- [ ] Test exponential backoff
- [ ] Test jitter calculation
- [ ] Test max retries
- [ ] Test error propagation

---

### MessagePersistenceService

**Priority:** 3 (Low Risk)  
**Estimated Time:** 1-2 hours

**Pre-Extraction:**
- [ ] None - simple DB ops

**Extraction:**
- [ ] Extract methods: `saveVoiceMessage()`, `trackCallMetering()`
- [ ] Inject Supabase client
- [ ] Inject `currentOptions` for tier/user ID

**Testing:**
- [ ] Test message saving
- [ ] Test metering calculation
- [ ] Test error handling
- [ ] Test database constraints

---

### AudioPlaybackService

**Priority:** 4 (Low Risk)  
**Estimated Time:** 2-3 hours

**Pre-Extraction:**
- [ ] Fix global state cleanup (Line 907, 915)

**Extraction:**
- [ ] Extract state: `currentAudio`
- [ ] Extract playback logic from `processVoiceChunkStandard()`
- [ ] Extract stop logic from `stopCall()`
- [ ] Inject `currentOptions` for callbacks

**Testing:**
- [ ] Test audio playback
- [ ] Test audio stop
- [ ] Test error handling
- [ ] Test global state cleanup

---

### VADService

**Priority:** 5 (Low Risk, but Large)  
**Estimated Time:** 4-6 hours

**Pre-Extraction:**
- [ ] Verify state synchronization plan

**Extraction:**
- [ ] Extract all VAD state variables (12 variables)
- [ ] Extract methods: `startRecordingWithVAD()`, `calibrateAmbientNoise()`, `startVADMonitoring()`, `restartRecordingVAD()`
- [ ] Inject dependencies: `getSafeUserMedia`, `audioQueueService`, `isFeatureEnabled`
- [ ] Create sync mechanism for `isProcessing`, `hasInterrupted`, `isActive`

**Testing:**
- [ ] Test audio context setup
- [ ] Test calibration
- [ ] Test speech detection
- [ ] Test silence detection
- [ ] Test interrupt handling
- [ ] Test resume logic
- [ ] Test cleanup

---

### TimeoutManagementService

**Priority:** 6 (Medium Risk - Critical)  
**Estimated Time:** 2-3 hours

**Pre-Extraction:**
- [ ] Fix all untracked timeouts (Lines 1229, 1730)
- [ ] Audit all setTimeout calls

**Extraction:**
- [ ] Extract state: `pendingTimeouts`
- [ ] Create wrapper: `setTimeout()`, `clearTimeout()`, `clearAll()`
- [ ] Replace all setTimeout calls with wrapper
- [ ] Ensure cleanup in `stopCall()`

**Testing:**
- [ ] Test timeout tracking
- [ ] Test timeout cleanup
- [ ] Test memory leak prevention
- [ ] Test error scenarios

---

### STTService

**Priority:** 7 (Medium Risk)  
**Estimated Time:** 4-6 hours

**Pre-Extraction:**
- [ ] Fix AbortController cleanup
- [ ] Fix timeout tracking

**Extraction:**
- [ ] Extract methods: `blobToBase64()`, STT logic from both modes
- [ ] Inject dependencies: `supabase.auth`, `retryService`, `networkMonitoringService`
- [ ] Preserve resume logic integration
- [ ] Preserve confidence checking

**Testing:**
- [ ] Test encoding
- [ ] Test standard transcription
- [ ] Test streaming transcription
- [ ] Test confidence rejection
- [ ] Test resume logic
- [ ] Test error handling
- [ ] Test timeout handling

---

### TTSService

**Priority:** 8 (Medium Risk - Complex)  
**Estimated Time:** 6-8 hours

**Pre-Extraction:**
- [ ] Fix AudioContext cleanup (Line 1655)
- [ ] Fix global state cleanup
- [ ] Fix timeout tracking

**Extraction:**
- [ ] Extract TTS logic from both modes
- [ ] Extract acknowledgment sound
- [ ] Inject dependencies: `audioQueueService`, `conversationBuffer`, `supabase.auth`
- [ ] Preserve streaming state machine
- [ ] Preserve resume logic integration

**Testing:**
- [ ] Test standard TTS
- [ ] Test streaming TTS
- [ ] Test audio queue integration
- [ ] Test sentence chunking
- [ ] Test acknowledgment sound
- [ ] Test resume logic
- [ ] Test error handling
- [ ] Test cleanup

---

### CallLifecycleService

**Priority:** 9 (High Risk - Extract Last)  
**Estimated Time:** 4-6 hours

**Pre-Extraction:**
- [ ] All other services extracted first
- [ ] Verify cleanup sequence

**Extraction:**
- [ ] Extract state: `isActive`, `callStartTime`, `currentOptions`, `durationCheckInterval`
- [ ] Extract methods: duration enforcement, cleanup coordination
- [ ] Inject all other services
- [ ] Coordinate cleanup sequence

**Testing:**
- [ ] Test call start
- [ ] Test duration enforcement
- [ ] Test cleanup sequence
- [ ] Test error recovery
- [ ] Test state synchronization

---

## Rollback Procedures

### Immediate Rollback (During Canary)

If metrics degrade:

1. **Disable feature flag immediately**
   ```typescript
   // Set flag to false
   USE_[SERVICE_NAME]_SERVICE = false;
   ```

2. **Redeploy** (old code active)

3. **Investigate** issue:
   - Check error logs
   - Review monitoring dashboards
   - Identify root cause

4. **Fix** issue in service

5. **Retry** canary deployment

### Post-Deployment Rollback

If issues found after 100% rollout:

1. **Revert commit** with extracted service
2. **Redeploy** old code
3. **Investigate** issue
4. **Fix** in separate branch
5. **Test** thoroughly
6. **Re-deploy** when ready

---

## Success Criteria

### Before Extraction
- [ ] All critical issues fixed
- [ ] Test coverage >80%
- [ ] Documentation complete

### After Extraction
- [ ] Zero production incidents
- [ ] Error rate ≤ baseline
- [ ] Latency ≤ baseline
- [ ] Memory usage ≤ baseline
- [ ] Code coverage >80%
- [ ] User satisfaction maintained

### After Cleanup
- [ ] Old code removed
- [ ] Feature flag removed
- [ ] Documentation updated
- [ ] No regressions

---

## Timeline Estimate

**Total Timeline:** 3-6 months (incremental extraction)

**Per Service:**
- NetworkMonitoringService: 1 week (prep + extract + test + canary)
- RetryService: 3 days
- MessagePersistenceService: 3 days
- AudioPlaybackService: 1 week
- VADService: 2 weeks
- TimeoutManagementService: 1 week
- STTService: 2 weeks
- TTSService: 3 weeks
- CallLifecycleService: 2 weeks

**Buffer:** Add 50% buffer for unexpected issues

---

## Monitoring Checklist

During canary deployment, monitor:

- [ ] **Error Rate**
  - [ ] 4xx errors
  - [ ] 5xx errors
  - [ ] Client-side errors
  - [ ] Service-specific errors

- [ ] **Latency**
  - [ ] STT latency
  - [ ] TTS latency
  - [ ] Total call latency
  - [ ] API response times

- [ ] **Memory**
  - [ ] Memory leaks
  - [ ] Memory growth
  - [ ] GC pauses

- [ ] **User Experience**
  - [ ] Call success rate
  - [ ] Call quality
  - [ ] User complaints
  - [ ] Support tickets

---

## Risk Mitigation

### Low Risk Services
- NetworkMonitoringService
- RetryService
- MessagePersistenceService

**Mitigation:** Standard testing, 1% → 10% → 50% → 100% rollout

### Medium Risk Services
- AudioPlaybackService
- VADService
- TimeoutManagementService
- STTService
- TTSService

**Mitigation:** 
- Extended testing period
- Slower rollout (1% → 5% → 25% → 50% → 100%)
- Extended monitoring (72 hours per stage)

### High Risk Services
- CallLifecycleService

**Mitigation:**
- Extract last (after all others)
- Extended testing period
- Very slow rollout (1% → 10% → 25% → 50% → 100%)
- Extended monitoring (1 week per stage)

---

## Documentation Updates

After each extraction:

- [ ] Update `VOICE_SERVICE_EXTRACTION_POINTS.md`
  - [ ] Mark service as extracted
  - [ ] Update dependencies
  - [ ] Note any issues encountered

- [ ] Update `VOICE_SERVICE_EXTRACTION_CHECKLIST.md`
  - [ ] Mark service as complete
  - [ ] Add lessons learned
  - [ ] Update timeline estimates

- [ ] Update service documentation
  - [ ] API documentation
  - [ ] Usage examples
  - [ ] Integration guide

---

**Last Updated:** 2025-01-01  
**Maintained By:** Development Team  
**Next Review:** After first extraction

