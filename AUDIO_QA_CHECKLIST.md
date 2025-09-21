# 🎤 Atlas Audio QA Test Sheet

**Version:** V1.0 – September 2025  
**Scope:** Validate audio pipeline (STT + TTS + Tier Enforcement + Analytics)

---

## ✅ Test Metadata
- **Tester:** __________________
- **Device:** iOS ☐ / Android ☐
- **Tier:** Free ☐ / Core ☐ / Studio ☐
- **Date:** __________________

---

## 1. Permissions

| Scenario | Steps | Expected Result | Pass/Fail |
|----------|-------|-----------------|-----------|
| Mic denied | Deny mic on first launch | Error toast: "Microphone permission needed" | ☐ |
| Mic allowed | Grant mic access | Recording starts successfully | ☐ |

---

## 2. Recording & STT

| Scenario | Steps | Expected Result | Pass/Fail |
|----------|-------|-----------------|-----------|
| Short phrase | Record "Hello Atlas" (<10s) | Claude responds with text reply | ☐ |
| Event log | Check Supabase → audio_events | Event audio_stt_success logged | ☐ |
| Fail case | Speak gibberish | Error toast + audio_stt_fail logged | ☐ |

---

## 3. TTS Playback (Premium Only)

| Scenario | Steps | Expected Result | Pass/Fail |
|----------|-------|-----------------|-----------|
| Core user reply | Switch to Core account, record voice | Claude reply spoken aloud | ☐ |
| Studio user reply | Switch to Studio account, record voice | Claude reply spoken aloud | ☐ |
| Free user gating | Switch to Free account, record voice | No TTS (text only) | ☐ |
| Event log | Check Supabase → audio_events | Event audio_tts_playback logged | ☐ |

---

## 4. Edge Cases

| Scenario | Steps | Expected Result | Pass/Fail |
|----------|-------|-----------------|-----------|
| Long recording | Speak >60s | Recording auto-stops, toast shown | ☐ |
| Airplane mode | Enable airplane mode mid-record | Error toast, app does not crash | ☐ |
| Rapid taps | Tap mic start/stop rapidly | Debounce works, no crash | ☐ |

---

## 5. Analytics Verification

| Scenario | Query | Expected Result | Pass/Fail |
|----------|-------|-----------------|-----------|
| Events recorded | `select * from audio_events order by created_at desc limit 5;` | Latest events match your actions | ☐ |
| Success ratio | Run STT/Success query | ≥ 80% success rate | ☐ |

---

## 🏁 Final Notes
- **Critical Bugs Found:** __________________
- **Overall Confidence Level:** High ☐ / Medium ☐ / Low ☐
- **Ready for Production?** Yes ☐ / No ☐

---

## 📊 Analytics Queries for Verification

```sql
-- 1. Recent audio events
select event_name, count(*), max(created_at) as latest
from audio_events
where created_at > now() - interval '1 hour'
group by event_name
order by latest desc;

-- 2. STT success rate
with t as (
  select event_name, count(*) c from audio_events
  where created_at > now() - interval '24 hours'
  group by 1
)
select
  (select c from t where event_name = 'audio_stt_success')::float
  / nullif((select c from t where event_name in ('audio_stt_success','audio_stt_fail')),0) as stt_success_rate;

-- 3. Tier usage breakdown
select props->>'tier' as tier, event_name, count(*)
from audio_events
where created_at > now() - interval '24 hours'
group by 1,2 order by 1,2;
```
