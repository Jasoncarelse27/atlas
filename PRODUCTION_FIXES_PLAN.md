# 🎯 Atlas Production Fixes - Professional Implementation Plan

**Date:** November 3, 2025  
**Priority:** P0 - Critical Production Issues  
**Timeline:** 8-12 hours (1-1.5 days)  
**Approach:** One-shot comprehensive fixes, production-ready

---

## 📊 Executive Summary

**Current State:**
- Voice calls: 54.5s latency (target: <2s)
- STT: 6-7s batch processing (target: <300ms streaming)
- TTS timeout: 15s (should be 30s)
- Memory leaks: Need audit
- Token tracking: Missing

**Fix Strategy:**
1. Enable V2 WebSocket (already built, just needs activation)
2. Add parallel LLM firing on stable partials
3. Increase TTS timeout
4. Memory leak audit & fixes
5. Token usage dashboard

---

## 🔴 PHASE 1: Voice Performance (P0) - 4-6 hours

### 1.1 Enable V2 WebSocket Streaming

**Current State:**
- V2 WebSocket exists and is production-ready
- Client: `src/services/voiceV2/voiceCallServiceV2.ts`
- Server: `api/voice-v2/server.mjs` (Fly.io ready)
- Feature flag: `VITE_VOICE_V2_ENABLED` (disabled)

**Actions:**
1. Verify Fly.io deployment status
2. Set `VITE_VOICE_V2_ENABLED=true` in Vercel env vars
3. Test WebSocket connection
4. Verify audio streaming works

**Files:**
- `src/config/featureFlags.ts` (already correct)
- Vercel Environment Variables (needs update)
- `api/voice-v2/server.mjs` (production server)

**Acceptance:**
- Streaming audio chunks arrive every 100ms
- Partial transcripts appear in real-time
- Connection stays stable

---

### 1.2 Add Parallel LLM Firing on Stable Partials

**Current State:**
- V2 server waits for FINAL transcript before calling LLM (line 118)
- Client receives partial transcripts but doesn't use them

**Implementation:**
```typescript
// api/voice-v2/server.mjs
// Track stable partials (300-500ms unchanged)
let stablePartialTracker = {
  text: '',
  lastUpdate: 0,
  confidence: 0
};

deepgram.on('Transcript', async (data) => {
  const transcript = data.channel?.alternatives?.[0]?.transcript;
  const confidence = data.channel?.alternatives?.[0]?.confidence || 0;
  const isFinal = data.is_final;

  if (transcript && transcript.length > 0) {
    // Send partial to client
    ws.send(JSON.stringify({
      type: 'partial_transcript',
      text: transcript,
      confidence,
      sessionId
    }));

    // Track stable partial (300ms unchanged = stable)
    const now = Date.now();
    if (transcript === stablePartialTracker.text) {
      const stableDuration = now - stablePartialTracker.lastUpdate;
      if (stableDuration >= 300 && !session.llmFired) {
        // Fire LLM on stable partial (don't wait for final)
        session.llmFired = true;
        await getClaudeResponseWithTTS(sessionId, transcript, { isPartial: true });
      }
    } else {
      stablePartialTracker = { text: transcript, lastUpdate: now, confidence };
    }

    // Final transcript still fires LLM (unless already fired)
    if (isFinal && !session.llmFired) {
      await getClaudeResponseWithTTS(sessionId, transcript);
    }
  }
});
```

**Files:**
- `api/voice-v2/server.mjs` (modify transcript handler)
- `api/voice-v2/local-server.mjs` (for local dev)

**Acceptance:**
- LLM fires within 300-500ms of stable partial
- Response time < 2s end-to-end
- No duplicate LLM calls

---

### 1.3 Increase TTS Timeout

**Current State:**
- `audioQueueService.ts:256` - timeout is 15s
- Should be 30s per best practices

**Fix:**
```typescript
// src/services/audioQueueService.ts:256
const timeout = isResuming ? 10000 : 30000; // 30s for new playback
```

**Files:**
- `src/services/audioQueueService.ts`

**Acceptance:**
- TTS waits up to 30s before timing out
- No premature failures on slow networks

---

## 🔍 PHASE 2: Memory Leak Audit - 2-3 hours

### 2.1 Automated Scan

**Actions:**
1. Scan all `setInterval`/`setTimeout` usage
2. Verify cleanup in `useEffect` return
3. Check AbortController usage for fetches
4. Verify event listener cleanup

**Tools:**
- Grep for `setInterval|setTimeout`
- Check React component cleanup patterns
- Verify AbortController coverage

**Files to Check:**
- `src/pages/ChatPage.tsx`
- `src/services/conversationSyncService.ts`
- `src/services/voiceCallService.ts`
- All React components with timers

**Acceptance:**
- Zero orphaned intervals/timeouts
- All fetches use AbortController
- All event listeners cleaned up

---

## 📊 PHASE 3: Token Usage Dashboard - 4-6 hours

### 3.1 Database Schema

**Migration:**
```sql
-- supabase/migrations/[timestamp]_usage_events.sql
create table if not exists usage_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) not null,
  feature text check (feature in ('chat','voice_stt','voice_tts','vision','ritual')) not null,
  model text not null,
  tokens_input int default 0,
  tokens_output int default 0,
  cost_usd numeric(10,5) default 0,
  meta jsonb default '{}',
  created_at timestamptz default now()
);

create index usage_events_user_day_idx on usage_events (user_id, created_at desc);
create index usage_events_feature_idx on usage_events (feature);

-- RLS Policies
alter table usage_events enable row level security;

create policy "Users can view own usage"
  on usage_events for select
  using (auth.uid() = user_id);

create policy "Service role can insert usage"
  on usage_events for insert
  with check (true); -- Backend inserts only
```

**Files:**
- `supabase/migrations/[timestamp]_usage_events.sql`

---

### 3.2 Backend Logging Hooks

**Implementation:**
```typescript
// backend/lib/usageLogger.mjs
export async function logUsage({ userId, feature, model, tokensIn, tokensOut, cost, meta }) {
  await supabase.from('usage_events').insert({
    user_id: userId,
    feature,
    model,
    tokens_input: tokensIn,
    tokens_output: tokensOut,
    cost_usd: cost,
    meta
  });
}

// backend/server.mjs - Add after each API call
await logUsage({
  userId,
  feature: 'chat',
  model: selectedModel,
  tokensIn: inputTokens,
  tokensOut: outputTokens,
  cost: calculateCost(inputTokens, outputTokens, selectedModel)
});
```

**Files:**
- `backend/lib/usageLogger.mjs` (new)
- `backend/server.mjs` (add logging hooks)
- `api/voice-v2/server.mjs` (add logging)

---

### 3.3 Frontend Dashboard

**Implementation:**
```typescript
// src/pages/UsageDashboard.tsx
// Simple table showing:
// - Date
// - Feature (Chat, Voice STT, Voice TTS, Vision)
// - Tokens (Input/Output)
// - Cost (USD)
// - Model used
```

**Files:**
- `src/pages/UsageDashboard.tsx` (new)
- Add route in `src/App.tsx`

**Acceptance:**
- Dashboard shows last 7/30 days
- Filters by feature
- Shows tier limits and usage %
- Warns at 80% of tier limit

---

## ✅ PHASE 4: Model Map Standardization - 1-2 hours

### 4.1 Centralize Model Map

**Current State:**
- Models defined in multiple places
- Some hardcoded, some use map

**Fix:**
```typescript
// backend/config/models.mjs (new)
export const MODEL_MAP = {
  free: 'claude-3-haiku-20240307',
  core: 'claude-3-sonnet-20240229',
  studio: 'claude-3-opus-20240229'
};

// Import everywhere
import { MODEL_MAP } from '../config/models.mjs';
```

**Files:**
- `backend/config/models.mjs` (new)
- `backend/server.mjs` (use centralized map)
- `backend/services/messageService.js` (use centralized map)
- `backend/config/intelligentTierSystem.mjs` (use centralized map)
- `src/config/featureAccess.ts` (use centralized map)

**Acceptance:**
- All endpoints use same model map
- No hardcoded model names
- Single source of truth

---

## 🚀 Deployment Order

1. **Phase 1.3** (TTS timeout) - 5 min - Safe, no dependencies
2. **Phase 1.1** (Enable V2) - 30 min - Test first, then enable
3. **Phase 1.2** (Parallel LLM) - 2-3 hours - Core improvement
4. **Phase 2** (Memory leaks) - 2-3 hours - Stability
5. **Phase 3** (Token dashboard) - 4-6 hours - Visibility
6. **Phase 4** (Model map) - 1-2 hours - Maintenance

**Total:** 8-12 hours

---

## ✅ Acceptance Criteria

### Voice Performance:
- [ ] STT first token < 300ms (or < 800ms interim)
- [ ] E2E round-trip < 2s
- [ ] No UI thread stalls
- [ ] No audio underruns

### Memory Leaks:
- [ ] Zero orphaned intervals/timeouts
- [ ] All fetches use AbortController
- [ ] All event listeners cleaned up

### Token Dashboard:
- [ ] Usage events logged for all features
- [ ] Dashboard shows last 7/30 days
- [ ] Tier limits enforced
- [ ] Warnings at 80% usage

### Model Map:
- [ ] Single source of truth
- [ ] All endpoints use centralized map
- [ ] No hardcoded model names

---

## 🎯 Success Metrics

**Before:**
- Voice latency: 54.5s
- STT: 6-7s batch
- Memory leaks: Unknown
- Token tracking: None

**After:**
- Voice latency: < 2s
- STT: < 300ms streaming
- Memory leaks: Zero
- Token tracking: Full visibility

---

**Status:** Ready for implementation  
**Risk Level:** Low (incremental, testable changes)  
**Rollback Plan:** Feature flags allow instant rollback

